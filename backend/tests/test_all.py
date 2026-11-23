import json
import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from app.main import app
from app.config import settings
from app.seed import seed_database
from app.crypto import signer

client = TestClient(app)

@pytest.fixture(autouse=True)
def reset_db():
    if settings.DATABASE_PATH.exists():
        settings.DATABASE_PATH.unlink()
    seed_database()

# 1. Universal Single Login across all roles without role selector
def test_universal_login_all_roles():
    # Central Admin
    res_admin = client.post("/api/auth/login", json={
        "username_or_email": "admin",
        "password": "SevaAdmin@2026#Secure"
    })
    assert res_admin.status_code == 200, res_admin.text
    data_admin = res_admin.json()
    assert data_admin["role"] == "CENTRAL_ADMIN"
    assert data_admin["redirect_path"] == "/admin"
    assert "access_token" in data_admin

    # Department Head
    res_head = client.post("/api/auth/login", json={
        "username_or_email": "head.western",
        "password": "HeadWestern@2026"
    })
    assert res_head.status_code == 200
    data_head = res_head.json()
    assert data_head["role"] == "DEPARTMENT_HEAD"
    assert data_head["redirect_path"] == "/department"

    # Personnel
    res_pers = client.post("/api/auth/login", json={
        "username_or_email": "priya.sharma",
        "password": "Member@2026"
    })
    assert res_pers.status_code == 200
    data_pers = res_pers.json()
    assert data_pers["role"] == "PERSONNEL"
    assert data_pers["redirect_path"] == "/personnel"

# 2. Personnel Registration
def test_personnel_registration():
    reg_payload = {
        "username": "kavita.sen",
        "email": "kavita.sen@sevapass.internal",
        "password": "SecurePassword@2026",
        "confirm_password": "SecurePassword@2026",
        "full_name": "Major Kavita Sen",
        "service_category": "Army",
        "service_number": "IC-88990Z",
        "rank": "Major",
        "phone": "+91 99999 11111",
        "assigned_department_id": "dept-wc-01"
    }
    res = client.post("/api/auth/register-personnel", json=reg_payload)
    assert res.status_code == 200, res.text
    assert res.json()["status"] == "success"

    # Duplicate username prevention
    res_dup = client.post("/api/auth/register-personnel", json=reg_payload)
    assert res_dup.status_code == 400
    assert "username is already registered" in res_dup.json()["detail"]

# 3. Personnel Submits Pass Application & Views Applications
def test_personnel_pass_application_lifecycle():
    # Login as Priya Sharma
    res_login = client.post("/api/auth/login", json={"username_or_email": "priya.sharma", "password": "Member@2026"})
    token = res_login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Submit application
    app_payload = {
        "department_id": "dept-wc-01",
        "vehicle_registration_number": "24B 987654M",
        "vehicle_type": "Light Utility Tactical",
        "journey_origin": "Chandi Mandir",
        "journey_destination": "Kalka Sub-Depot",
        "journey_purpose": "Equipment routine service",
        "journey_date": "2026-11-23",
        "requested_start_time": "2026-11-23T08:00:00Z",
        "requested_end_time": "2026-11-23T18:00:00Z",
        "eligibility_basis": "Section 3(1)(a) Indian Tolls (Army and Air Force) Act 1901"
    }
    res_app = client.post("/api/passes/apply", json=app_payload, headers=headers)
    assert res_app.status_code == 200, res_app.text
    app_id = res_app.json()["application_id"]

    # View my applications
    res_my_apps = client.post if False else client.get("/api/passes/my-applications", headers=headers)
    assert res_my_apps.status_code == 200
    apps = res_my_apps.json()["applications"]
    assert any(a["id"] == app_id for a in apps)

