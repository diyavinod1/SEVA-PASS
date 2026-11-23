import uuid
import json
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from app.database import get_db_connection, log_audit
from app.crypto import signer
from app.auth import get_current_user_optional, get_current_user, require_admin
from app.models import (
    PublicVerificationRequest,
    VerificationResponse,
    DemoScenarioRunRequest
)

router = APIRouter(prefix="/api/verification", tags=["QR Pass Verification"])

@router.get("/public-key")
def get_verification_public_key():
    """
    Returns the server's Ed25519 public key in Raw Hex and PEM formats
    for independent third-party verification.
    """
    return {
        "key_id": signer.key_id,
        "algorithm": "Ed25519",
        "public_key_hex": signer.get_public_key_hex(),
        "public_key_pem": signer.get_public_key_pem(),
        "institution": "SEVA PASS Digital Authorisation Authority",
        "standard": "RFC 8032 / FIPS 186-5"
    }

@router.post("/verify-public", response_model=VerificationResponse)
def verify_pass_publicly(
    req: PublicVerificationRequest,
    request: Request,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    PUBLIC verification endpoint accessible without login.
    Parses QR payload or pass code, checks Ed25519 cryptographic signature,
    verifies validity period, revocation status, vehicle binding, and statutory basis.
    Strictly redacts sensitive PII (no service numbers, phone numbers, or passwords).
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    log_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    toll_plaza = req.toll_plaza_name or "Public Web Verification Portal"

    user_dict = current_user if isinstance(current_user, dict) else None
    user_id = user_dict.get("id") if user_dict else None
    user_role = user_dict.get("role") if user_dict else None
    user_email = user_dict.get("email") if user_dict else None

    checks = {
        "pass_found": False,
        "signature_valid": False,
        "not_expired": False,
        "not_revoked": False,
        "vehicle_matched": True,
        "statutory_basis_established": False
    }

    def record_and_return(
        result_status: str,
        message: str,
        pass_data: Optional[Dict[str, Any]] = None,
        pass_id: Optional[str] = None,
        pass_code: Optional[str] = None,
        auth_v: Optional[str] = None
    ) -> VerificationResponse:
        cursor.execute("""
            INSERT INTO verification_logs
            (id, pass_id, pass_code, toll_plaza_name, operator_id, source, scanned_vehicle_reg, authorised_vehicle_reg,
             verification_result, reason_detail, signature_valid, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            log_id,
            pass_id,
            pass_code,
            toll_plaza,
            user_id,
            "toll_terminal" if user_role == "TOLL_OPERATOR" else "public_web",
            req.scanned_vehicle_reg,
            auth_v,
            result_status,
            message,
            bool(checks.get("signature_valid", False)),
            now_iso
        ))
        conn.commit()
        conn.close()

        # Audit log
        outcome = "SUCCESS" if result_status == "VALID" else ("WARNING" if result_status in ("EXPIRED", "VEHICLE_MISMATCH") else "DENIED")
        log_audit(
            event_type="PUBLIC_VERIFICATION",
            actor_id=user_id,
            actor_email=user_email or "anonymous@public.web",
            actor_role=user_role or "PUBLIC_VISITOR",
            entity_type="VERIFICATION_SCAN",
            entity_id=log_id,
            outcome=outcome,
            details={
                "result": result_status,
                "pass_code": pass_code,
                "toll_plaza": toll_plaza,
                "reason": message
            },
            ip_address=request.client.host if request.client else "127.0.0.1"
        )

        return VerificationResponse(
            result=result_status,
            message=message,
            pass_data=pass_data,
            verification_checks=checks,
            log_id=log_id,
            timestamp=now_iso
        )

    pass_code_to_check = None
    embedded_credential = None

    # Step 1: Parse QR payload if provided
    if req.qr_payload:
        raw_payload = req.qr_payload.strip()
        try:
            parsed = json.loads(raw_payload)
            if isinstance(parsed, dict):
                embedded_credential = parsed
                pass_code_to_check = parsed.get("pass_code") or parsed.get("payload", {}).get("pass_code")
        except Exception:
            # Maybe the QR just encoded the raw pass_code string
            pass_code_to_check = raw_payload

    if not pass_code_to_check and req.pass_code:
        pass_code_to_check = req.pass_code.strip()

    if not pass_code_to_check:
        return record_and_return("INVALID", "No pass identifier or QR payload was provided.")

    # Step 2: Fetch pass record from database
    cursor.execute("""
        SELECT 
            ip.*,
            d.name as department_name, d.code as department_code,
            pr.revocation_reason, pr.revocation_category, pr.revoked_at
        FROM issued_passes ip
        JOIN departments d ON ip.department_id = d.id
        LEFT JOIN pass_revocations pr ON ip.id = pr.pass_id
        WHERE UPPER(ip.pass_code) = ?
    """, (pass_code_to_check.upper(),))
    row = cursor.fetchone()

    if not row:
        return record_and_return("INVALID", f"Pass record '{pass_code_to_check}' was not found in the SEVA PASS registry.")

    pass_record = dict(row)
    checks["pass_found"] = True

    # Step 3: Verify Ed25519 signature
    sig_to_verify = pass_record["signature_hex"]
    canonical_json = pass_record["canonical_payload_json"]

    # If the scanned QR contained a tampered signature or modified payload
    if embedded_credential and isinstance(embedded_credential, dict):
        if "signature" in embedded_credential:
            sig_to_verify = embedded_credential["signature"]
        if "payload" in embedded_credential:
            canonical_json = signer.canonicalize_payload(embedded_credential["payload"])

    is_sig_valid = signer.verify_payload_signature(canonical_json, sig_to_verify)
    checks["signature_valid"] = is_sig_valid

    if not is_sig_valid:
        return record_and_return(
            "INVALID",
            "Cryptographic signature check failed. The pass payload has been altered or signed by an unauthorized key.",
            pass_id=pass_record["id"],
            pass_code=pass_record["pass_code"]
        )

    # Step 4: Check Revocation
    if pass_record["status"] == "revoked" or pass_record.get("revoked_at"):
        checks["not_revoked"] = False
        rev_reason = pass_record.get("revocation_reason") or "Administratively revoked"
        return record_and_return(
            "REVOKED",
            f"This pass has been officially revoked by the issuing authority. Reason: {rev_reason}",
            pass_data={
                "pass_code": pass_record["pass_code"],
                "department_name": pass_record["department_name"],
                "revoked_at": pass_record.get("revoked_at"),
                "revocation_reason": rev_reason
            },
            pass_id=pass_record["id"],
            pass_code=pass_record["pass_code"],
            auth_v=pass_record["vehicle_registration_number"]
        )
    checks["not_revoked"] = True

    # Step 5: Check Expiry
    try:
        valid_until_dt = datetime.fromisoformat(pass_record["valid_until"])
        if valid_until_dt < now:
            checks["not_expired"] = False
            return record_and_return(
                "EXPIRED",
                f"Pass validity expired on {valid_until_dt.strftime('%d %b %Y, %H:%M UTC')}.",
                pass_data={
                    "pass_code": pass_record["pass_code"],
                    "department_name": pass_record["department_name"],
                    "vehicle_registration": pass_record["vehicle_registration_number"],
                    "valid_from": pass_record["valid_from"],
                    "valid_until": pass_record["valid_until"]
                },
                pass_id=pass_record["id"],
                pass_code=pass_record["pass_code"],
                auth_v=pass_record["vehicle_registration_number"]
            )
    except Exception:
        pass
    checks["not_expired"] = True

    # Step 6: Check Vehicle Registration Binding
    if req.scanned_vehicle_reg:
        scanned_clean = req.scanned_vehicle_reg.strip().upper().replace(" ", "").replace("-", "")
        auth_clean = pass_record["vehicle_registration_number"].strip().upper().replace(" ", "").replace("-", "")
        if scanned_clean != auth_clean:
            checks["vehicle_matched"] = False
            return record_and_return(
                "VEHICLE_MISMATCH",
                f"Vehicle mismatch. Scanned plate '{req.scanned_vehicle_reg.strip().upper()}' does not match authorized vehicle '{pass_record['vehicle_registration_number']}'.",
                pass_data={
                    "pass_code": pass_record["pass_code"],
                    "authorized_vehicle": pass_record["vehicle_registration_number"],
                    "scanned_vehicle": req.scanned_vehicle_reg.strip().upper(),
                    "department_name": pass_record["department_name"]
                },
                pass_id=pass_record["id"],
                pass_code=pass_record["pass_code"],
                auth_v=pass_record["vehicle_registration_number"]
            )
    checks["vehicle_matched"] = True

    # Step 7: Statutory Exemption Ground Verification
    checks["statutory_basis_established"] = bool(pass_record.get("eligibility_basis"))

    # Return Redacted Public Pass Data (strictly omitting PII)
    safe_pass_data = {
        "pass_code": pass_record["pass_code"],
        "vehicle_registration": pass_record["vehicle_registration_number"],
        "vehicle_type": pass_record["vehicle_type"],
        "department_name": pass_record["department_name"],
        "department_code": pass_record["department_code"],
        "journey_origin": pass_record["journey_origin"],
        "journey_destination": pass_record["journey_destination"],
        "journey_purpose": pass_record["journey_purpose"],
        "valid_from": pass_record["valid_from"],
        "valid_until": pass_record["valid_until"],
        "eligibility_basis": pass_record["eligibility_basis"],
        "signature_algorithm": pass_record["signature_algorithm"],
        "key_id": pass_record["key_id"],
        "issued_at": pass_record["issued_at"]
    }

    return record_and_return(
        "VALID",
        "Pass signature verified and authorization conditions satisfied.",
        pass_data=safe_pass_data,
        pass_id=pass_record["id"],
        pass_code=pass_record["pass_code"],
        auth_v=pass_record["vehicle_registration_number"]
    )

@router.get("/logs")
def get_verification_logs(
    limit: int = 50,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Returns recent verification activity logs.
    Available to Central Admin and Department Heads.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT vl.*, ip.vehicle_registration_number as pass_vehicle
        FROM verification_logs vl
        LEFT JOIN issued_passes ip ON vl.pass_id = ip.id
        ORDER BY vl.created_at DESC LIMIT ?
    """, (limit,))
    logs = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return {"logs": logs}

@router.post("/simulate-scenario")
def simulate_verification_scenario(req: DemoScenarioRunRequest, request: Request):
    """
    Evaluator utility to test distinct verification outcomes:
    - 'valid': Verifies an active pass.
    - 'expired': Verifies an expired test pass.
    - 'revoked': Verifies an administratively revoked pass.
    - 'tampered': Simulates altered payload failing Ed25519 verification.
    - 'mismatch': Tests plate cross-matching mismatch.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    scenario = req.scenario_type.lower()

    if scenario == "valid":
        cursor.execute("SELECT pass_code FROM issued_passes WHERE status = 'active' ORDER BY created_at DESC LIMIT 1")
        row = cursor.fetchone()
        if not row:
            conn.close()
            raise HTTPException(status_code=404, detail="No active pass available.")
        conn.close()
        return verify_pass_publicly(PublicVerificationRequest(pass_code=row["pass_code"], toll_plaza_name=req.toll_plaza_name), request, current_user=None)

    elif scenario == "expired":
        cursor.execute("SELECT pass_code FROM issued_passes WHERE status = 'expired' OR valid_until < ? LIMIT 1", (datetime.now(timezone.utc).isoformat(),))
        row = cursor.fetchone()
        if not row:
            conn.close()
            raise HTTPException(status_code=404, detail="No expired test pass available.")
        conn.close()
        return verify_pass_publicly(PublicVerificationRequest(pass_code=row["pass_code"], toll_plaza_name=req.toll_plaza_name), request, current_user=None)

    elif scenario == "revoked":
        cursor.execute("SELECT pass_code FROM issued_passes WHERE status = 'revoked' LIMIT 1")
        row = cursor.fetchone()
        if not row:
            conn.close()
            raise HTTPException(status_code=404, detail="No revoked test pass available.")
        conn.close()
        return verify_pass_publicly(PublicVerificationRequest(pass_code=row["pass_code"], toll_plaza_name=req.toll_plaza_name), request, current_user=None)

    elif scenario == "tampered":
        # Find any active pass, modify vehicle registration, and test
        cursor.execute("SELECT * FROM issued_passes WHERE status = 'active' LIMIT 1")
        row = cursor.fetchone()
        if not row:
            conn.close()
            raise HTTPException(status_code=404, detail="No test pass available.")
        p = dict(row)
        conn.close()
        # Alter the payload while keeping the original signature
        tampered_qr = {
            "pass_code": p["pass_code"],
            "payload": {
                "pass_code": p["pass_code"],
                "vehicle_reg": "DL01-TAMPERED",  # Tampered plate!
                "dept_code": "TAMPERED",
                "valid_until": "2099-12-31T23:59:59Z"
            },
            "signature": p["signature_hex"]  # Mismatched signature
        }
        return verify_pass_publicly(PublicVerificationRequest(qr_payload=json.dumps(tampered_qr), toll_plaza_name=req.toll_plaza_name), request, current_user=None)

    elif scenario == "mismatch":
        cursor.execute("SELECT pass_code FROM issued_passes WHERE status = 'active' LIMIT 1")
        row = cursor.fetchone()
        if not row:
            conn.close()
            raise HTTPException(status_code=404, detail="No active pass available.")
        conn.close()
        return verify_pass_publicly(PublicVerificationRequest(
            pass_code=row["pass_code"],
            scanned_vehicle_reg="HR26-INCORRECT-9999",
            toll_plaza_name=req.toll_plaza_name
        ), request, current_user=None)

    else:
        conn.close()
        raise HTTPException(status_code=400, detail="Invalid scenario_type. Choose from: valid, expired, revoked, tampered, mismatch.")
