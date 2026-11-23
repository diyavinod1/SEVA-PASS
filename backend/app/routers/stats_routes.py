from datetime import datetime, timezone
from typing import Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException
from app.database import get_db_connection
from app.auth import get_current_user, require_admin, require_department_head
from app.crypto import signer
from app.config import settings

router = APIRouter(prefix="/api/stats", tags=["Statistics & Analytics"])

@router.get("/admin-overview")
def get_admin_overview_stats(current_user: Dict[str, Any] = Depends(require_admin)):
    """
    Computes real, database-derived statistics for the Central Administrator dashboard.
    Never hardcodes metrics.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    now_iso = datetime.now(timezone.utc).isoformat()

    # Core platform metrics
    cursor.execute("SELECT COUNT(*) as c FROM departments")
    total_departments = cursor.fetchone()["c"]

    cursor.execute("SELECT COUNT(*) as c FROM departments WHERE is_active = TRUE")
    active_departments = cursor.fetchone()["c"]

    cursor.execute("SELECT COUNT(*) as c FROM profiles WHERE role = 'PERSONNEL' AND is_active = TRUE")
    total_personnel = cursor.fetchone()["c"]

    cursor.execute("SELECT COUNT(*) as c FROM pass_applications")
    total_applications = cursor.fetchone()["c"]

    cursor.execute("SELECT COUNT(*) as c FROM pass_applications WHERE status = 'submitted'")
    pending_applications = cursor.fetchone()["c"]

    cursor.execute("SELECT COUNT(*) as c FROM pass_applications WHERE status = 'approved'")
    approved_applications = cursor.fetchone()["c"]

    cursor.execute("SELECT COUNT(*) as c FROM pass_applications WHERE status = 'rejected'")
    rejected_applications = cursor.fetchone()["c"]

    cursor.execute("SELECT COUNT(*) as c FROM issued_passes")
    total_passes = cursor.fetchone()["c"]

    cursor.execute("SELECT COUNT(*) as c FROM issued_passes WHERE status = 'active' AND valid_until >= ?", (now_iso,))
    active_passes = cursor.fetchone()["c"]

    cursor.execute("SELECT COUNT(*) as c FROM issued_passes WHERE status = 'expired' OR (status = 'active' AND valid_until < ?)", (now_iso,))
    expired_passes = cursor.fetchone()["c"]

    cursor.execute("SELECT COUNT(*) as c FROM issued_passes WHERE status = 'revoked'")
    revoked_passes = cursor.fetchone()["c"]

    cursor.execute("SELECT COUNT(*) as c FROM verification_logs")
    total_verifications = cursor.fetchone()["c"]

    cursor.execute("SELECT COUNT(*) as c FROM verification_logs WHERE verification_result = 'VALID'")
    successful_verifications = cursor.fetchone()["c"]

    cursor.execute("SELECT COUNT(*) as c FROM verification_logs WHERE verification_result != 'VALID'")
    failed_verifications = cursor.fetchone()["c"]

    # Verification breakdown by result
    cursor.execute("""
        SELECT verification_result, COUNT(*) as count
        FROM verification_logs
        GROUP BY verification_result
        ORDER BY count DESC
    """)
    verification_breakdown = [dict(r) for r in cursor.fetchall()]

    # Toll plaza breakdown
    cursor.execute("""
        SELECT toll_plaza_name, COUNT(*) as total_scans,
               SUM(CASE WHEN verification_result = 'VALID' THEN 1 ELSE 0 END) as valid_scans
        FROM verification_logs
        GROUP BY toll_plaza_name
        ORDER BY total_scans DESC
        LIMIT 6
    """)
    toll_breakdown = [dict(r) for r in cursor.fetchall()]

    # Department-wise breakdown
    cursor.execute("""
        SELECT 
            d.id, d.name, d.code, d.category,
            (SELECT COUNT(*) FROM profiles p WHERE p.assigned_department_id = d.id AND p.role = 'PERSONNEL') as personnel_count,
            (SELECT COUNT(*) FROM pass_applications pa WHERE pa.department_id = d.id) as total_apps,
            (SELECT COUNT(*) FROM pass_applications pa WHERE pa.department_id = d.id AND pa.status = 'submitted') as pending_apps,
            (SELECT COUNT(*) FROM pass_applications pa WHERE pa.department_id = d.id AND pa.status = 'approved') as approved_apps,
            (SELECT COUNT(*) FROM pass_applications pa WHERE pa.department_id = d.id AND pa.status = 'rejected') as rejected_apps,
            (SELECT COUNT(*) FROM issued_passes ip WHERE ip.department_id = d.id AND ip.status = 'active') as active_passes
        FROM departments d
        WHERE d.is_active = TRUE
        ORDER BY total_apps DESC
    """)
    dept_stats = [dict(r) for r in cursor.fetchall()]

    # Recent application activity
    cursor.execute("""
        SELECT pa.id, pa.application_number, pa.vehicle_registration_number, pa.status, pa.created_at,
               p.full_name as applicant_name, d.name as department_name, d.code as department_code
        FROM pass_applications pa
        JOIN profiles p ON pa.applicant_id = p.id
        JOIN departments d ON pa.department_id = d.id
        ORDER BY pa.created_at DESC LIMIT 6
    """)
    recent_applications = [dict(r) for r in cursor.fetchall()]

    # Recent pass issuance
    cursor.execute("""
        SELECT ip.id, ip.pass_code, ip.vehicle_registration_number, ip.status, ip.issued_at,
               p.full_name as applicant_name, d.name as department_name
        FROM issued_passes ip
        JOIN profiles p ON ip.applicant_id = p.id
        JOIN departments d ON ip.department_id = d.id
        ORDER BY ip.issued_at DESC LIMIT 6
    """)
    recent_passes = [dict(r) for r in cursor.fetchall()]

    conn.close()

    pub_hex = signer.get_public_key_hex()
    security_info = {
        "key_id": signer.key_id,
        "algorithm": "Ed25519 (RFC 8032 / FIPS 186-5)",
        "public_key_fingerprint": f"{pub_hex[:8]}...{pub_hex[-8:]}" if pub_hex else "N/A",
        "public_key_hex": pub_hex,
        "environment": settings.ENVIRONMENT,
        "db_mode": settings.DB_MODE,
        "supabase_connected": settings.is_supabase_configured(),
        "audit_logging_active": True
    }

    return {
        "metrics": {
            "total_departments": total_departments,
            "active_departments": active_departments,
            "total_personnel": total_personnel,
            "total_applications": total_applications,
            "pending_applications": pending_applications,
            "approved_applications": approved_applications,
            "rejected_applications": rejected_applications,
            "total_passes": total_passes,
            "active_passes": active_passes,
            "expired_passes": expired_passes,
            "revoked_passes": revoked_passes,
            "inactive_or_expired_passes": expired_passes + revoked_passes,
            "total_verifications": total_verifications,
            "successful_verifications": successful_verifications,
            "failed_verifications": failed_verifications
        },
        "department_stats": dept_stats,
        "recent_applications": recent_applications,
        "recent_passes": recent_passes,
        "verification_breakdown": verification_breakdown,
        "toll_breakdown": toll_breakdown,
        "security_info": security_info
    }

@router.get("/department-overview")
def get_department_overview_stats(current_user: Dict[str, Any] = Depends(require_department_head)):
    """
    Computes real database statistics for the Department Head's assigned command.
    """
    dept_id = current_user.get("assigned_department_id")
    if not dept_id and current_user.get("role") not in ("CENTRAL_ADMIN", "ADMIN"):
        raise HTTPException(status_code=400, detail="User is not assigned to a department.")

    conn = get_db_connection()
    cursor = conn.cursor()

    now_iso = datetime.now(timezone.utc).isoformat()

    # Department metadata
    cursor.execute("SELECT * FROM departments WHERE id = ?", (dept_id,))
    dept = cursor.fetchone()
    if not dept:
        conn.close()
        raise HTTPException(status_code=404, detail="Department record not found.")

    # Calculations
    cursor.execute("SELECT COUNT(*) as c FROM profiles WHERE assigned_department_id = ? AND role = 'PERSONNEL'", (dept_id,))
    total_personnel = cursor.fetchone()["c"]

    cursor.execute("SELECT COUNT(*) as c FROM pass_applications WHERE department_id = ? AND status = 'submitted'", (dept_id,))
    new_requests = cursor.fetchone()["c"]

    cursor.execute("SELECT COUNT(*) as c FROM pass_applications WHERE department_id = ? AND status = 'submitted'", (dept_id,))
    pending_approvals = cursor.fetchone()["c"]

    cursor.execute("SELECT COUNT(*) as c FROM pass_applications WHERE department_id = ? AND status = 'approved'", (dept_id,))
    approved_applications = cursor.fetchone()["c"]

    cursor.execute("SELECT COUNT(*) as c FROM pass_applications WHERE department_id = ? AND status = 'rejected'", (dept_id,))
    rejected_applications = cursor.fetchone()["c"]

    cursor.execute("""
        SELECT COUNT(*) as c FROM issued_passes 
        WHERE department_id = ? AND status = 'active' AND valid_until >= ?
    """, (dept_id, now_iso))
    active_passes = cursor.fetchone()["c"]

    # Recent pending applications needing review
    cursor.execute("""
        SELECT pa.*, p.full_name as applicant_name, p.rank as applicant_rank, p.service_number as applicant_service_number
        FROM pass_applications pa
        JOIN profiles p ON pa.applicant_id = p.id
        WHERE pa.department_id = ? AND pa.status = 'submitted'
        ORDER BY pa.created_at ASC LIMIT 10
    """, (dept_id,))
    pending_list = [dict(r) for r in cursor.fetchall()]

    conn.close()

    return {
        "department": {
            "id": dept["id"],
            "name": dept["name"],
            "code": dept["code"],
            "category": dept["category"],
            "location": dept["location"]
        },
        "metrics": {
            "total_personnel": total_personnel,
            "new_requests": new_requests,
            "pending_approvals": pending_approvals,
            "approved_applications": approved_applications,
            "rejected_applications": rejected_applications,
            "active_passes": active_passes
        },
        "pending_applications": pending_list
    }
