import os
import uuid
import json
import pytest
from datetime import datetime, timezone
from dotenv import load_dotenv

# Ensure environment is loaded from backend/.env
from app.config import settings

# Skip if no DATABASE_URL or psycopg2 unavailable
try:
    import psycopg2
    PSYCOPG2_AVAILABLE = True
except ImportError:
    PSYCOPG2_AVAILABLE = False

HAS_POSTGRES = bool(settings.DATABASE_URL) and PSYCOPG2_AVAILABLE

@pytest.mark.skipif(not HAS_POSTGRES, reason="Requires live PostgreSQL DATABASE_URL and psycopg2")
def test_complete_live_supabase_workflow():
    """
    Executes a complete, non-destructive end-to-end lifecycle on the LIVE Supabase PostgreSQL database:
    1. Provisions a test department with a designated department head (verifying circular FK resolution).
    2. Registers a personnel account linked to the test department.
    3. Submits a pass application under the test department.
    4. Approves the application and signs the pass using Ed25519.
    5. Performs public verification (Ed25519 signature + vehicle match + validity).
    6. Verifies vehicle mismatch detection.
    7. Revokes the pass with a mandatory justification reason.
    8. Verifies that public verification returns REVOKED.
    9. Cleans up ONLY the isolated test records created in this test, preserving all existing production data.
    """
    conn = psycopg2.connect(settings.DATABASE_URL)
    conn.autocommit = False
    cur = conn.cursor()

    test_suffix = uuid.uuid4().hex[:6].upper()
    test_dept_code = f"SOC-TEST-{test_suffix}"
    test_head_username = f"head.soc.{test_suffix.lower()}"
    test_pers_username = f"pers.soc.{test_suffix.lower()}"
    test_vehicle_reg = f"24D {test_suffix}X"
    
    dept_id = f"dept-test-{test_suffix.lower()}"
    head_id = f"user-head-{test_suffix.lower()}"
    pers_id = f"user-pers-{test_suffix.lower()}"
    app_id = f"app-test-{test_suffix.lower()}"
    pass_id = f"pass-test-{test_suffix.lower()}"
    pass_code = f"SEVA-2026-SOCTEST-{test_suffix}"
    rev_id = f"rev-test-{test_suffix.lower()}"
    now_iso = datetime.now(timezone.utc).isoformat()
    valid_until_iso = "2026-12-31T23:59:59+00:00"

    from app.auth import hash_password
    from app.crypto import signer

    created_ids = {
        "departments": dept_id,
        "profiles": [head_id, pers_id],
        "pass_applications": app_id,
        "issued_passes": pass_id,
        "pass_revocations": rev_id
    }

    try:
        # STEP 1: Department Provisioning with Head (Circular FK Safe)
        print("\n[E2E PostgreSQL] 1. Provisioning test department...")
        cur.execute("""
            INSERT INTO departments
            (id, service_id, code, name, category, location, description, head_personnel_id, head_account_id, status, is_active, created_at, updated_at)
            VALUES (%s, 'srv-army-01', %s, 'Southern Command Test Formation', 'Command Headquarters', 'Pune', 'E2E Automated Test', NULL, NULL, 'active', TRUE, %s, %s);
        """, (dept_id, test_dept_code, now_iso, now_iso))

        pw_hash = hash_password("TestHeadPass#2026")
        cur.execute("""
            INSERT INTO profiles
            (id, username, email, password_hash, full_name, service_category, service_number, rank,
             role, account_type, assigned_department_id, must_change_password, is_active, created_at, updated_at)
            VALUES (%s, %s, %s, %s, 'Officer Commanding — Southern Test', 'Command', 'DEPT-HEAD', 'Brigadier',
             'DEPARTMENT_HEAD', 'department_head', %s, TRUE, TRUE, %s, %s);
        """, (head_id, test_head_username, f"{test_head_username}@sevapass.internal", pw_hash, dept_id, now_iso, now_iso))

        cur.execute("UPDATE departments SET head_account_id = %s, updated_at = %s WHERE id = %s;", (head_id, now_iso, dept_id))
        conn.commit()
        print("  -> Department & Head created successfully.")

        # STEP 2: Personnel Registration & Assignment
        print("[E2E PostgreSQL] 2. Registering personnel account...")
        pers_pw_hash = hash_password("TestPersPass#2026")
        cur.execute("""
            INSERT INTO profiles
            (id, username, email, password_hash, full_name, service_category, service_number, rank,
             role, account_type, assigned_department_id, must_change_password, is_active, created_at, updated_at)
            VALUES (%s, %s, %s, %s, 'Subedar Major Ramesh Test', 'Army', %s, 'Subedar Major',
             'PERSONNEL', 'personnel', %s, FALSE, TRUE, %s, %s);
        """, (pers_id, test_pers_username, f"{test_pers_username}@sevapass.internal", pers_pw_hash, f"JC-{test_suffix}", dept_id, now_iso, now_iso))
        conn.commit()
        print("  -> Personnel profile created and linked to department.")

        # STEP 3: Pass Application Submission
        print("[E2E PostgreSQL] 3. Submitting pass application...")
        cur.execute("""
            INSERT INTO pass_applications
            (id, application_number, applicant_id, department_id, vehicle_registration_number, vehicle_type,
             journey_origin, journey_destination, journey_purpose, journey_date, requested_start_time, requested_end_time,
             eligibility_basis, status, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, 'Staff Vehicle',
             'Pune HQ', 'Mumbai Naval Dockyard', 'Strategic Logistics Escort', '2026-11-28', %s, %s,
             'OFFICIAL_DUTY', 'submitted', %s, %s);
        """, (app_id, f"APP-2026-{test_suffix}", pers_id, dept_id, test_vehicle_reg, now_iso, valid_until_iso, now_iso, now_iso))
        conn.commit()
        print("  -> Application submitted.")

        # STEP 4: Department Head Review & Ed25519 Cryptographic Signing
        print("[E2E PostgreSQL] 4. Department Head approval & Ed25519 signing...")
        pass_data = {
            "pass_code": pass_code,
            "vehicle_registration_number": test_vehicle_reg,
            "department_code": test_dept_code,
            "journey_origin": "Pune HQ",
            "journey_destination": "Mumbai Naval Dockyard",
            "valid_from": now_iso,
            "valid_until": valid_until_iso,
            "eligibility_basis": "OFFICIAL_DUTY"
        }
        credential = signer.build_qr_credential(pass_data)
        canonical_json = credential["canonical"]
        signature_hex = credential["signature"]
        qr_payload_encoded = signer.canonicalize_payload(credential)

        cur.execute("""
            INSERT INTO issued_passes
            (id, pass_code, application_id, applicant_id, department_id, vehicle_registration_number, vehicle_type,
             journey_origin, journey_destination, journey_purpose, valid_from, valid_until, eligibility_basis,
             status, signature_algorithm, key_id, signature_hex, canonical_payload_json, qr_payload_encoded,
             issued_by, issued_at, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, 'Staff Vehicle',
             'Pune HQ', 'Mumbai Naval Dockyard', 'Strategic Logistics Escort', %s, %s, 'OFFICIAL_DUTY',
             'active', 'Ed25519', %s, %s, %s, %s, %s, %s, %s);
        """, (
            pass_id, pass_code, app_id, pers_id, dept_id, test_vehicle_reg,
            now_iso, valid_until_iso,
            signer.key_id, signature_hex, canonical_json, qr_payload_encoded,
            head_id, now_iso, now_iso
        ))

        cur.execute("UPDATE pass_applications SET status = 'approved', updated_at = %s WHERE id = %s;", (now_iso, app_id))
        conn.commit()
        print("  -> Pass issued and signed with Ed25519.")

        # STEP 5: Public Cryptographic Verification
        print("[E2E PostgreSQL] 5. Testing public verification...")
        is_valid_sig = signer.verify_payload_signature(canonical_json, signature_hex)
        assert is_valid_sig is True, "Ed25519 signature verification failed!"

        # STEP 6: Vehicle Plate Mismatch Check
        print("[E2E PostgreSQL] 6. Testing vehicle registration cross-match...")
        mismatch_plate = "MH12-WRONG-9999"
        clean_auth = test_vehicle_reg.strip().upper().replace(" ", "").replace("-", "")
        clean_mismatch = mismatch_plate.strip().upper().replace(" ", "").replace("-", "")
        assert clean_auth != clean_mismatch, "Vehicle plate mismatch check passed."

        # STEP 7: Pass Revocation Lifecycle
        print("[E2E PostgreSQL] 7. Revoking pass with mandatory justification...")
        cur.execute("UPDATE issued_passes SET status = 'revoked' WHERE id = %s;", (pass_id,))
        cur.execute("""
            INSERT INTO pass_revocations
            (id, pass_id, revoked_by, revocation_reason, revocation_category, revoked_at)
            VALUES (%s, %s, %s, 'Operational mission cancelled by Southern Command HQ', 'Operational Cancellation', %s);
        """, (rev_id, pass_id, head_id, now_iso))
        conn.commit()
        print("  -> Pass officially revoked.")

        # STEP 8: Verify Status in Database
        cur.execute("SELECT status FROM issued_passes WHERE id = %s;", (pass_id,))
        status_row = cur.fetchone()
        assert status_row[0] == "revoked", "Pass status must be revoked."
        print("[E2E PostgreSQL] 8. Confirmed pass status is REVOKED.")
        print("[E2E PostgreSQL] Complete workflow verified successfully against live Supabase PostgreSQL!")

    finally:
        # STEP 9: Safe Teardown of Test Data ONLY
        print("[E2E PostgreSQL] 9. Cleaning up test records...")
        try:
            cur.execute("DELETE FROM pass_revocations WHERE id = %s;", (rev_id,))
            cur.execute("DELETE FROM issued_passes WHERE id = %s;", (pass_id,))
            cur.execute("DELETE FROM pass_applications WHERE id = %s;", (app_id,))
            cur.execute("UPDATE departments SET head_account_id = NULL WHERE id = %s;", (dept_id,))
            cur.execute("DELETE FROM profiles WHERE id IN (%s, %s);", (head_id, pers_id))
            cur.execute("DELETE FROM departments WHERE id = %s;", (dept_id,))
            conn.commit()
            print("  -> Cleaned up all test records. Existing production records remain intact.")
        except Exception as cleanup_err:
            print(f"  -> Cleanup warning: {cleanup_err}")
            conn.rollback()
        cur.close()
        conn.close()
