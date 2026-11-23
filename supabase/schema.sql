-- ============================================================================
-- SEVA PASS: Secure Electronic Verification and Authorisation for Military Toll Exemptions
-- Supabase PostgreSQL Schema & Row Level Security (RLS) Definitions
-- Production Architectural Specification
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Services Table (Army, Navy, Air Force)
CREATE TABLE IF NOT EXISTS services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(32) UNIQUE NOT NULL,
    name VARCHAR(128) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Profiles Table (Universal Identity System)
-- Supports central_admin, department_head, personnel, and toll_operator
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY, -- references auth.users(id) in Supabase
    username VARCHAR(64) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    service_category VARCHAR(64) NOT NULL,
    service_number VARCHAR(64) NOT NULL,
    rank VARCHAR(64) DEFAULT 'Officer',
    phone VARCHAR(32),
    role VARCHAR(32) NOT NULL DEFAULT 'personnel' CHECK (role IN ('central_admin', 'department_head', 'personnel', 'toll_operator', 'super_admin', 'department_admin', 'member')),
    account_type VARCHAR(32) NOT NULL DEFAULT 'personnel' CHECK (account_type IN ('central_admin', 'department_head', 'personnel', 'toll_operator')),
    linked_personnel_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    assigned_department_id UUID,
    must_change_password BOOLEAN DEFAULT FALSE,
    failed_login_attempts INT DEFAULT 0,
    locked_until TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Departments Table (Parent-Child Hierarchy with Linked Department Head)
CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    code VARCHAR(64) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(64) DEFAULT 'Command',
    location VARCHAR(255),
    description TEXT,
    head_personnel_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    head_account_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    status VARCHAR(32) DEFAULT 'active',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ADD CONSTRAINT fk_assigned_department FOREIGN KEY (assigned_department_id) REFERENCES departments(id) ON DELETE SET NULL;

-- 4. Membership Requests Table
CREATE TABLE IF NOT EXISTS membership_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    status VARCHAR(32) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    request_note TEXT,
    reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Department Memberships Table
CREATE TABLE IF NOT EXISTS department_memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'removed')),
    member_role VARCHAR(64) DEFAULT 'member',
    approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_dept_membership UNIQUE (user_id, department_id)
);

-- 6. Pass Applications Table
CREATE TABLE IF NOT EXISTS pass_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    applicant_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    vehicle_registration_number VARCHAR(64) NOT NULL,
    vehicle_type VARCHAR(64) NOT NULL,
    journey_origin VARCHAR(255) NOT NULL,
    journey_destination VARCHAR(255) NOT NULL,
    journey_purpose VARCHAR(255) NOT NULL,
    journey_date DATE NOT NULL,
    requested_start_time TIMESTAMPTZ NOT NULL,
    requested_end_time TIMESTAMPTZ NOT NULL,
    approved_start_time TIMESTAMPTZ,
    approved_end_time TIMESTAMPTZ,
    eligibility_basis TEXT NOT NULL,
    supporting_document_ref VARCHAR(255),
    status VARCHAR(32) NOT NULL DEFAULT 'submitted' CHECK (status IN ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'revoked', 'expired')),
    rejection_reason TEXT,
    admin_notes TEXT,
    reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Issued Passes Table (Ed25519 Cryptographic Pass)
CREATE TABLE IF NOT EXISTS issued_passes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pass_code VARCHAR(64) UNIQUE NOT NULL,
    application_id UUID NOT NULL REFERENCES pass_applications(id) ON DELETE CASCADE,
    applicant_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    vehicle_registration_number VARCHAR(64) NOT NULL,
    vehicle_type VARCHAR(64) NOT NULL,
    journey_origin VARCHAR(255) NOT NULL,
    journey_destination VARCHAR(255) NOT NULL,
    journey_purpose VARCHAR(255) NOT NULL,
    valid_from TIMESTAMPTZ NOT NULL,
    valid_until TIMESTAMPTZ NOT NULL,
    eligibility_basis TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
    signature_algorithm VARCHAR(32) DEFAULT 'Ed25519',
    key_id VARCHAR(64) DEFAULT 'seva-ed25519-v1',
    signature_hex TEXT NOT NULL,
    canonical_payload_json TEXT NOT NULL,
    issued_by UUID NOT NULL REFERENCES profiles(id),
    issued_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Verification Tokens Table (Dynamic QR & Anti-Replay)
