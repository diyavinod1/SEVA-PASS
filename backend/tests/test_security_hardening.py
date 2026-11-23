import os
import json
import uuid
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.auth import create_access_token
from app.database import get_db_connection
from app.config import settings

client = TestClient(app)

try:
    import psycopg2
    PSYCOPG2_AVAILABLE = True
except ImportError:
    PSYCOPG2_AVAILABLE = False

HAS_POSTGRES = bool(settings.DATABASE_URL) and PSYCOPG2_AVAILABLE

# ==============================================================================
# 1. PUBLIC DIAGNOSTIC ENDPOINT ACCESS CONTROL TESTS
# ==============================================================================
def test_public_health_endpoint_minimal_disclosure():
    """Verify that public /api/health exposes only minimal monitoring info."""
    resp = client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "operational"
    assert "service" in data
    # Sensitive internals MUST NOT be exposed publicly
    assert "database_engine" not in data
    assert "supabase_configured" not in data
    assert "key_id" not in data
    assert "cryptography" not in data

def test_config_status_requires_central_admin():
    """Verify that /api/config/status rejects anonymous and non-admin requests."""
    # Anonymous -> 401
    anon_resp = client.get("/api/config/status")
    assert anon_resp.status_code == 401

    # Personnel User -> 403
    pers_token = create_access_token({"sub": "user-priya-01", "role": "PERSONNEL"})
    pers_resp = client.get("/api/config/status", headers={"Authorization": f"Bearer {pers_token}"})
    assert pers_resp.status_code == 403

    # Department Head User -> 403
    head_token = create_access_token({"sub": "user-head-wc-01", "role": "DEPARTMENT_HEAD"})
    head_resp = client.get("/api/config/status", headers={"Authorization": f"Bearer {head_token}"})
    assert head_resp.status_code == 403

    # Central Admin -> 200
    admin_token = create_access_token({"sub": "user-admin-01", "role": "CENTRAL_ADMIN"})
    admin_resp = client.get("/api/config/status", headers={"Authorization": f"Bearer {admin_token}"})
    assert admin_resp.status_code == 200
    assert "environment" in admin_resp.json()

def test_supabase_status_requires_central_admin():
    """Verify that /api/supabase/status rejects anonymous and non-admin requests."""
    # Anonymous -> 401
    anon_resp = client.get("/api/supabase/status")
    assert anon_resp.status_code == 401

    # Personnel User -> 403
    pers_token = create_access_token({"sub": "user-priya-01", "role": "PERSONNEL"})
    pers_resp = client.get("/api/supabase/status", headers={"Authorization": f"Bearer {pers_token}"})
    assert pers_resp.status_code == 403

    # Central Admin -> 200
    admin_token = create_access_token({"sub": "user-admin-01", "role": "CENTRAL_ADMIN"})
    admin_resp = client.get("/api/supabase/status", headers={"Authorization": f"Bearer {admin_token}"})
    assert admin_resp.status_code == 200

