import os
import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient

from app.main import app
from app.config import settings
from app.crypto import signer, Ed25519Signer
from app.database import adapt_sql_for_postgres, convert_placeholders, get_db_connection
from app.seed import seed_database

client = TestClient(app)

@pytest.fixture(autouse=True)
def init_clean_state():
    if settings.DATABASE_PATH.exists():
        settings.DATABASE_PATH.unlink()
    seed_database()

def test_crypto_persistence_across_restart():
    """
    Verifies that the Ed25519 signing key remains persistent across restarts
    when loaded from ED25519_PRIVATE_KEY_HEX or persistent file, preventing signature invalidation.
    """
    initial_pub_hex = signer.get_public_key_hex()
    initial_priv_hex = signer.export_private_key_raw_hex()

    # Create a test signed payload
    payload = {"pass_code": "SEVA-TEST-PERSISTENCE", "vehicle_reg": "24B 112233M"}
    canonical, signature_hex = signer.sign_payload(payload)
    assert signer.verify_payload_signature(canonical, signature_hex) is True

    # Simulate fresh application restart with the exported hex in environment
    os.environ["ED25519_PRIVATE_KEY_HEX"] = initial_priv_hex
    settings.ED25519_PRIVATE_KEY_HEX = initial_priv_hex

    new_signer_instance = Ed25519Signer()
    # The new instance must have the exact same public key
    assert new_signer_instance.get_public_key_hex() == initial_pub_hex

    # Old signature must verify cleanly under the reloaded signer
    assert new_signer_instance.verify_payload_signature(canonical, signature_hex) is True

def test_sql_adapter_parameter_conversion():
    """
    Verifies the SQL adapter correctly translates SQLite '?' placeholders
    to PostgreSQL '%s' and adapts INSERT OR IGNORE syntax.
    """
    q1 = "SELECT * FROM profiles WHERE username = ? AND is_active = 1"
    assert adapt_sql_for_postgres(q1) == "SELECT * FROM profiles WHERE username = %s AND is_active = TRUE"

    # Verifies boolean adaptation for inactive and must_change_password
    q_bool = "SELECT * FROM profiles WHERE is_active = 0 AND must_change_password = 1"
    assert adapt_sql_for_postgres(q_bool) == "SELECT * FROM profiles WHERE is_active = FALSE AND must_change_password = TRUE"

    q2 = "INSERT OR IGNORE INTO services (id, code) VALUES (?, ?)"
    assert adapt_sql_for_postgres(q2) == "INSERT INTO services (id, code) VALUES (%s, %s) ON CONFLICT DO NOTHING"

    # Defensive conversion of literal 1 in services/departments VALUES clause
    q_svc = "INSERT OR IGNORE INTO services (id, code, name, description, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)"
    adapted_svc = adapt_sql_for_postgres(q_svc)
    assert "TRUE" in adapted_svc
    assert "1" not in adapted_svc.split("VALUES")[1].split(",")[4]

    # Preserves question marks inside string literals
    q3 = "SELECT * FROM t WHERE query = 'Is this valid?' AND status = ?"
    assert adapt_sql_for_postgres(q3) == "SELECT * FROM t WHERE query = 'Is this valid?' AND status = %s"

def test_login_auth_and_session():
    """Tests authentication across all three core roles."""
    # 1. Central Admin
    res_a = client.post("/api/auth/login", json={"username_or_email": "admin", "password": "SevaAdm!n#2026$Drdo"})
    assert res_a.status_code == 200
    assert res_a.json()["role"] == "CENTRAL_ADMIN"

    # 2. Department Head
    res_h = client.post("/api/auth/login", json={"username_or_email": "head.western", "password": "WestH3ad#2026$Transit"})
    assert res_h.status_code == 200
    assert res_h.json()["role"] == "DEPARTMENT_HEAD"

    # 3. Personnel
    res_p = client.post("/api/auth/login", json={"username_or_email": "priya.sharma", "password": "PriyaPass#2026$Duty"})
    assert res_p.status_code == 200
    assert res_p.json()["role"] == "PERSONNEL"

