import uuid
import secrets
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from app.database import get_db_connection, log_audit
from app.crypto import signer
from app.auth import (
    get_current_user,
    require_personnel,
    require_department_head,
    require_admin,
    verify_department_access
)
from app.models import (
    PassApplicationCreate,
    PassApplicationReview,
    PassRevocationRequest
)

router = APIRouter(prefix="/api/passes", tags=["Pass Applications & Issuance"])

@router.post("/apply")
def submit_pass_application(
    req: PassApplicationCreate,
    current_user: Dict[str, Any] = Depends(require_personnel),
    request: Request = None
):
    """
    Submits a new journey pass application.
    Enforces active personnel account status.
    """
    user_status = current_user.get("status", "active")
    if user_status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Your account status is '{user_status}'. You must have an active verified account to submit pass requests."
        )

    conn = get_db_connection()
    cursor = conn.cursor()

    # Validate department exists
    cursor.execute("SELECT id, code, name FROM departments WHERE id = ? AND is_active = TRUE", (req.department_id,))
    dept = cursor.fetchone()
    if not dept:
        conn.close()
        raise HTTPException(status_code=400, detail="The selected department is invalid or inactive.")

    app_id = str(uuid.uuid4())
    year = datetime.now(timezone.utc).year
    random_suffix = secrets.token_hex(2).upper()
    app_number = f"APP-{year}-{random_suffix}"
    now_iso = datetime.now(timezone.utc).isoformat()

    cursor.execute("""
        INSERT INTO pass_applications
        (id, application_number, applicant_id, department_id, vehicle_registration_number, vehicle_type,
         journey_origin, journey_destination, journey_purpose, journey_date,
         requested_start_time, requested_end_time, eligibility_basis, supporting_document_ref,
         status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', ?, ?)
    """, (
        app_id,
        app_number,
        current_user["id"],
        req.department_id,
        req.vehicle_registration_number.strip().upper(),
        req.vehicle_type.strip(),
        req.journey_origin.strip(),
        req.journey_destination.strip(),
        req.journey_purpose.strip(),
        req.journey_date.strip(),
        req.requested_start_time.strip(),
        req.requested_end_time.strip(),
        req.eligibility_basis or "Section 3(1)(a) Indian Tolls (Army and Air Force) Act 1901",
        req.supporting_document_ref or "",
        now_iso,
        now_iso
    ))
    conn.commit()
    conn.close()

    log_audit(
        event_type="APPLICATION_SUBMITTED",
        actor_id=current_user["id"],
        actor_email=current_user["email"],
        actor_role=current_user["role"],
        department_id=req.department_id,
        entity_type="PASS_APPLICATION",
        entity_id=app_id,
        outcome="SUCCESS",
        details={
            "application_number": app_number,
            "vehicle": req.vehicle_registration_number.strip().upper(),
            "origin": req.journey_origin.strip(),
            "destination": req.journey_destination.strip()
        },
        ip_address=request.client.host if request and request.client else "127.0.0.1"
    )

    return {
        "status": "success",
        "message": "Pass application submitted successfully for departmental review.",
        "application_id": app_id,
        "application_number": app_number
    }

