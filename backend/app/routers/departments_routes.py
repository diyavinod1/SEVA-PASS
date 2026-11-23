import uuid
import secrets
import string
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from app.database import get_db_connection, log_audit
from app.auth import (
    get_current_user,
    require_admin,
    hash_password,
    verify_department_access
)
from app.models import (
    DepartmentCreate,
    DepartmentUpdate,
    TransferHeadRequest,
    ResetDeptHeadCredentialsRequest
)

router = APIRouter(prefix="/api/departments", tags=["Departments Management"])

def generate_strong_temp_password(length: int = 12) -> str:
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    while True:
        pw = ''.join(secrets.choice(alphabet) for _ in range(length))
        if (any(c.islower() for c in pw)
            and any(c.isupper() for c in pw)
            and any(c.isdigit() for c in pw)
            and any(c in "!@#$%^&*" for c in pw)):
            return pw

@router.get("/public")
def get_public_active_departments():
    """
    Publicly accessible list of active departments for registration and dropdown selectors.
    Excludes private administrative details.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT d.id, d.code, d.name, d.category, d.location, s.name as service_name
        FROM departments d
        JOIN services s ON d.service_id = s.id
        WHERE d.is_active = TRUE
        ORDER BY d.name ASC
    """)
    rows = cursor.fetchall()
    conn.close()
    return [{"id": r["id"], "code": r["code"], "name": r["name"], "category": r["category"], "location": r["location"], "service_name": r["service_name"]} for r in rows]

@router.get("/")
def list_departments(current_user: Dict[str, Any] = Depends(require_admin)):
    """
    Lists all departments with live calculated metrics (personnel count, pending, approved, rejected, issued passes).
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT 
            d.id, d.code, d.name, d.category, d.location, d.description, d.status, d.is_active, d.created_at,
            s.name as service_name, s.code as service_code,
            hp.full_name as head_officer_name, hp.rank as head_officer_rank,
            ha.username as head_username, ha.email as head_email, ha.id as head_account_id,
            (SELECT COUNT(*) FROM profiles p WHERE p.assigned_department_id = d.id AND p.role = 'PERSONNEL') as personnel_count,
            (SELECT COUNT(*) FROM pass_applications pa WHERE pa.department_id = d.id) as total_applications,
            (SELECT COUNT(*) FROM pass_applications pa WHERE pa.department_id = d.id AND pa.status = 'submitted') as pending_applications,
            (SELECT COUNT(*) FROM pass_applications pa WHERE pa.department_id = d.id AND pa.status = 'approved') as approved_applications,
            (SELECT COUNT(*) FROM pass_applications pa WHERE pa.department_id = d.id AND pa.status = 'rejected') as rejected_applications,
            (SELECT COUNT(*) FROM issued_passes ip WHERE ip.department_id = d.id AND ip.status = 'active') as active_passes
        FROM departments d
        JOIN services s ON d.service_id = s.id
        LEFT JOIN profiles hp ON d.head_personnel_id = hp.id
        LEFT JOIN profiles ha ON d.head_account_id = ha.id
        ORDER BY d.name ASC
    """)
    departments = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return {"departments": departments}