def test_personnel_apply_department_approve_and_sign():
    """
    End-to-end test of pass application, approval, and cryptographic signing.
    """
    # 1. Personnel login
    res_p = client.post("/api/auth/login", json={"username_or_email": "priya.sharma", "password": "PriyaPass#2026$Duty"})
    token_p = res_p.json()["access_token"]

    # 2. Submit application
    from datetime import datetime, timezone, timedelta
    now = datetime.now(timezone.utc)
    app_res = client.post("/api/passes/apply", json={
        "department_id": "dept-wc-01",
        "vehicle_registration_number": "24B 119988M",
        "vehicle_type": "Light Utility",
        "journey_origin": "Chandi Mandir",
        "journey_destination": "Shimla Camp",
        "journey_purpose": "Security convoy inspection",
        "journey_date": now.strftime("%Y-%m-%d"),
        "requested_start_time": (now + timedelta(hours=1)).isoformat(),
        "requested_end_time": (now + timedelta(hours=12)).isoformat()
    }, headers={"Authorization": f"Bearer {token_p}"})
    assert app_res.status_code == 200
    app_id = app_res.json()["application_id"]

    # 3. Department Head login
    res_h = client.post("/api/auth/login", json={"username_or_email": "head.western", "password": "WestH3ad#2026$Transit"})
    token_h = res_h.json()["access_token"]

    # 4. Approve application
    approve_res = client.post("/api/passes/review", json={
        "application_id": app_id,
        "action": "approve",
        "admin_notes": "Approved for official movement"
    }, headers={"Authorization": f"Bearer {token_h}"})
    assert approve_res.status_code == 200
    pass_code = approve_res.json()["pass_code"]

    # 5. Verify issued pass publicly
    verif_res = client.post("/api/verification/verify-public", json={"pass_code": pass_code})
    assert verif_res.status_code == 200
    v_data = verif_res.json()
    assert v_data["result"] == "VALID"
    assert v_data["verification_checks"]["signature_valid"] is True

def test_department_isolation_and_idor():
    """
    Ensures a Department Head cannot approve applications for another department.
    """
    # Head Western attempts to approve Northern application 'app-arvind-01'
    res_h = client.post("/api/auth/login", json={"username_or_email": "head.western", "password": "WestH3ad#2026$Transit"})
    token_h = res_h.json()["access_token"]

    res_rogue = client.post("/api/passes/review", json={
        "application_id": "app-arvind-01",
        "action": "approve"
    }, headers={"Authorization": f"Bearer {token_h}"})
    assert res_rogue.status_code == 403
    assert "outside your assigned department" in res_rogue.json()["detail"]

def test_public_verification_scenarios():
    """Tests all anomaly verification cases."""
    # 1. Valid
    r1 = client.post("/api/verification/verify-public", json={"pass_code": "SEVA-2026-WC-1045"})
    assert r1.status_code == 200 and r1.json()["result"] == "VALID"

    # 2. Expired
    r2 = client.post("/api/verification/verify-public", json={"pass_code": "SEVA-2026-WC-3341"})
    assert r2.status_code == 200 and r2.json()["result"] == "EXPIRED"

    # 3. Revoked
    r3 = client.post("/api/verification/verify-public", json={"pass_code": "SEVA-2026-NC-7765"})
    assert r3.status_code == 200 and r3.json()["result"] == "REVOKED"

    # 4. Vehicle Mismatch
    r4 = client.post("/api/verification/verify-public", json={
        "pass_code": "SEVA-2026-WC-1045",
        "scanned_vehicle_reg": "DL01-FAKEREG-0000"
    })
    assert r4.status_code == 200 and r4.json()["result"] == "VEHICLE_MISMATCH"

    # 5. Tampered
    r5 = client.post("/api/verification/simulate-scenario", json={"scenario_type": "tampered"})
    assert r5.status_code == 200 and r5.json()["result"] == "INVALID"
