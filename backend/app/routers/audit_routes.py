from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from app.database import get_db_connection
from app.auth import get_current_user, require_admin

router = APIRouter(prefix="/api/audit", tags=["Audit Logs"])

@router.get("/")
def get_audit_logs(
    event_type: Optional[str] = None,
    department_id: Optional[str] = None,
    outcome: Optional[str] = None,
    limit: int = Query(50, le=200),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Returns platform immutable audit trail.
    Central Admin can view all; Department Heads can view logs for their own department.
    """
    role = current_user.get("role", "").upper()
    user_dept = current_user.get("assigned_department_id")

    if role not in ("CENTRAL_ADMIN", "ADMIN", "DEPARTMENT_HEAD"):
        raise HTTPException(status_code=403, detail="Unauthorized to access audit logs.")

    conn = get_db_connection()
    cursor = conn.cursor()

    query = """
        SELECT al.*, d.name as department_name, d.code as department_code
        FROM audit_logs al
        LEFT JOIN departments d ON al.department_id = d.id
        WHERE 1=1
    """
    params = []

    if role == "DEPARTMENT_HEAD":
        query += " AND al.department_id = ?"
        params.append(user_dept)
    elif department_id:
        query += " AND al.department_id = ?"
        params.append(department_id)

    if event_type:
        query += " AND al.event_type = ?"
        params.append(event_type.upper())

    if outcome:
        query += " AND al.outcome = ?"
        params.append(outcome.upper())

    query += " ORDER BY al.created_at DESC LIMIT ?"
    params.append(limit)

    cursor.execute(query, params)
    logs = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return {"audit_logs": logs}