@router.get("/{department_id}")
def get_department_details(
    department_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Returns department details with assigned head, statistics, and recent activity.
    Strictly checks authorization: Central Admin or the Department's own Head.
    """
    if not verify_department_access(current_user, department_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You do not have permission to view another department's records."
        )

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT 
            d.id, d.code, d.name, d.category, d.location, d.description, d.status, d.is_active, d.created_at,
            s.name as service_name, s.code as service_code,
            hp.full_name as head_officer_name, hp.rank as head_officer_rank, hp.service_number as head_service_number,
            ha.username as head_username, ha.email as head_email, ha.id as head_account_id, ha.must_change_password as head_must_change_pw,
            (SELECT COUNT(*) FROM profiles p WHERE p.assigned_department_id = d.id AND p.role = 'PERSONNEL') as personnel_count,
            (SELECT COUNT(*) FROM pass_applications pa WHERE pa.department_id = d.id) as total_applications,
            (SELECT COUNT(*) FROM pass_applications pa WHERE pa.department_id = d.id AND pa.status = 'submitted') as pending_applications,
            (SELECT COUNT(*) FROM pass_applications pa WHERE pa.department_id = d.id AND pa.status = 'approved') as approved_applications,
            (SELECT COUNT(*) FROM pass_applications pa WHERE pa.department_id = d.id AND pa.status = 'rejected') as rejected_applications,
            (SELECT COUNT(*) FROM issued_passes ip WHERE ip.department_id = d.id AND ip.status = 'active') as active_passes
        FROM departments d
        JOIN services s ON d.service_id = s.id
        LEFT JOIN profiles hp ON d.head_personnel_id = hp.id
        LEFT JOIN profiles ha ON d.head_account_id = ha.id
        WHERE d.id = ?
    """, (department_id,))
    dept = cursor.fetchone()

    if not dept:
        conn.close()
        raise HTTPException(status_code=404, detail="Department not found.")

    # Recent activity
    cursor.execute("""
        SELECT event_type, actor_email, entity_type, outcome, created_at, details
        FROM audit_logs
        WHERE department_id = ?
        ORDER BY created_at DESC LIMIT 10
    """, (department_id,))
    recent_activity = [dict(r) for r in cursor.fetchall()]

    conn.close()
    return {"department": dict(dept), "recent_activity": recent_activity}

@router.post("/")
def create_department(
    req: DepartmentCreate,
    current_user: Dict[str, Any] = Depends(require_admin),
    request: Request = None
):
    code = req.code.strip().upper()
    name = req.name.strip()

    conn = get_db_connection()
    cursor = conn.cursor()

    # Prevent duplicate department code
    cursor.execute("SELECT id FROM departments WHERE UPPER(code) = ?", (code,))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail=f"Department code '{code}' already exists. Department codes must be unique.")

    dept_id = str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()

    head_account_id = None
    generated_credentials = None

    # If head assignment requested in same step
    if req.head_username:
        h_username = req.head_username.strip().lower()
        cursor.execute("SELECT id FROM profiles WHERE LOWER(username) = ?", (h_username,))
        if cursor.fetchone():
            conn.close()
            raise HTTPException(status_code=400, detail=f"Head username '{h_username}' is already in use.")

        temp_password = req.head_temporary_password or generate_strong_temp_password()
        head_account_id = str(uuid.uuid4())
        h_email = f"{h_username}@sevapass.internal"
        pw_hash = hash_password(temp_password)

        cursor.execute("""
            INSERT INTO profiles
            (id, username, email, password_hash, full_name, service_category, service_number, rank,
             role, account_type, assigned_department_id, must_change_password, is_active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 'Command', 'DEPT-HEAD', 'Department Head',
             'DEPARTMENT_HEAD', 'department_head', ?, TRUE, TRUE, ?, ?)
        """, (head_account_id, h_username, h_email, pw_hash, f"Officer Commanding — {name}", dept_id, now_iso, now_iso))

        generated_credentials = {
            "username": h_username,
            "temporary_password": temp_password,
            "must_change_on_first_login": True
        }

    cursor.execute("""
        INSERT INTO departments
        (id, service_id, code, name, category, location, description, head_personnel_id, head_account_id, status, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, ?, ?)
    """, (
        dept_id,
        req.service_id,
        code,
        name,
        req.category or "Command",
        req.location or "",
        req.description or "",
        req.head_personnel_id,
        head_account_id,
        req.status or "active",
        now_iso,
        now_iso
    ))
    conn.commit()
    conn.close()

    log_audit(
        event_type="DEPARTMENT_CREATED",
        actor_id=current_user["id"],
        actor_email=current_user["email"],
        actor_role=current_user["role"],
        department_id=dept_id,
        entity_type="DEPARTMENT",
        entity_id=dept_id,
        outcome="SUCCESS",
        details={"code": code, "name": name, "head_assigned": bool(head_account_id)},
        ip_address=request.client.host if request and request.client else "127.0.0.1"
    )

    return {
        "status": "success",
        "message": f"Department '{name}' ({code}) created successfully.",
        "department_id": dept_id,
        "credentials": generated_credentials
    }

