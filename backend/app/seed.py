import uuid
from datetime import datetime, timezone, timedelta
from app.config import settings
from app.database import get_db_connection, init_db, log_audit
from app.auth import hash_password
from app.crypto import signer

def seed_database():
    """
    Seeds a clean, reproducible synthetic test environment.
    All records are clearly labelled synthetic demo entities.
    """
    init_db()

    conn = get_db_connection()
    cursor = conn.cursor()

    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()

    # 1. Services
    services_data = [
        {"id": "srv-army-01", "code": "ARMY", "name": "Indian Army", "desc": "Ground military force"},
        {"id": "srv-navy-01", "code": "NAVY", "name": "Indian Navy", "desc": "Maritime military force"},
        {"id": "srv-af-01", "code": "AIRFORCE", "name": "Indian Air Force", "desc": "Air warfare service"}
    ]
    for s in services_data:
        cursor.execute("""
            INSERT OR IGNORE INTO services (id, code, name, description, is_active, created_at, updated_at)
            VALUES (?, ?, ?, ?, 1, ?, ?)
        """, (s["id"], s["code"], s["name"], s["desc"], now_iso, now_iso))

    # 2. Central Admin Account
    admin_id = "user-admin-01"
    admin_pw_hash = hash_password(settings.DEFAULT_ADMIN_PASSWORD)
    cursor.execute("""
        INSERT OR IGNORE INTO profiles
        (id, username, email, password_hash, full_name, service_category, service_number, rank,
         role, account_type, status, must_change_password, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'Central Platform Administrator', 'Command', 'ADMIN-001', 'Chief Administrator',
         'CENTRAL_ADMIN', 'central_admin', 'active', 0, 1, ?, ?)
    """, (
        admin_id,
        settings.DEFAULT_ADMIN_USERNAME,
        settings.DEFAULT_ADMIN_EMAIL,
        admin_pw_hash,
        now_iso,
        now_iso
    ))

    # 3. Formations / Departments
    depts_data = [
        {
            "id": "dept-wc-01",
            "service_id": "srv-army-01",
            "code": "WC-ARMY",
            "name": "Western Command (HQ Chandi Mandir)",
            "category": "Command Headquarters",
            "location": "Chandi Mandir, Haryana",
            "desc": "Western operational theater command"
        },
        {
            "id": "dept-nc-01",
            "service_id": "srv-army-01",
            "code": "NC-ARMY",
            "name": "Northern Command (HQ Udhampur)",
            "category": "Command Headquarters",
            "location": "Udhampur, J&K",
            "desc": "Northern strategic theater command"
        },
        {
            "id": "dept-ec-01",
            "service_id": "srv-army-01",
            "code": "EC-ARMY",
            "name": "Eastern Command (HQ Fort William)",
            "category": "Command Headquarters",
            "location": "Kolkata, West Bengal",
            "desc": "Eastern operational theater command"
        },
        {
            "id": "dept-cac-01",
            "service_id": "srv-af-01",
            "code": "CAC-AF",
            "name": "Central Air Command (HQ Prayagraj)",
            "category": "Air Command",
            "location": "Prayagraj, Uttar Pradesh",
            "desc": "Central air defense command"
        }
    ]

    for d in depts_data:
        cursor.execute("""
            INSERT OR IGNORE INTO departments
            (id, service_id, code, name, category, location, description, status, is_active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 1, ?, ?)
        """, (d["id"], d["service_id"], d["code"], d["name"], d["category"], d["location"], d["desc"], now_iso, now_iso))

    # 4. Personnel Officers
    personnel_pw_hash = hash_password("Member@2026")
    personnel_list = [
        {
            "id": "user-priya-01",
            "username": "priya.sharma",
            "email": "priya.sharma@sevapass.internal",
            "name": "Major Priya Sharma",
            "service_category": "Army",
            "service_number": "IC-72418M",
            "rank": "Major",
            "phone": "+91 98110 22345",
            "dept_id": "dept-wc-01"
        },
        {
            "id": "user-arvind-01",
            "username": "arvind.deshmukh",
            "email": "arvind.deshmukh@sevapass.internal",
            "name": "Lt. Col. Arvind Deshmukh",
            "service_category": "Army",
            "service_number": "IC-68192X",
            "rank": "Lieutenant Colonel",
            "phone": "+91 98220 33456",
            "dept_id": "dept-nc-01"
        },
        {
            "id": "user-devendra-01",
            "username": "devendra.singh",
            "email": "devendra.singh@sevapass.internal",
            "name": "Captain Devendra Singh",
            "service_category": "Army",
            "service_number": "IC-79014A",
            "rank": "Captain",
            "phone": "+91 98450 77890",
            "dept_id": "dept-wc-01"
        }
    ]

    for p in personnel_list:
        cursor.execute("""
            INSERT OR IGNORE INTO profiles
            (id, username, email, password_hash, full_name, service_category, service_number, rank, phone,
             role, account_type, assigned_department_id, status, must_change_password, is_active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PERSONNEL', 'personnel', ?, 'active', 0, 1, ?, ?)
        """, (
            p["id"], p["username"], p["email"], personnel_pw_hash, p["name"],
            p["service_category"], p["service_number"], p["rank"], p["phone"],
            p["dept_id"], now_iso, now_iso
        ))

    # 5. Department Heads
    heads_data = [
        {
            "id": "user-head-wc-01",
            "username": "head.western",
            "email": "head.western@sevapass.internal",
            "password": "HeadWestern@2026",
            "name": "Maj. Gen. Rajesh Nair (Western Head)",
            "dept_id": "dept-wc-01",
            "officer_id": "user-devendra-01"
        },
        {
            "id": "user-head-nc-01",
            "username": "head.northern",
            "email": "head.northern@sevapass.internal",
            "password": "HeadNorthern@2026",
            "name": "Brig. Vikram Bakshi (Northern Head)",
            "dept_id": "dept-nc-01",
            "officer_id": "user-arvind-01"
        }
    ]

    for h in heads_data:
        h_pw_hash = hash_password(h["password"])
        cursor.execute("""
            INSERT OR IGNORE INTO profiles
            (id, username, email, password_hash, full_name, service_category, service_number, rank,
             role, account_type, assigned_department_id, linked_personnel_id, status, must_change_password, is_active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 'Command', 'HEAD-AUTH', 'Department Head',
             'DEPARTMENT_HEAD', 'department_head', ?, ?, 'active', 0, 1, ?, ?)
        """, (
            h["id"], h["username"], h["email"], h_pw_hash, h["name"],
            h["dept_id"], h["officer_id"], now_iso, now_iso
        ))
        # Bind department to this head account
        cursor.execute("""
            UPDATE departments
            SET head_account_id = ?, head_personnel_id = ?
            WHERE id = ?
        """, (h["id"], h["officer_id"], h["dept_id"]))

    # 6. Pass Applications and Digitally Signed Issued Passes
    # Case 1: Active Valid Pass for Priya Sharma (Western Command)
    app1_id = "app-priya-01"
    app1_num = "APP-2026-WC-01"
    valid_from_1 = (now - timedelta(hours=2)).isoformat()
    valid_until_1 = (now + timedelta(days=2)).isoformat()
    cursor.execute("""
        INSERT OR IGNORE INTO pass_applications
        (id, application_number, applicant_id, department_id, vehicle_registration_number, vehicle_type,
         journey_origin, journey_destination, journey_purpose, journey_date,
         requested_start_time, requested_end_time, approved_start_time, approved_end_time,
         eligibility_basis, status, reviewed_by, reviewed_at, created_at, updated_at)
        VALUES (?, ?, ?, 'dept-wc-01', '21D 104523X', 'Light Military Utility / Staff SUV',
         'HQ Western Command, Chandi Mandir', 'Sub-Area Ambala Cantt',
         'Operational logistics inspection and liaison', ?, ?, ?, ?, ?,
         'Section 3(1)(a) Indian Tolls (Army and Air Force) Act 1901', 'approved',
         'user-head-wc-01', ?, ?, ?)
    """, (
        app1_id, app1_num, "user-priya-01",
        now.strftime("%Y-%m-%d"), valid_from_1, valid_until_1, valid_from_1, valid_until_1,
        now_iso, now_iso, now_iso
    ))

    # Generate Ed25519 Pass 1 (Active)
    pass1_id = "pass-priya-01"
    pass1_code = "SEVA-2026-WC-1045"
    pass1_data = {
        "pass_code": pass1_code,
        "vehicle_registration_number": "21D 104523X",
        "department_code": "WC-ARMY",
        "journey_origin": "HQ Western Command, Chandi Mandir",
        "journey_destination": "Sub-Area Ambala Cantt",
        "valid_from": valid_from_1,
        "valid_until": valid_until_1,
        "eligibility_basis": "Section 3(1)(a) Indian Tolls (Army and Air Force) Act 1901"
    }
    cred1 = signer.build_qr_credential(pass1_data)
    cursor.execute("""
        INSERT OR IGNORE INTO issued_passes
        (id, pass_code, application_id, applicant_id, department_id, vehicle_registration_number, vehicle_type,
         journey_origin, journey_destination, journey_purpose, valid_from, valid_until, eligibility_basis,
         status, signature_algorithm, key_id, signature_hex, canonical_payload_json, qr_payload_encoded,
         issued_by, issued_at, created_at)
        VALUES (?, ?, ?, 'user-priya-01', 'dept-wc-01', '21D 104523X', 'Light Military Utility / Staff SUV',
         'HQ Western Command, Chandi Mandir', 'Sub-Area Ambala Cantt',
         'Operational logistics inspection and liaison', ?, ?,
         'Section 3(1)(a) Indian Tolls (Army and Air Force) Act 1901',
         'active', 'Ed25519', ?, ?, ?, ?,
         'user-head-wc-01', ?, ?)
    """, (
        pass1_id, pass1_code, app1_id,
        valid_from_1, valid_until_1,
        signer.key_id, cred1["signature"], cred1["canonical"], signer.canonicalize_payload(cred1),
        now_iso, now_iso
    ))

    # Case 2: Pending Application for Arvind Deshmukh (Northern Command)
    app2_id = "app-arvind-01"
    app2_num = "APP-2026-NC-02"
    cursor.execute("""
        INSERT OR IGNORE INTO pass_applications
        (id, application_number, applicant_id, department_id, vehicle_registration_number, vehicle_type,
         journey_origin, journey_destination, journey_purpose, journey_date,
         requested_start_time, requested_end_time,
         eligibility_basis, status, created_at, updated_at)
        VALUES (?, ?, ?, 'dept-nc-01', '22D 209841P', 'Armoured Troop Carrier (Medium)',
         'HQ Northern Command, Udhampur', 'Nagrota Transit Hub',
         'Troop rotation transit and convoy escort', ?, ?, ?,
         'Section 3(1)(a) Indian Tolls (Army and Air Force) Act 1901', 'submitted', ?, ?)
    """, (
        app2_id, app2_num, "user-arvind-01",
        now.strftime("%Y-%m-%d"),
        now.isoformat(),
        (now + timedelta(days=1)).isoformat(),
        now_iso, now_iso
    ))

    # Case 3: Expired Pass for Demonstration
    app3_id = "app-expired-01"
    app3_num = "APP-2026-WC-03"
    exp_from = (now - timedelta(days=5)).isoformat()
    exp_until = (now - timedelta(days=2)).isoformat()
    cursor.execute("""
        INSERT OR IGNORE INTO pass_applications
        (id, application_number, applicant_id, department_id, vehicle_registration_number, vehicle_type,
         journey_origin, journey_destination, journey_purpose, journey_date,
         requested_start_time, requested_end_time, approved_start_time, approved_end_time,
         eligibility_basis, status, reviewed_by, reviewed_at, created_at, updated_at)
        VALUES (?, ?, 'user-devendra-01', 'dept-wc-01', '20B 334190M', 'Heavy Transport Truck',
         'Bathinda Cantonment', 'Suratgarh Forward Post',
         'Heavy stores dispatch', '2026-11-17', ?, ?, ?, ?,
         'Section 3(1)(a) Indian Tolls (Army and Air Force) Act 1901', 'approved',
         'user-head-wc-01', ?, ?, ?)
    """, (
        app3_id, app3_num, exp_from, exp_until, exp_from, exp_until,
        exp_from, exp_from, exp_from
    ))
    pass3_id = "pass-expired-01"
    pass3_code = "SEVA-2026-WC-3341"
    pass3_data = {
        "pass_code": pass3_code,
        "vehicle_registration_number": "20B 334190M",
        "department_code": "WC-ARMY",
        "journey_origin": "Bathinda Cantonment",
        "journey_destination": "Suratgarh Forward Post",
        "valid_from": exp_from,
        "valid_until": exp_until,
        "eligibility_basis": "Section 3(1)(a) Indian Tolls (Army and Air Force) Act 1901"
    }
    cred3 = signer.build_qr_credential(pass3_data)
    cursor.execute("""
        INSERT OR IGNORE INTO issued_passes
        (id, pass_code, application_id, applicant_id, department_id, vehicle_registration_number, vehicle_type,
         journey_origin, journey_destination, journey_purpose, valid_from, valid_until, eligibility_basis,
         status, signature_algorithm, key_id, signature_hex, canonical_payload_json, qr_payload_encoded,
         issued_by, issued_at, created_at)
        VALUES (?, ?, ?, 'user-devendra-01', 'dept-wc-01', '20B 334190M', 'Heavy Transport Truck',
         'Bathinda Cantonment', 'Suratgarh Forward Post',
         'Heavy stores dispatch', ?, ?,
         'Section 3(1)(a) Indian Tolls (Army and Air Force) Act 1901',
         'expired', 'Ed25519', ?, ?, ?, ?,
         'user-head-wc-01', ?, ?)
    """, (
        pass3_id, pass3_code, app3_id,
        exp_from, exp_until,
        signer.key_id, cred3["signature"], cred3["canonical"], signer.canonicalize_payload(cred3),
        exp_from, exp_from
    ))

    # Case 4: Revoked Pass for Demonstration
    app4_id = "app-revoked-01"
    app4_num = "APP-2026-NC-04"
    rev_from = (now - timedelta(days=1)).isoformat()
    rev_until = (now + timedelta(days=3)).isoformat()
    cursor.execute("""
        INSERT OR IGNORE INTO pass_applications
        (id, application_number, applicant_id, department_id, vehicle_registration_number, vehicle_type,
         journey_origin, journey_destination, journey_purpose, journey_date,
         requested_start_time, requested_end_time, approved_start_time, approved_end_time,
         eligibility_basis, status, reviewed_by, reviewed_at, created_at, updated_at)
        VALUES (?, ?, 'user-arvind-01', 'dept-nc-01', '19D 776512K', 'Field Ambulance / Light Medical',
         'Military Hospital Udhampur', 'Base Hospital Srinagar',
         'Emergency medical supply transfer', '2026-11-21', ?, ?, ?, ?,
         'Section 3(1)(a) Indian Tolls (Army and Air Force) Act 1901', 'approved',
         'user-head-nc-01', ?, ?, ?)
    """, (
        app4_id, app4_num, rev_from, rev_until, rev_from, rev_until,
        rev_from, rev_from, rev_from
    ))
    pass4_id = "pass-revoked-01"
    pass4_code = "SEVA-2026-NC-7765"
    pass4_data = {
        "pass_code": pass4_code,
        "vehicle_registration_number": "19D 776512K",
        "department_code": "NC-ARMY",
        "journey_origin": "Military Hospital Udhampur",
        "journey_destination": "Base Hospital Srinagar",
        "valid_from": rev_from,
        "valid_until": rev_until,
        "eligibility_basis": "Section 3(1)(a) Indian Tolls (Army and Air Force) Act 1901"
    }
    cred4 = signer.build_qr_credential(pass4_data)
    cursor.execute("""
        INSERT OR IGNORE INTO issued_passes
        (id, pass_code, application_id, applicant_id, department_id, vehicle_registration_number, vehicle_type,
         journey_origin, journey_destination, journey_purpose, valid_from, valid_until, eligibility_basis,
         status, signature_algorithm, key_id, signature_hex, canonical_payload_json, qr_payload_encoded,
         issued_by, issued_at, created_at)
        VALUES (?, ?, ?, 'user-arvind-01', 'dept-nc-01', '19D 776512K', 'Field Ambulance / Light Medical',
         'Military Hospital Udhampur', 'Base Hospital Srinagar',
         'Emergency medical supply transfer', ?, ?,
         'Section 3(1)(a) Indian Tolls (Army and Air Force) Act 1901',
         'revoked', 'Ed25519', ?, ?, ?, ?,
         'user-head-nc-01', ?, ?)
    """, (
        pass4_id, pass4_code, app4_id,
        rev_from, rev_until,
        signer.key_id, cred4["signature"], cred4["canonical"], signer.canonicalize_payload(cred4),
        rev_from, rev_from
    ))
    cursor.execute("""
        INSERT OR IGNORE INTO pass_revocations
        (id, pass_id, revoked_by, revocation_reason, revocation_category, revoked_at)
        VALUES ('rev-01', ?, 'user-head-nc-01', 'Movement order cancelled due to weather closure of NH-44', 'Operational Cancellation', ?)
    """, (pass4_id, now_iso))

    conn.commit()
    conn.close()

    print("[SEVA PASS] Database seeding completed successfully with synthetic demonstration records.")

if __name__ == "__main__":
    seed_database()