CREATE TABLE IF NOT EXISTS verification_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pass_id UUID NOT NULL REFERENCES issued_passes(id) ON DELETE CASCADE,
    nonce VARCHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    consumed_at TIMESTAMPTZ,
    consumed_by_terminal VARCHAR(255),
    status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'consumed', 'expired')),
    token_signature TEXT NOT NULL
);

-- 9. Pass Revocations Table
CREATE TABLE IF NOT EXISTS pass_revocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pass_id UUID NOT NULL REFERENCES issued_passes(id) ON DELETE CASCADE,
    revoked_by UUID NOT NULL REFERENCES profiles(id),
    revocation_reason TEXT NOT NULL,
    revocation_category VARCHAR(64) DEFAULT 'Administrative Cancellation',
    revoked_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Verification Logs Table (Toll Plaza Audit Scans)
CREATE TABLE IF NOT EXISTS verification_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pass_id UUID REFERENCES issued_passes(id) ON DELETE SET NULL,
    pass_code VARCHAR(64),
    token_id UUID,
    toll_plaza_name VARCHAR(255) NOT NULL,
    operator_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    scanned_vehicle_reg VARCHAR(64),
    authorised_vehicle_reg VARCHAR(64),
    verification_result VARCHAR(64) NOT NULL CHECK (verification_result IN ('VALID', 'INVALID SIGNATURE', 'EXPIRED', 'REVOKED', 'VEHICLE MISMATCH', 'REPLAY DETECTED', 'MANUAL REVIEW REQUIRED')),
    reason_detail TEXT,
    signature_valid BOOLEAN DEFAULT FALSE,
    token_valid BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Audit Logs Table (Platform-Wide Append-Only Trail)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(64) NOT NULL,
    actor_id UUID,
    actor_email VARCHAR(255),
    actor_role VARCHAR(32),
    department_id UUID,
    entity_type VARCHAR(64) NOT NULL,
    entity_id VARCHAR(255),
    outcome VARCHAR(32) NOT NULL DEFAULT 'SUCCESS',
    details JSONB,
    ip_address VARCHAR(64),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance & security lookups
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_dept_service ON departments(service_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_dept ON profiles(assigned_department_id);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON department_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_dept ON department_memberships(department_id);
CREATE INDEX IF NOT EXISTS idx_pass_apps_applicant ON pass_applications(applicant_id);
CREATE INDEX IF NOT EXISTS idx_pass_apps_dept ON pass_applications(department_id);
CREATE INDEX IF NOT EXISTS idx_issued_passes_code ON issued_passes(pass_code);
CREATE INDEX IF NOT EXISTS idx_issued_passes_status ON issued_passes(status);
CREATE INDEX IF NOT EXISTS idx_verif_tokens_pass ON verification_tokens(pass_id);
CREATE INDEX IF NOT EXISTS idx_verif_logs_pass ON verification_logs(pass_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event ON audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE department_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE pass_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE issued_passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE pass_revocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Base RLS Policies
CREATE POLICY "Public read services" ON services FOR SELECT USING (true);
CREATE POLICY "Public read departments" ON departments FOR SELECT USING (true);
CREATE POLICY "Central admin manage departments" ON departments FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('central_admin', 'super_admin'))
);

CREATE POLICY "Users read own profile" ON profiles FOR SELECT USING (
    auth.uid() = id OR
    EXISTS (SELECT 1 FROM profiles sp WHERE sp.id = auth.uid() AND sp.role IN ('central_admin', 'super_admin')) OR
    EXISTS (
        SELECT 1 FROM profiles da
        WHERE da.id = auth.uid() AND da.role IN ('department_head', 'department_admin')
        AND (da.assigned_department_id = profiles.assigned_department_id OR profiles.assigned_department_id IS NULL)
    )
);

CREATE POLICY "Users update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Append-only constraint on audit logs
CREATE POLICY "Audit logs insertable by system" ON audit_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Audit logs readable by authorized admins" ON audit_logs FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('central_admin', 'super_admin', 'department_head', 'department_admin'))
);