@router.patch("/{department_id}")
def update_department(
    department_id: str,
    req: DepartmentUpdate,
    current_user: Dict[str, Any] = Depends(require_admin),
    request: Request = None
):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM departments WHERE id = ?", (department_id,))
    dept = cursor.fetchone()
    if not dept:
        conn.close()
        raise HTTPException(status_code=404, detail="Department not found.")

    fields = []
    values = []
    if req.name is not None:
        fields.append("name = ?")
        values.append(req.name.strip())
    if req.location is not None:
        fields.append("location = ?")
        values.append(req.location.strip())
    if req.description is not None:
        fields.append("description = ?")
        values.append(req.description.strip())
    if req.category is not None:
        fields.append("category = ?")
        values.append(req.category.strip())
    if req.status is not None:
        fields.append("status = ?")
        values.append(req.status.strip())
        fields.append("is_active = ?")
        values.append(True if req.status.lower() == "active" else False)
    if req.is_active is not None:
        fields.append("is_active = ?")
        values.append(bool(req.is_active))
        fields.append("status = ?")
        values.append("active" if req.is_active else "inactive")

    if not fields:
        conn.close()
        return {"status": "success", "message": "No changes specified."}

    fields.append("updated_at = ?")
    values.append(datetime.now(timezone.utc).isoformat())
    values.append(department_id)

    cursor.execute(f"UPDATE departments SET {', '.join(fields)} WHERE id = ?", values)
    conn.commit()
    conn.close()

    log_audit(
        event_type="DEPARTMENT_UPDATED",
        actor_id=current_user["id"],
        actor_email=current_user["email"],
        actor_role=current_user["role"],
        department_id=department_id,
        entity_type="DEPARTMENT",
        entity_id=department_id,
        outcome="SUCCESS",
        details={"updated_fields": fields},
        ip_address=request.client.host if request and request.client else "127.0.0.1"
    )

    return {"status": "success", "message": "Department updated successfully."}

@router.post("/{department_id}/assign-head")
def assign_or_transfer_head(
    department_id: str,
    req: TransferHeadRequest,
    current_user: Dict[str, Any] = Depends(require_admin),
    request: Request = None
):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM departments WHERE id = ?", (department_id,))
    dept = cursor.fetchone()
    if not dept:
        conn.close()
        raise HTTPException(status_code=404, detail="Department not found.")

    # Check officer exists
    cursor.execute("SELECT * FROM profiles WHERE id = ?", (req.new_head_personnel_id,))
    officer = cursor.fetchone()
    if not officer:
        conn.close()
        raise HTTPException(status_code=404, detail="Specified officer profile not found.")

    # Deactivate prior head account if one existed
    old_head_account_id = dept["head_account_id"]
    if old_head_account_id:
        cursor.execute("""
            UPDATE profiles SET is_active = FALSE, status = 'deactivated', updated_at = ?
            WHERE id = ?
        """, (datetime.now(timezone.utc).isoformat(), old_head_account_id))

    # Formulate username
    dept_code_slug = dept["code"].lower().replace("-", ".").replace("_", ".")
    head_username = (req.head_username or f"head.{dept_code_slug}").strip().lower()

    # Check if head_username is taken by someone else
    cursor.execute("SELECT id FROM profiles WHERE LOWER(username) = ? AND id != ?", (head_username, old_head_account_id or ''))
    if cursor.fetchone():
        # Append random salt to ensure uniqueness
        head_username = f"{head_username}.{secrets.token_hex(2)}"

    temp_pw = req.head_temporary_password or generate_strong_temp_password()
    pw_hash = hash_password(temp_pw)
    now_iso = datetime.now(timezone.utc).isoformat()
    new_head_acc_id = str(uuid.uuid4())

    cursor.execute("""
        INSERT INTO profiles
        (id, username, email, password_hash, full_name, service_category, service_number, rank,
         role, account_type, assigned_department_id, linked_personnel_id, must_change_password, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'DEPARTMENT_HEAD', 'department_head', ?, ?, TRUE, TRUE, ?, ?)
    """, (
        new_head_acc_id,
        head_username,
        f"{head_username}@sevapass.internal",
        pw_hash,
        f"Head — {officer['full_name']}",
        officer['service_category'],
        officer['service_number'],
        officer['rank'],
        department_id,
        req.new_head_personnel_id,
        now_iso,
        now_iso
    ))

    # Update department record
    cursor.execute("""
        UPDATE departments
        SET head_personnel_id = ?, head_account_id = ?, updated_at = ?
        WHERE id = ?
    """, (req.new_head_personnel_id, new_head_acc_id, now_iso, department_id))

    conn.commit()
    conn.close()

    log_audit(
        event_type="HEAD_ASSIGNED",
        actor_id=current_user["id"],
        actor_email=current_user["email"],
        actor_role=current_user["role"],
        department_id=department_id,
        entity_type="DEPARTMENT_HEAD",
        entity_id=new_head_acc_id,
        outcome="SUCCESS",
        details={
            "department_code": dept["code"],
            "head_username": head_username,
            "officer_name": officer["full_name"]
        },
        ip_address=request.client.host if request and request.client else "127.0.0.1"
    )

    # Securely return one-time credentials
    return {
        "status": "success",
        "message": f"Department Head assigned for {dept['name']}. Please convey these initial credentials securely.",
        "credentials": {
            "department_name": dept["name"],
            "department_code": dept["code"],
            "assigned_officer": officer["full_name"],
            "username": head_username,
            "temporary_password": temp_pw,
            "must_change_on_first_login": True,
            "notice": "This temporary password is only displayed once and will not be visible again."
        }
    }