@router.get("/my-applications")
def get_my_applications(
    status_filter: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(require_personnel)
):
    """
    Returns the applications submitted by the current personnel user,
    with department details and decision outcome.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    query = """
        SELECT 
            pa.*,
            d.name as department_name, d.code as department_code,
            ip.id as issued_pass_id, ip.pass_code, ip.status as pass_status
        FROM pass_applications pa
        JOIN departments d ON pa.department_id = d.id
        LEFT JOIN issued_passes ip ON pa.id = ip.application_id
        WHERE pa.applicant_id = ?
    """
    params = [current_user["id"]]

    if status_filter and status_filter.lower() != "all":
        query += " AND LOWER(pa.status) = ?"
        params.append(status_filter.lower())

    query += " ORDER BY pa.created_at DESC"

    cursor.execute(query, params)
    applications = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return {"applications": applications}

@router.get("/my-current-passes")
def get_my_current_passes(current_user: Dict[str, Any] = Depends(require_personnel)):
    """
    Returns valid or upcoming approved passes for current personnel.
    Includes high-density QR code for toll verification.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    now_iso = datetime.now(timezone.utc).isoformat()
    cursor.execute("""
        SELECT 
            ip.*,
            d.name as department_name, d.code as department_code,
            p.full_name as applicant_name, p.rank as applicant_rank, p.service_number as applicant_service_number
        FROM issued_passes ip
        JOIN departments d ON ip.department_id = d.id
        JOIN profiles p ON ip.applicant_id = p.id
        WHERE ip.applicant_id = ? AND ip.status = 'active' AND ip.valid_until >= ?
        ORDER BY ip.valid_from ASC
    """, (current_user["id"], now_iso))
    rows = cursor.fetchall()

    passes = []
    for r in rows:
        p_dict = dict(r)
        # Generate live QR data URL for the verifiable payload
        qr_data_url = signer.generate_qr_data_url(p_dict["qr_payload_encoded"])
        p_dict["qr_data_url"] = qr_data_url
        passes.append(p_dict)

    conn.close()
    return {"passes": passes}