# 4. Department Head Reviews & Approves Application with Ed25519 Signature
def test_department_head_approval_and_ed25519_issuance():
    # Personnel submits application
    res_login_p = client.post("/api/auth/login", json={"username_or_email": "priya.sharma", "password": "Member@2026"})
    p_headers = {"Authorization": f"Bearer {res_login_p.json()['access_token']}"}

    app_res = client.post("/api/passes/apply", json={
        "department_id": "dept-wc-01",
        "vehicle_registration_number": "23D 554433X",
        "vehicle_type": "Light Staff Vehicle",
        "journey_origin": "Chandi Mandir",
        "journey_destination": "Shimla Transit Hub",
        "journey_purpose": "Operational inspection",
        "journey_date": "2026-11-24",
        "requested_start_time": "2026-11-24T06:00:00Z",
        "requested_end_time": "2026-11-24T20:00:00Z"
    }, headers=p_headers)
    app_id = app_res.json()["application_id"]

    # Login as Western Command Head
    res_login_h = client.post("/api/auth/login", json={"username_or_email": "head.western", "password": "HeadWestern@2026"})
    h_headers = {"Authorization": f"Bearer {res_login_h.json()['access_token']}"}

    # Head approves application
    approve_res = client.post("/api/passes/review", json={
        "application_id": app_id,
        "action": "approve",
        "admin_notes": "Authorised for official command inspection"
    }, headers=h_headers)
    assert approve_res.status_code == 200, approve_res.text
    pass_code = approve_res.json()["pass_code"]
    assert pass_code.startswith("SEVA-2026-WC-")

    # Verify pass is now public and valid
    verif_res = client.post("/api/verification/verify-public", json={"pass_code": pass_code})
    assert verif_res.status_code == 200
    v_data = verif_res.json()
    assert v_data["result"] == "VALID"
    assert v_data["verification_checks"]["signature_valid"] is True

# 5. Cross-Department Isolation (IDOR Prevention)
def test_cross_department_isolation():
    # Arvind has pending application in Northern Command (dept-nc-01)
    res_login_nc = client.post("/api/auth/login", json={"username_or_email": "arvind.deshmukh", "password": "Member@2026"})
    arvind_headers = {"Authorization": f"Bearer {res_login_nc.json()['access_token']}"}

    app_res = client.post("/api/passes/apply", json={
        "department_id": "dept-nc-01",
        "vehicle_registration_number": "22D 112233P",
        "vehicle_type": "Escort Jeep",
        "journey_origin": "Udhampur",
        "journey_destination": "Jammu",
        "journey_purpose": "Official convoy",
        "journey_date": "2026-11-25",
        "requested_start_time": "2026-11-25T07:00:00Z",
        "requested_end_time": "2026-11-25T19:00:00Z"
    }, headers=arvind_headers)
    app_id = app_res.json()["application_id"]

    # Western Head tries to approve Northern Command application!
    res_login_wc = client.post("/api/auth/login", json={"username_or_email": "head.western", "password": "HeadWestern@2026"})
    wc_headers = {"Authorization": f"Bearer {res_login_wc.json()['access_token']}"}

    rogue_approve = client.post("/api/passes/review", json={
        "application_id": app_id,
        "action": "approve"
    }, headers=wc_headers)

    # Must be FORBIDDEN 403!
    assert rogue_approve.status_code == 403
    assert "outside your assigned department" in rogue_approve.json()["detail"]

# 6. Rejection Requires a Reason
def test_rejection_requires_reason():
    res_login_h = client.post("/api/auth/login", json={"username_or_email": "head.northern", "password": "HeadNorthern@2026"})
    h_headers = {"Authorization": f"Bearer {res_login_h.json()['access_token']}"}

    # Reject without reason should fail
    res_fail = client.post("/api/passes/review", json={
        "application_id": "app-arvind-01",
        "action": "reject",
        "rejection_reason": ""
    }, headers=h_headers)
    assert res_fail.status_code == 400
    assert "rejection reason is strictly required" in res_fail.json()["detail"]

    # Reject with valid reason should succeed
    res_ok = client.post("/api/passes/review", json={
        "application_id": "app-arvind-01",
        "action": "reject",
        "rejection_reason": "Route closed due to landslide between Ramban and Banihal"
    }, headers=h_headers)
    assert res_ok.status_code == 200
    assert res_ok.json()["status"] == "success"

