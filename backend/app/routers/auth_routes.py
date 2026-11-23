import uuid
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, status, Request
from app.database import get_db_connection, log_audit
from app.models import (
    LoginRequest,
    PersonnelRegisterRequest,
    ChangePasswordRequest,
    TokenResponse,
    UserProfileDTO
)
from app.auth import (
    verify_password,
    hash_password,
    create_access_token,
    get_current_user
)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

MAX_FAILED_ATTEMPTS = 5
LOCKOUT_DURATION_MINUTES = 15

@router.post("/login", response_model=TokenResponse)
def universal_login(req: LoginRequest, request: Request):
    login_id = req.username_or_email.strip().lower()
    plain_password = req.password

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT p.*, d.name as department_name, d.code as department_code
        FROM profiles p
        LEFT JOIN departments d ON p.assigned_department_id = d.id
        WHERE LOWER(p.username) = ? OR LOWER(p.email) = ?
    """, (login_id, login_id))
    user = cursor.fetchone()

    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()

    if not user:
        conn.close()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials supplied."
        )

    user_dict = dict(user)

    # Check brute force lockout
    if user_dict.get("locked_until"):
        try:
            lock_time = datetime.fromisoformat(user_dict["locked_until"])
            if lock_time > now:
                conn.close()
                mins_left = max(1, int((lock_time - now).total_seconds() / 60))
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Account locked due to consecutive failed attempts. Try again in {mins_left} minutes."
                )
        except (ValueError, TypeError):
            pass

    if not user_dict.get("is_active", 1):
        conn.close()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account has been suspended or deactivated. Contact your department administrator."
        )

    # Verify password
    if not verify_password(plain_password, user_dict["password_hash"]):
        failed_count = (user_dict.get("failed_login_attempts") or 0) + 1
        lock_until = None
        if failed_count >= MAX_FAILED_ATTEMPTS:
            lock_until = (now + timedelta(minutes=LOCKOUT_DURATION_MINUTES)).isoformat()

        cursor.execute("""
            UPDATE profiles
            SET failed_login_attempts = ?, locked_until = ?, updated_at = ?
            WHERE id = ?
        """, (failed_count, lock_until, now_iso, user_dict["id"]))
        conn.commit()
        conn.close()

        log_audit(
            event_type="AUTH_FAILED",
            actor_id=user_dict["id"],
            actor_email=user_dict["email"],
            actor_role=user_dict["role"],
            department_id=user_dict.get("assigned_department_id"),
            entity_type="USER_SESSION",
            entity_id=user_dict["id"],
            outcome="DENIED",
            details={"reason": "Incorrect password", "attempts": failed_count},
            ip_address=request.client.host if request.client else "127.0.0.1"
        )

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials supplied."
        )

    # Login successful: Reset lockout counter
    cursor.execute("""
        UPDATE profiles
        SET failed_login_attempts = 0, locked_until = NULL, updated_at = ?
        WHERE id = ?
    """, (now_iso, user_dict["id"]))
    conn.commit()
    conn.close()

    # Determine redirect path according to role
    role = user_dict.get("role", "PERSONNEL").upper()
    if role in ("CENTRAL_ADMIN", "ADMIN"):
        redirect_path = "/admin"
    elif role in ("DEPARTMENT_HEAD", "DEPT_HEAD"):
        redirect_path = "/department"
    elif role == "TOLL_OPERATOR":
        redirect_path = "/verify"
    else:
        redirect_path = "/personnel"

    # Create JWT
    token_payload = {
        "sub": user_dict["id"],
        "username": user_dict["username"],
        "email": user_dict["email"],
        "role": role,
        "account_type": user_dict.get("account_type", "personnel"),
        "dept": user_dict.get("assigned_department_id")
    }
    access_token = create_access_token(token_payload)

    # Sanitize user info for frontend response
    safe_user = {
        "id": user_dict["id"],
        "username": user_dict["username"],
        "email": user_dict["email"],
        "full_name": user_dict["full_name"],
        "service_category": user_dict["service_category"],
        "service_number": user_dict["service_number"],
        "rank": user_dict["rank"],
        "phone": user_dict.get("phone", ""),
        "role": role,
        "account_type": user_dict.get("account_type", "personnel"),
        "assigned_department_id": user_dict.get("assigned_department_id"),
        "department_name": user_dict.get("department_name"),
        "department_code": user_dict.get("department_code"),
        "status": user_dict.get("status", "active"),
        "must_change_password": bool(user_dict.get("must_change_password", 0))
    }

    log_audit(
        event_type="AUTH_SUCCESS",
        actor_id=user_dict["id"],
        actor_email=user_dict["email"],
        actor_role=role,
        department_id=user_dict.get("assigned_department_id"),
        entity_type="USER_SESSION",
        entity_id=user_dict["id"],
        outcome="SUCCESS",
        details={"login_id": login_id, "redirect": redirect_path},
        ip_address=request.client.host if request.client else "127.0.0.1"
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        role=role,
        account_type=user_dict.get("account_type", "personnel"),
        must_change_password=bool(user_dict.get("must_change_password", 0)),
        redirect_path=redirect_path,
        user=safe_user
    )

@router.post("/register-personnel")
def register_personnel(req: PersonnelRegisterRequest, request: Request):
    username = req.username.strip().lower()
    email = req.email.strip().lower()
    service_num = req.service_number.strip().upper()

    if req.confirm_password and req.password != req.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password and confirmation password do not match."
        )

    conn = get_db_connection()
    cursor = conn.cursor()

    # Check for duplicate username, email, or service number
    cursor.execute("""
        SELECT username, email, service_number FROM profiles
        WHERE LOWER(username) = ? OR LOWER(email) = ? OR UPPER(service_number) = ?
    """, (username, email, service_num))
    existing = cursor.fetchone()

    if existing:
        conn.close()
        if existing["username"].lower() == username:
            raise HTTPException(status_code=400, detail="This username is already registered.")
        if existing["email"].lower() == email:
            raise HTTPException(status_code=400, detail="This email address is already registered.")
        if existing["service_number"].upper() == service_num:
            raise HTTPException(status_code=400, detail="This service number is already registered.")

    # Validate department if provided
    dept_id = req.assigned_department_id
    if dept_id:
        cursor.execute("SELECT id FROM departments WHERE id = ? AND is_active = TRUE", (dept_id,))
        if not cursor.fetchone():
            conn.close()
            raise HTTPException(status_code=400, detail="Selected department does not exist or is inactive.")

    user_id = str(uuid.uuid4())
    pw_hash = hash_password(req.password)
    now_iso = datetime.now(timezone.utc).isoformat()

    cursor.execute("""
        INSERT INTO profiles
        (id, username, email, password_hash, full_name, service_category, service_number, rank, phone,
         role, account_type, assigned_department_id, status, must_change_password, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PERSONNEL', 'personnel', ?, 'active', 0, 1, ?, ?)
    """, (
        user_id,
        username,
        email,
        pw_hash,
        req.full_name.strip(),
        req.service_category.strip(),
        service_num,
        req.rank or "Major",
        req.phone or "",
        dept_id,
        now_iso,
        now_iso
    ))
    conn.commit()
    conn.close()

    log_audit(
        event_type="ACCOUNT_CREATED",
        actor_id=user_id,
        actor_email=email,
        actor_role="PERSONNEL",
        department_id=dept_id,
        entity_type="USER_PROFILE",
        entity_id=user_id,
        outcome="SUCCESS",
        details={"username": username, "service_number": service_num},
        ip_address=request.client.host if request.client else "127.0.0.1"
    )

    return {
        "status": "success",
        "message": "Personnel account registered successfully. You may now sign in.",
        "user_id": user_id,
        "username": username
    }

@router.get("/me")
def get_current_user_profile(current_user: Dict[str, Any] = Depends(get_current_user)):
    safe_profile = {
        "id": current_user["id"],
        "username": current_user["username"],
        "email": current_user["email"],
        "full_name": current_user["full_name"],
        "service_category": current_user["service_category"],
        "service_number": current_user["service_number"],
        "rank": current_user["rank"],
        "phone": current_user.get("phone", ""),
        "role": current_user["role"],
        "account_type": current_user.get("account_type", "personnel"),
        "assigned_department_id": current_user.get("assigned_department_id"),
        "department_name": current_user.get("department_name"),
        "department_code": current_user.get("department_code"),
        "status": current_user.get("status", "active"),
        "must_change_password": bool(current_user.get("must_change_password", 0))
    }
    return {"user": safe_profile}

@router.post("/change-password")
def change_password(
    req: ChangePasswordRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    request: Request = None
):
    conn = get_db_connection()
    cursor = conn.cursor()

    # If not a mandatory reset, verify current password
    if not current_user.get("must_change_password"):
        if not req.current_password or not verify_password(req.current_password, current_user["password_hash"]):
            conn.close()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is required and was incorrect."
            )

    new_hash = hash_password(req.new_password)
    now_iso = datetime.now(timezone.utc).isoformat()

    cursor.execute("""
        UPDATE profiles
        SET password_hash = ?, must_change_password = FALSE, updated_at = ?
        WHERE id = ?
    """, (new_hash, now_iso, current_user["id"]))
    conn.commit()
    conn.close()

    log_audit(
        event_type="PASSWORD_ROTATED",
        actor_id=current_user["id"],
        actor_email=current_user["email"],
        actor_role=current_user["role"],
        department_id=current_user.get("assigned_department_id"),
        entity_type="SECURITY_CREDENTIAL",
        entity_id=current_user["id"],
        outcome="SUCCESS",
        details={"status": "Mandatory or user-initiated password change completed"},
        ip_address=request.client.host if request and request.client else "127.0.0.1"
    )

    return {"status": "success", "message": "Password updated successfully."}

@router.get("/demo-accounts")
def get_demo_accounts():
    """
    Returns synthetic evaluation credentials for demonstration and review.
    All records are synthetic.
    """
    return {
        "status": "operational",
        "notice": "Demonstration environment only. All identities are synthetic.",
        "accounts": [
            {
                "role_label": "Central Administrator",
                "role": "CENTRAL_ADMIN",
                "username": "admin",
                "email": "admin@sevapass.internal",
                "password": "[Configured via SEVA_ADMIN_PASS env variable]",
                "description": "Full platform administration, department creation, and system audit governance."
            },
            {
                "role_label": "Department Head — Western Command",
                "role": "DEPARTMENT_HEAD",
                "username": "head.western",
                "email": "head.western@sevapass.internal",
                "password": "WestH3ad#2026$Transit",
                "description": "Reviews journey applications, signs passes using Ed25519, manages Western Command."
            },
            {
                "role_label": "Department Head — Northern Command",
                "role": "DEPARTMENT_HEAD",
                "username": "head.northern",
                "email": "head.northern@sevapass.internal",
                "password": "NorthH3ad#2026$Transit",
                "description": "Reviews journey applications for Northern Command."
            },
            {
                "role_label": "Personnel — Major Priya Sharma",
                "role": "PERSONNEL",
                "username": "priya.sharma",
                "email": "priya.sharma@sevapass.internal",
                "password": "PriyaPass#2026$Duty",
                "description": "Holds active verified pass for Staff SUV 21D 104523X; can submit new applications."
            },
            {
                "role_label": "Personnel — Lt. Col. Arvind Deshmukh",
                "role": "PERSONNEL",
                "username": "arvind.deshmukh",
                "email": "arvind.deshmukh@sevapass.internal",
                "password": "ArvindPass#2026$Duty",
                "description": "Holds pending pass application under Northern Command."
            }
        ]
    }