@router.get("/my-pass-history")
def get_my_pass_history(current_user: Dict[str, Any] = Depends(require_personnel)):
    """
    Returns historical passes (expired, revoked, completed).
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    now_iso = datetime.now(timezone.utc).isoformat()
    cursor.execute("""
        SELECT 
            ip.*,
            d.name as department_name, d.code as department_code,
            pr.revocation_reason, pr.revocation_category, pr.revoked_at
        FROM issued_passes ip
        JOIN departments d ON ip.department_id = d.id
        LEFT JOIN pass_revocations pr ON ip.id = pr.pass_id
        WHERE ip.applicant_id = ? AND (ip.status != 'active' OR ip.valid_until < ?)
        ORDER BY ip.created_at DESC
    """, (current_user["id"], now_iso))
    history = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return {"history": history}

@router.get("/department-applications")
def get_department_applications(
    status_filter: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(require_department_head)
):
    """
    Returns pass applications for the Department Head's department.
    Department isolation: Department Head cannot see other departments.
    """
    dept_id = current_user.get("assigned_department_id")
    role = current_user.get("role", "").upper()

    if not dept_id and role not in ("CENTRAL_ADMIN", "ADMIN"):
        raise HTTPException(status_code=400, detail="User is not assigned to a department.")

    conn = get_db_connection()
    cursor = conn.cursor()

    query = """
        SELECT 
            pa.*,
            p.full_name as applicant_name, p.rank as applicant_rank, p.service_number as applicant_service_number,
            p.service_category as applicant_service_category, p.phone as applicant_phone, p.email as applicant_email,
            d.name as department_name, d.code as department_code,
            ip.pass_code, ip.status as pass_status
        FROM pass_applications pa
        JOIN profiles p ON pa.applicant_id = p.id
        JOIN departments d ON pa.department_id = d.id
        WHERE 1=1
    """
    params = []

    # If department head, filter strictly by their assigned department
    if role not in ("CENTRAL_ADMIN", "ADMIN"):
        query += " AND pa.department_id = ?"
        params.append(dept_id)

    if status_filter and status_filter.lower() != "all":
        query += " AND LOWER(pa.status) = ?"
        params.append(status_filter.lower())

    query += " ORDER BY pa.created_at DESC"

    cursor.execute(query, params)
    applications = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return {"applications": applications}

@router.post("/review")
def review_pass_application(
    req: PassApplicationReview,
    current_user: Dict[str, Any] = Depends(require_department_head),
    request: Request = None
):
    """
    Review and Approve or Reject a pass application.
    Rejection REQUIRES a reason.
    Approval requires confirmation and generates the cryptographically signed Ed25519 pass.
    Strictly prevents cross-department approval!
    """
    action = req.action.lower()
    if action not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="Action must be 'approve' or 'reject'.")

    if action == "reject" and not req.rejection_reason:
        raise HTTPException(status_code=400, detail="A rejection reason is strictly required when rejecting an application.")

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT pa.*, d.code as department_code, d.name as department_name, p.full_name as applicant_name
        FROM pass_applications pa
        JOIN departments d ON pa.department_id = d.id
        JOIN profiles p ON pa.applicant_id = p.id
        WHERE pa.id = ?
    """, (req.application_id,))
    app_record = cursor.fetchone()

    if not app_record:
        conn.close()
        raise HTTPException(status_code=404, detail="Application record not found.")

    # Cross-department check: Department head can ONLY approve applications in their department
    if not verify_department_access(current_user, app_record["department_id"]):
        conn.close()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You cannot approve or reject applications outside your assigned department."
        )

    if app_record["status"] == "approved":
        conn.close()
        raise HTTPException(status_code=400, detail="This application has already been approved.")

    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()

    if action == "reject":
        cursor.execute("""
            UPDATE pass_applications
            SET status = 'rejected', rejection_reason = ?, admin_notes = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ?
            WHERE id = ?
        """, (
            req.rejection_reason.strip(),
            req.admin_notes or "",
            current_user["id"],
            now_iso,
            now_iso,
            req.application_id
        ))
        conn.commit()
        conn.close()

        log_audit(
            event_type="PASS_REJECTED",
            actor_id=current_user["id"],
            actor_email=current_user["email"],
            actor_role=current_user["role"],
            department_id=app_record["department_id"],
            entity_type="PASS_APPLICATION",
            entity_id=req.application_id,
            outcome="SUCCESS",
            details={
                "reason": req.rejection_reason.strip(),
                "applicant": app_record["applicant_name"],
                "application_number": app_record["application_number"]
            },
            ip_address=request.client.host if request and request.client else "127.0.0.1"
        )

        return {"status": "success", "message": "Application rejected.", "application_id": req.application_id}

    # Action is APPROVE -> Generate Pass with Ed25519 signature
    pass_id = str(uuid.uuid4())
    year = now.year
    dept_short = app_record["department_code"].split("-")[0] if "-" in app_record["department_code"] else app_record["department_code"]
    pass_code = f"SEVA-{year}-{dept_short}-{secrets.token_hex(2).upper()}"

    valid_from = req.approved_start_time or app_record["requested_start_time"]
    valid_until = req.approved_end_time or app_record["requested_end_time"]
    confirmed_vehicle = req.confirmed_vehicle_reg or app_record["vehicle_registration_number"]

    pass_data_for_signing = {
        "pass_code": pass_code,
        "vehicle_registration_number": confirmed_vehicle,
        "department_code": app_record["department_code"],
        "journey_origin": app_record["journey_origin"],
        "journey_destination": app_record["journey_destination"],
        "valid_from": valid_from,
        "valid_until": valid_until,
        "eligibility_basis": app_record["eligibility_basis"]
    }

    # Build verifiable credential and sign
    credential = signer.build_qr_credential(pass_data_for_signing)
    canonical_json = credential["canonical"]
    signature_hex = credential["signature"]
    qr_payload_encoded = signer.canonicalize_payload(credential)

    # Insert into issued_passes
    cursor.execute("""
        INSERT INTO issued_passes
        (id, pass_code, application_id, applicant_id, department_id, vehicle_registration_number, vehicle_type,
         journey_origin, journey_destination, journey_purpose, valid_from, valid_until, eligibility_basis,
         status, signature_algorithm, key_id, signature_hex, canonical_payload_json, qr_payload_encoded,
         issued_by, issued_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 'Ed25519', ?, ?, ?, ?, ?, ?, ?)
    """, (
        pass_id,
        pass_code,
        req.application_id,
        app_record["applicant_id"],
        app_record["department_id"],
        confirmed_vehicle,
        app_record["vehicle_type"],
        app_record["journey_origin"],
        app_record["journey_destination"],
        app_record["journey_purpose"],
        valid_from,
        valid_until,
        app_record["eligibility_basis"],
        signer.key_id,
        signature_hex,
        canonical_json,
        qr_payload_encoded,
        current_user["id"],
        now_iso,
        now_iso
    ))

    # Update application status
    cursor.execute("""
        UPDATE pass_applications
        SET status = 'approved', approved_start_time = ?, approved_end_time = ?,
            admin_notes = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ?
        WHERE id = ?
    """, (
        valid_from,
        valid_until,
        req.admin_notes or "Approved by Department Head",
        current_user["id"],
        now_iso,
        now_iso,
        req.application_id
    ))

    conn.commit()
    conn.close()

    log_audit(
        event_type="PASS_ISSUED",
        actor_id=current_user["id"],
        actor_email=current_user["email"],
        actor_role=current_user["role"],
        department_id=app_record["department_id"],
        entity_type="ISSUED_PASS",
        entity_id=pass_id,
        outcome="SUCCESS",
        details={
            "pass_code": pass_code,
            "vehicle": confirmed_vehicle,
            "signature_algorithm": "Ed25519",
            "applicant": app_record["applicant_name"]
        },
        ip_address=request.client.host if request and request.client else "127.0.0.1"
    )

    return {
        "status": "success",
        "message": f"Pass {pass_code} approved and digitally signed via Ed25519.",
        "pass_id": pass_id,
        "pass_code": pass_code
    }