# ==============================================================================
# 2. DEPARTMENT PROVISIONING TRANSACTIONALITY TESTS
# ==============================================================================
def test_department_provisioning_duplicate_code_rejected():
    admin_token = create_access_token({"sub": "user-admin-01", "role": "CENTRAL_ADMIN"})
    resp = client.post("/api/departments/", json={
        "name": "Duplicate Code Formation",
        "code": "WC-ARMY",  # Existing code
        "service_id": "srv-army-01",
        "category": "Command"
    }, headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 400
    assert "already exists" in resp.json()["detail"]

def test_department_provisioning_duplicate_head_atomic_rollback():
    admin_token = create_access_token({"sub": "user-admin-01", "role": "CENTRAL_ADMIN"})
    test_dept_code = f"ROLLBACK-{uuid.uuid4().hex[:4].upper()}"
    resp = client.post("/api/departments/", json={
        "name": "Rollback Test Formation",
        "code": test_dept_code,
        "service_id": "srv-army-01",
        "category": "Command",
        "head_username": "priya.sharma"  # Existing username
    }, headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 400
    assert "already in use" in resp.json()["detail"]

    # Verify atomic rollback: department was not created
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT id FROM departments WHERE code = ?", (test_dept_code,))
    assert cur.fetchone() is None
    conn.close()

def test_department_provisioning_invalid_service_fk_rollback():
    admin_token = create_access_token({"sub": "user-admin-01", "role": "CENTRAL_ADMIN"})
    resp = client.post("/api/departments/", json={
        "name": "Invalid Service Formation",
        "code": "INV-SRV",
        "service_id": "srv-nonexistent-999",
        "category": "Command"
    }, headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 400
    assert "does not exist" in resp.json()["detail"]

# ==============================================================================
# 3. CRYPTOGRAPHIC VERIFICATION INTEGRITY TESTS
# ==============================================================================
def test_cryptographic_verification_tamper_and_unknown_key():
    admin_token = create_access_token({"sub": "user-admin-01", "role": "CENTRAL_ADMIN"})
    qr_valid = client.get("/api/passes/pass-priya-01", headers={"Authorization": f"Bearer {admin_token}"}).json()["pass"]
    cred = json.loads(qr_valid["qr_payload_encoded"])

    # 1. Authentic pass -> VALID
    r1 = client.post("/api/verification/verify-public", json={"pass_code": "SEVA-2026-WC-1045"})
    assert r1.json()["result"] == "VALID"

    # 2. Tampered signature -> INVALID
    tampered_sig_cred = dict(cred)
    tampered_sig_cred["signature"] = "b" * 128
    r2 = client.post("/api/verification/verify-public", json={"qr_payload": json.dumps(tampered_sig_cred)})
    assert r2.json()["result"] == "INVALID"
    assert "signature check failed" in r2.json()["message"].lower()

    # 3. Unknown key identifier -> INVALID
    unknown_key_cred = dict(cred)
    unknown_key_cred["key_id"] = "unknown-foreign-key-id"
    r3 = client.post("/api/verification/verify-public", json={"qr_payload": json.dumps(unknown_key_cred)})
    assert r3.json()["result"] == "INVALID"
    assert "untrusted" in r3.json()["message"].lower()

    # 4. Malformed signature encoding -> INVALID
    malformed_cred = dict(cred)
    malformed_cred["signature"] = "bad123"
    r4 = client.post("/api/verification/verify-public", json={"qr_payload": json.dumps(malformed_cred)})
    assert r4.json()["result"] == "INVALID"
    assert "malformed" in r4.json()["message"].lower()

    # 5. Revoked pass -> REVOKED
    r5 = client.post("/api/verification/verify-public", json={"pass_code": "SEVA-2026-NC-7765"})
    assert r5.json()["result"] == "REVOKED"

    # 6. Expired pass -> EXPIRED
    r6 = client.post("/api/verification/verify-public", json={"pass_code": "SEVA-2026-WC-3341"})
    assert r6.json()["result"] == "EXPIRED"

    # 7. Observed toll vehicle mismatch -> VEHICLE_MISMATCH
    r7 = client.post("/api/verification/verify-public", json={"pass_code": "SEVA-2026-WC-1045", "scanned_vehicle_reg": "KA 01 ZZ 9999"})
    assert r7.json()["result"] == "VEHICLE_MISMATCH"

    # 8. Registry field divergence detection (altered journey origin)
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("UPDATE issued_passes SET journey_origin = 'ALTERED_ORIGIN' WHERE pass_code = 'SEVA-2026-WC-1045'")
    conn.commit()

    r8 = client.post("/api/verification/verify-public", json={"pass_code": "SEVA-2026-WC-1045"})
    assert r8.json()["result"] == "INVALID"
    assert "integrity violation" in r8.json()["message"].lower()

    # Restore original journey origin
    cur.execute("UPDATE issued_passes SET journey_origin = 'Western Command HQ, Chandimandir' WHERE pass_code = 'SEVA-2026-WC-1045'")
    conn.commit()
    conn.close()

# ==============================================================================
# 4. DATABASE-ENFORCED AUDIT LOG APPEND-ONLY TESTS (POSTGRESQL LIVE)
# ==============================================================================
@pytest.mark.skipif(not HAS_POSTGRES, reason="Requires live PostgreSQL connection to test PostgreSQL triggers")
def test_postgres_live_audit_log_append_only():
    conn = psycopg2.connect(settings.DATABASE_URL)
    cur = conn.cursor()

    # Verify zero privileges granted to authenticated or anon
    cur.execute("""
        SELECT grantee, privilege_type 
        FROM information_schema.role_table_grants 
        WHERE table_name = 'audit_logs' AND grantee IN ('authenticated', 'anon');
    """)
    untrusted_grants = cur.fetchall()
    assert len(untrusted_grants) == 0, f"Untrusted API roles should have 0 grants, found: {untrusted_grants}"

    test_id = f"test-audit-{uuid.uuid4().hex[:8]}"
    
    # 1. INSERT succeeds
    cur.execute("""
        INSERT INTO audit_logs (id, event_type, actor_id, actor_email, actor_role, entity_type, entity_id, outcome, details)
        VALUES (%s, 'INTEGRATION_TEST', 'tester', 'test@mil.in', 'TESTER', 'AUDIT_TEST', 'none', 'SUCCESS', '{"test": true}')
    """, (test_id,))
    conn.commit()

    # 2. SELECT succeeds
    cur.execute("SELECT id, outcome FROM audit_logs WHERE id = %s;", (test_id,))
    row = cur.fetchone()
    assert row is not None
    assert row[1] == "SUCCESS"

    # 3. UPDATE fails with trigger exception
    with pytest.raises(Exception) as exc_update:
        cur.execute("UPDATE audit_logs SET outcome = 'TAMPERED' WHERE id = %s;", (test_id,))
        conn.commit()
    conn.rollback()
    assert "append-only" in str(exc_update.value).lower()

    # 4. DELETE fails with trigger exception
    with pytest.raises(Exception) as exc_delete:
        cur.execute("DELETE FROM audit_logs WHERE id = %s;", (test_id,))
        conn.commit()
    conn.rollback()
    assert "append-only" in str(exc_delete.value).lower()

    # 5. TRUNCATE fails with trigger exception
    with pytest.raises(Exception) as exc_truncate:
        cur.execute("TRUNCATE TABLE audit_logs;")
        conn.commit()
    conn.rollback()
    assert "append-only" in str(exc_truncate.value).lower()

    conn.close()
