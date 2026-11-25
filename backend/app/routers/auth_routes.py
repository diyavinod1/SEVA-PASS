import uuid
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel
from app.database import get_db_connection, log_audit
from app.config import settings
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
    get_current_user,
    require_admin
)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

class UserStatusUpdateRequest(BaseModel):
    status: Optional[str] = None
    is_active: Optional[bool] = None

class UserRoleUpdateRequest(BaseModel):
    role: str
    assigned_department_id: Optional[str] = None
    account_type: Optional[str] = None

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
            raw_lock = user_dict["locked_until"]
            lock_time = raw_lock if isinstance(raw_lock, datetime) else datetime.fromisoformat(str(raw_lock).replace("Z", "+00:00"))
            if lock_time.tzinfo is None:
                lock_time = lock_time.replace(tzinfo=timezone.utc)
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
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PERSONNEL', 'personnel', ?, 'active', FALSE, TRUE, ?, ?)
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

@router.get("/users")
def list_all_users(
    department_id: Optional[str] = None,
    role: Optional[str] = None,
    search: Optional[str] = None,
    status_filter: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(require_admin)
):
    """
    Returns platform user profiles for Central Admin personnel governance.
    Includes department metadata and active status.
    Excludes password_hash.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    query = """
        SELECT p.id, p.username, p.email, p.full_name, p.service_category,
               p.service_number, p.rank, p.phone, p.role, p.account_type,
               p.assigned_department_id, p.status, p.is_active,
               p.must_change_password, p.created_at, p.updated_at,
               d.name as department_name, d.code as department_code
        FROM profiles p
        LEFT JOIN departments d ON p.assigned_department_id = d.id
        WHERE 1=1
    """
    params = []

    if department_id:
        query += " AND p.assigned_department_id = ?"
        params.append(department_id)

    if role:
        query += " AND p.role = ?"
        params.append(role)

    if status_filter:
        query += " AND p.status = ?"
        params.append(status_filter)

    if search:
        s = f"%{search.strip().lower()}%"
        query += " AND (LOWER(p.username) LIKE ? OR LOWER(p.email) LIKE ? OR LOWER(p.full_name) LIKE ? OR LOWER(COALESCE(p.service_number, '')) LIKE ?)"
        params.extend([s, s, s, s])

    query += " ORDER BY p.created_at DESC"

    cursor.execute(query, tuple(params))
    rows = cursor.fetchall()
    conn.close()

    users = []
    for r in rows:
        u = dict(r)
        u["is_active"] = bool(u.get("is_active"))
        u["must_change_password"] = bool(u.get("must_change_password"))
        users.append(u)

    return {"users": users, "total": len(users)}

@router.patch("/users/{user_id}/status")
def update_user_status(
    user_id: str,
    req: UserStatusUpdateRequest,
    request: Request,
    current_user: Dict[str, Any] = Depends(require_admin)
):
    """
    Allows Central Administrators to activate, suspend, or update status of user accounts.
    Prevents self-deactivation.
    """
    if user_id == current_user["id"] and req.is_active is False:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Administrators cannot deactivate their own administrative account."
        )

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM profiles WHERE id = ?", (user_id,))
    target_user = cursor.fetchone()
    if not target_user:
        conn.close()
        raise HTTPException(status_code=404, detail="User account not found.")

    updates = []
    params = []
    now_iso = datetime.now(timezone.utc).isoformat()

    if req.status is not None:
        updates.append("status = ?")
        params.append(req.status)

    if req.is_active is not None:
        updates.append("is_active = ?")
        params.append(req.is_active)

    if not updates:
        conn.close()
        return {"status": "noop", "message": "No changes specified."}

    updates.append("updated_at = ?")
    params.append(now_iso)
    params.append(user_id)

    cursor.execute(f"UPDATE profiles SET {', '.join(updates)} WHERE id = ?", tuple(params))
    conn.commit()
    conn.close()

    log_audit(
        event_type="USER_STATUS_UPDATED",
        actor_id=current_user["id"],
        actor_email=current_user["email"],
        actor_role=current_user["role"],
        entity_type="USER_PROFILE",
        entity_id=user_id,
        outcome="SUCCESS",
        details={
            "target_username": target_user["username"],
            "new_status": req.status,
            "new_is_active": req.is_active
        },
        ip_address=request.client.host if request and request.client else "127.0.0.1"
    )

    return {"status": "success", "message": f"User {target_user['username']} status updated successfully."}

@router.patch("/users/{user_id}/role")
def update_user_role(
    user_id: str,
    req: UserRoleUpdateRequest,
    request: Request,
    current_user: Dict[str, Any] = Depends(require_admin)
):
    """
    Allows Central Administrators to reassign roles and department assignments.
    """
    valid_roles = ["CENTRAL_ADMIN", "DEPARTMENT_HEAD", "PERSONNEL"]
    if req.role not in valid_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role. Must be one of: {', '.join(valid_roles)}"
        )

    if user_id == current_user["id"] and req.role != "CENTRAL_ADMIN":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Central administrators cannot demote their own account role."
        )

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM profiles WHERE id = ?", (user_id,))
    target_user = cursor.fetchone()
    if not target_user:
        conn.close()
        raise HTTPException(status_code=404, detail="User account not found.")

    account_type = req.account_type or ("admin" if req.role == "CENTRAL_ADMIN" else ("department" if req.role == "DEPARTMENT_HEAD" else "personnel"))
    now_iso = datetime.now(timezone.utc).isoformat()

    cursor.execute("""
        UPDATE profiles
        SET role = ?, account_type = ?, assigned_department_id = ?, updated_at = ?
        WHERE id = ?
    """, (req.role, account_type, req.assigned_department_id, now_iso, user_id))
    conn.commit()
    conn.close()

    log_audit(
        event_type="USER_ROLE_UPDATED",
        actor_id=current_user["id"],
        actor_email=current_user["email"],
        actor_role=current_user["role"],
        entity_type="USER_PROFILE",
        entity_id=user_id,
        outcome="SUCCESS",
        details={
            "target_username": target_user["username"],
            "previous_role": target_user["role"],
            "new_role": req.role,
            "assigned_department_id": req.assigned_department_id
        },
        ip_address=request.client.host if request and request.client else "127.0.0.1"
    )

    return {"status": "success", "message": f"Role for {target_user['username']} updated to {req.role}."}

@router.get("/demo-accounts")
def get_demo_accounts():
    """
    Returns synthetic evaluation credentials for demonstration and review.
    All records are synthetic. Guarded by ENABLE_DEMO_ACCOUNTS in production.
    """
    if not settings.ENABLE_DEMO_ACCOUNTS:
        return {
            "status": "disabled",
            "notice": "Demo accounts endpoint disabled in production environment.",
            "accounts": []
        }

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