@router.get("/all-applications")
def get_all_applications(
    status_filter: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(require_admin)
):
    """
    Central admin view of all applications platform-wide.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    query = """
        SELECT 
            pa.*,
            p.full_name as applicant_name, p.rank as applicant_rank, p.service_number as applicant_service_number,
            d.name as department_name, d.code as department_code,
            ip.pass_code, ip.status as pass_status
        FROM pass_applications pa
        JOIN profiles p ON pa.applicant_id = p.id
        JOIN departments d ON pa.department_id = d.id
        WHERE 1=1
    """
    params = []
    if status_filter and status_filter.lower() != "all":
        query += " AND LOWER(pa.status) = ?"
        params.append(status_filter.lower())

    query += " ORDER BY pa.created_at DESC"
    cursor.execute(query, params)
    applications = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return {"applications": applications}

@router.get("/all-issued-passes")
def get_all_issued_passes(
    status_filter: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    View issued passes.
    Admin sees all; Department Head sees only their department's passes.
    """
    role = current_user.get("role", "").upper()
    dept_id = current_user.get("assigned_department_id")

    if role not in ("CENTRAL_ADMIN", "ADMIN", "DEPARTMENT_HEAD"):
        raise HTTPException(status_code=403, detail="Unauthorized.")

    conn = get_db_connection()
    cursor = conn.cursor()

    query = """
        SELECT 
            ip.*,
            p.full_name as applicant_name, p.rank as applicant_rank, p.service_number as applicant_service_number,
            d.name as department_name, d.code as department_code,
            ib.full_name as issued_by_name,
            pr.revocation_reason, pr.revoked_at
        FROM issued_passes ip
        JOIN profiles p ON ip.applicant_id = p.id
        JOIN departments d ON ip.department_id = d.id
        LEFT JOIN profiles ib ON ip.issued_by = ib.id
        LEFT JOIN pass_revocations pr ON ip.id = pr.pass_id
        WHERE 1=1
    """
    params = []

    if role == "DEPARTMENT_HEAD":
        query += " AND ip.department_id = ?"
        params.append(dept_id)

    if status_filter and status_filter.lower() != "all":
        query += " AND LOWER(ip.status) = ?"
        params.append(status_filter.lower())

    query += " ORDER BY ip.created_at DESC"
    cursor.execute(query, params)
    passes = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return {"passes": passes}