@router.post("/{department_id}/reset-head-password")
def reset_head_password(
    department_id: str,
    req: ResetDeptHeadCredentialsRequest,
    current_user: Dict[str, Any] = Depends(require_admin),
    request: Request = None
):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM departments WHERE id = ?", (department_id,))
    dept = cursor.fetchone()
    if not dept or not dept["head_account_id"]:
        conn.close()
        raise HTTPException(status_code=400, detail="Department does not have an active head account to reset.")

    temp_pw = req.new_temporary_password or generate_strong_temp_password()
    pw_hash = hash_password(temp_pw)
    now_iso = datetime.now(timezone.utc).isoformat()

    cursor.execute("""
        UPDATE profiles
        SET password_hash = ?, must_change_password = TRUE, failed_login_attempts = 0, locked_until = NULL, updated_at = ?
        WHERE id = ?
    """, (pw_hash, now_iso, dept["head_account_id"]))
    conn.commit()

    cursor.execute("SELECT username FROM profiles WHERE id = ?", (dept["head_account_id"],))
    head_user = cursor.fetchone()
    conn.close()

    log_audit(
        event_type="HEAD_CREDENTIALS_RESET",
        actor_id=current_user["id"],
        actor_email=current_user["email"],
        actor_role=current_user["role"],
        department_id=department_id,
        entity_type="DEPARTMENT_HEAD",
        entity_id=dept["head_account_id"],
        outcome="SUCCESS",
        details={"department_code": dept["code"]},
        ip_address=request.client.host if request and request.client else "127.0.0.1"
    )

    return {
        "status": "success",
        "message": "Temporary credentials reset. Convey these to the department head securely.",
        "credentials": {
            "username": head_user["username"] if head_user else "unknown",
            "temporary_password": temp_pw,
            "must_change_on_first_login": True
        }
    }

@router.get("/{department_id}/personnel")
def get_department_personnel(
    department_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Returns personnel registered under the department.
    Guarded by department access check.
    """
    if not verify_department_access(current_user, department_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You cannot view personnel from another department."
        )

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, username, email, full_name, service_category, service_number, rank, phone, status, created_at
        FROM profiles
        WHERE assigned_department_id = ? AND role = 'PERSONNEL'
        ORDER BY full_name ASC
    """, (department_id,))
    rows = cursor.fetchall()
    conn.close()
    return {"personnel": [dict(r) for r in rows]}