# 7. Public Verification of Active, Expired, Revoked, and Tampered Passes
def test_public_qr_verification_scenarios():
    # 7.1 Valid Pass (Priya Sharma's seeded pass: SEVA-2026-WC-1045)
    res_valid = client.post("/api/verification/verify-public", json={"pass_code": "SEVA-2026-WC-1045"})
    assert res_valid.status_code == 200
    v1 = res_valid.json()
    assert v1["result"] == "VALID"
    assert v1["verification_checks"]["signature_valid"] is True
    # Ensure sensitive PII is NOT exposed in public response!
    assert "service_number" not in v1["pass_data"]
    assert "phone" not in v1["pass_data"]
    assert "password" not in v1["pass_data"]

    # 7.2 Expired Pass (SEVA-2026-WC-3341)
    res_exp = client.post("/api/verification/verify-public", json={"pass_code": "SEVA-2026-WC-3341"})
    assert res_exp.status_code == 200
    v2 = res_exp.json()
    assert v2["result"] == "EXPIRED"

    # 7.3 Revoked Pass (SEVA-2026-NC-7765)
    res_rev = client.post("/api/verification/verify-public", json={"pass_code": "SEVA-2026-NC-7765"})
    assert res_rev.status_code == 200
    v3 = res_rev.json()
    assert v3["result"] == "REVOKED"
    assert "Operational Cancellation" in v3["message"] or "weather closure" in v3["message"]

    # 7.4 Tampered Payload (modified vehicle number fails cryptographic signature)
    tampered_sim = client.post("/api/verification/simulate-scenario", json={"scenario_type": "tampered"})
    assert tampered_sim.status_code == 200
    v4 = tampered_sim.json()
    assert v4["result"] == "INVALID"
    assert v4["verification_checks"]["signature_valid"] is False

    # 7.5 Vehicle Mismatch
    res_mismatch = client.post("/api/verification/verify-public", json={
        "pass_code": "SEVA-2026-WC-1045",
        "scanned_vehicle_reg": "DL01-FAKEREG-0000"
    })
    assert res_mismatch.status_code == 200
    v5 = res_mismatch.json()
    assert v5["result"] == "VEHICLE_MISMATCH"

# 8. Revocation by Authorized Department Head
def test_pass_revocation_lifecycle():
    res_login_h = client.post("/api/auth/login", json={"username_or_email": "head.western", "password": "HeadWestern@2026"})
    h_headers = {"Authorization": f"Bearer {res_login_h.json()['access_token']}"}

    rev_res = client.post("/api/passes/revoke", json={
        "pass_id": "pass-priya-01",
        "reason": "Movement mission rescheduled by army headquarters",
        "category": "Administrative Rescheduling"
    }, headers=h_headers)
    assert rev_res.status_code == 200, rev_res.text

    # Now verify this pass publicly -> MUST return REVOKED!
    verif = client.post("/api/verification/verify-public", json={"pass_code": "SEVA-2026-WC-1045"})
    assert verif.status_code == 200
    assert verif.json()["result"] == "REVOKED"

# 9. Central Admin Overview Metrics are DB-Derived
def test_central_admin_metrics():
    res_admin = client.post("/api/auth/login", json={"username_or_email": "admin", "password": "SevaAdmin@2026#Secure"})
    admin_headers = {"Authorization": f"Bearer {res_admin.json()['access_token']}"}

    res_stats = client.get("/api/stats/admin-overview", headers=admin_headers)
    assert res_stats.status_code == 200
    data = res_stats.json()
    metrics = data["metrics"]
    assert metrics["total_departments"] >= 4
    assert metrics["total_personnel"] >= 3
    assert metrics["total_applications"] >= 4
    assert len(data["department_stats"]) >= 4