@router.post("/revoke")
def revoke_issued_pass(
    req: PassRevocationRequest,
    current_user: Dict[str, Any] = Depends(require_department_head),
    request: Request = None
):
    """
    Revoke an active pass with a required reason.
    Only Central Admin or the authorized Department Head for that pass's department can revoke.
    Personnel CANNOT revoke their own pass.
    """
    if not req.reason or len(req.reason.strip()) < 5:
        raise HTTPException(status_code=400, detail="A detailed revocation reason is required.")

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT ip.*, d.code as department_code
        FROM issued_passes ip
        JOIN departments d ON ip.department_id = d.id
        WHERE ip.id = ?
    """, (req.pass_id,))
    p_record = cursor.fetchone()

    if not p_record:
        conn.close()
        raise HTTPException(status_code=404, detail="Pass record not found.")

    if not verify_department_access(current_user, p_record["department_id"]):
        conn.close()
        raise HTTPException(status_code=403, detail="You do not have authorization to revoke passes from another department.")

    if p_record["status"] == "revoked":
        conn.close()
        raise HTTPException(status_code=400, detail="This pass is already revoked.")

    rev_id = str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()

    # Update pass status
    cursor.execute("""
        UPDATE issued_passes SET status = 'revoked' WHERE id = ?
    """, (req.pass_id,))

    # Insert revocation record
    cursor.execute("""
        INSERT INTO pass_revocations
        (id, pass_id, revoked_by, revocation_reason, revocation_category, revoked_at)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (
        rev_id,
        req.pass_id,
        current_user["id"],
        req.reason.strip(),
        req.category or "Administrative Cancellation",
        now_iso
    ))

    conn.commit()
    conn.close()

    log_audit(
        event_type="PASS_REVOKED",
        actor_id=current_user["id"],
        actor_email=current_user["email"],
        actor_role=current_user["role"],
        department_id=p_record["department_id"],
        entity_type="ISSUED_PASS",
        entity_id=req.pass_id,
        outcome="SUCCESS",
        details={
            "pass_code": p_record["pass_code"],
            "reason": req.reason.strip(),
            "category": req.category
        },
        ip_address=request.client.host if request and request.client else "127.0.0.1"
    )

    return {
        "status": "success",
        "message": f"Pass {p_record['pass_code']} has been officially revoked.",
        "pass_id": req.pass_id,
        "revocation_id": rev_id
    }

@router.get("/{pass_id}")
def get_pass_details(
    pass_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Returns full pass details including QR code data URL and printable layout metadata.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT 
            ip.*,
            p.full_name as applicant_name, p.rank as applicant_rank, p.service_number as applicant_service_number,
            p.service_category as applicant_service_category,
            d.name as department_name, d.code as department_code, d.location as department_location,
            ib.full_name as issued_by_name,
            pr.revocation_reason, pr.revoked_at
        FROM issued_passes ip
        JOIN profiles p ON ip.applicant_id = p.id
        JOIN departments d ON ip.department_id = d.id
        LEFT JOIN profiles ib ON ip.issued_by = ib.id
        LEFT JOIN pass_revocations pr ON ip.id = pr.pass_id
        WHERE ip.id = ?
    """, (pass_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Pass not found.")

    p_dict = dict(row)

    # Authorization check: Applicant, Department Head of that dept, or Admin
    role = current_user.get("role", "").upper()
    if role not in ("CENTRAL_ADMIN", "ADMIN"):
        if current_user["id"] != p_dict["applicant_id"] and current_user.get("assigned_department_id") != p_dict["department_id"]:
            raise HTTPException(status_code=403, detail="Access denied.")

    # Generate high density QR
    p_dict["qr_data_url"] = signer.generate_qr_data_url(p_dict["qr_payload_encoded"])
    return {"pass": p_dict}
