-- ============================================================================
-- SEVA PASS: Clean, Unified Demonstration Schema for Supabase PostgreSQL
-- File: supabase/demo_schema.sql
--
-- Target: Dedicated DRDO Demo Supabase Project (Recommended)
-- Or clean run on existing empty Supabase project.
--
-- Features:
-- 1. Full compatibility with SEVA PASS FastAPI backend & string slug IDs.
-- 2. Native UUID default generation via uuid_generate_v4()::text.
-- 3. All backend-required columns (profiles.status, pass_applications.application_number,
--    issued_passes.qr_payload_encoded, verification_logs.source).
-- 4. Safe non-cascading deletion protection for issued military passes and revocations.
-- 5. Hardened Row Level Security (RLS) with zero anonymous access to sensitive tables.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. Services / Branches (Army, Navy, Air Force)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.services (
    id VARCHAR(64) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    code VARCHAR(32) UNIQUE NOT NULL,
    name VARCHAR(128) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 2. Formations / Departments (Parent-Child Hierarchy)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.departments (
    id VARCHAR(64) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    service_id VARCHAR(64) NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
    parent_id VARCHAR(64) REFERENCES public.departments(id) ON DELETE SET NULL,
    code VARCHAR(64) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(64) DEFAULT 'Command',
    location VARCHAR(255),
    description TEXT,
    head_personnel_id VARCHAR(64),
    head_account_id VARCHAR(64),
    status VARCHAR(32) DEFAULT 'active',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 3. Profiles / User Accounts
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id VARCHAR(64) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    username VARCHAR(64) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    service_category VARCHAR(64) NOT NULL,
    service_number VARCHAR(64) NOT NULL,
    rank VARCHAR(64) DEFAULT 'Officer',
    phone VARCHAR(32),
    role VARCHAR(32) NOT NULL DEFAULT 'PERSONNEL' 
        CHECK (UPPER(role) IN ('CENTRAL_ADMIN', 'DEPARTMENT_HEAD', 'PERSONNEL', 'TOLL_OPERATOR', 'SUPER_ADMIN', 'DEPARTMENT_ADMIN', 'MEMBER')),
    account_type VARCHAR(32) NOT NULL DEFAULT 'personnel' 
        CHECK (LOWER(account_type) IN ('central_admin', 'department_head', 'personnel', 'toll_operator')),
    linked_personnel_id VARCHAR(64) REFERENCES public.profiles(id) ON DELETE SET NULL,
    assigned_department_id VARCHAR(64) REFERENCES public.departments(id) ON DELETE SET NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    must_change_password BOOLEAN DEFAULT FALSE,
    failed_login_attempts INT DEFAULT 0,
    locked_until TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Circular references for department heads
ALTER TABLE public.departments 
    ADD CONSTRAINT fk_dept_head_personnel FOREIGN KEY (head_personnel_id) REFERENCES public.profiles(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_dept_head_account FOREIGN KEY (head_account_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- ----------------------------------------------------------------------------
-- 4. Pass Applications
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pass_applications (
    id VARCHAR(64) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    application_number VARCHAR(64) UNIQUE,
    applicant_id VARCHAR(64) NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    department_id VARCHAR(64) NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
    vehicle_registration_number VARCHAR(64) NOT NULL,
    vehicle_type VARCHAR(64) NOT NULL,
    journey_origin VARCHAR(255) NOT NULL,
    journey_destination VARCHAR(255) NOT NULL,
    journey_purpose VARCHAR(255) NOT NULL,
    journey_date VARCHAR(32) NOT NULL,
    requested_start_time TIMESTAMPTZ NOT NULL,
    requested_end_time TIMESTAMPTZ NOT NULL,
    approved_start_time TIMESTAMPTZ,
    approved_end_time TIMESTAMPTZ,
    eligibility_basis TEXT NOT NULL,
    supporting_document_ref VARCHAR(255),
    status VARCHAR(32) NOT NULL DEFAULT 'submitted' 
        CHECK (LOWER(status) IN ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'revoked', 'expired')),
    rejection_reason TEXT,
    admin_notes TEXT,
    reviewed_by VARCHAR(64) REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 5. Issued Military Toll-Exemption Passes (Ed25519 Cryptographic Pass)
-- NOTE: Protected with ON DELETE RESTRICT so historical legal passes are never purged.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.issued_passes (
    id VARCHAR(64) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    pass_code VARCHAR(64) UNIQUE NOT NULL,
    application_id VARCHAR(64) NOT NULL REFERENCES public.pass_applications(id) ON DELETE RESTRICT,
    applicant_id VARCHAR(64) NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    department_id VARCHAR(64) NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
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
    qr_payload_encoded TEXT NOT NULL,
    issued_by VARCHAR(64) NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    issued_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 6. Pass Revocations (Immutable Audit Trail)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pass_revocations (
    id VARCHAR(64) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    pass_id VARCHAR(64) NOT NULL REFERENCES public.issued_passes(id) ON DELETE RESTRICT,
    revoked_by VARCHAR(64) NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    revocation_reason TEXT NOT NULL,
    revocation_category VARCHAR(64) DEFAULT 'Administrative Cancellation',
    revoked_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 7. Verification Logs (Toll Plaza Audit Scans)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.verification_logs (
    id VARCHAR(64) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    pass_id VARCHAR(64) REFERENCES public.issued_passes(id) ON DELETE SET NULL,
    pass_code VARCHAR(64),
    toll_plaza_name VARCHAR(255) NOT NULL,
    operator_id VARCHAR(64) REFERENCES public.profiles(id) ON DELETE SET NULL,
    source VARCHAR(32) DEFAULT 'public_web',
    scanned_vehicle_reg VARCHAR(64),
    authorised_vehicle_reg VARCHAR(64),
    verification_result VARCHAR(64) NOT NULL 
        CHECK (verification_result IN ('VALID', 'INVALID', 'INVALID SIGNATURE', 'EXPIRED', 'REVOKED', 'VEHICLE MISMATCH', 'VEHICLE_MISMATCH', 'REPLAY DETECTED', 'MANUAL REVIEW REQUIRED')),
    reason_detail TEXT,
    signature_valid BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 8. Audit Logs (Platform-Wide Append-Only Trail)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id VARCHAR(64) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    event_type VARCHAR(64) NOT NULL,
    actor_id VARCHAR(64),
    actor_email VARCHAR(255),
    actor_role VARCHAR(32),
    department_id VARCHAR(64),
    entity_type VARCHAR(64) NOT NULL,
    entity_id VARCHAR(255),
    outcome VARCHAR(32) NOT NULL DEFAULT 'SUCCESS',
    details JSONB,
    ip_address VARCHAR(64),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- Auxiliary Schema Compatibility Tables (Optional)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.membership_requests (
    id VARCHAR(64) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    user_id VARCHAR(64) NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    department_id VARCHAR(64) NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
    status VARCHAR(32) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    request_note TEXT,
    reviewed_by VARCHAR(64) REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.department_memberships (
    id VARCHAR(64) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    user_id VARCHAR(64) NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    department_id VARCHAR(64) NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
    status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'removed')),
    member_role VARCHAR(64) DEFAULT 'member',
    approved_by VARCHAR(64) REFERENCES public.profiles(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_dept_membership UNIQUE (user_id, department_id)
);

CREATE TABLE IF NOT EXISTS public.verification_tokens (
    id VARCHAR(64) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    pass_id VARCHAR(64) NOT NULL REFERENCES public.issued_passes(id) ON DELETE CASCADE,
    nonce VARCHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    consumed_at TIMESTAMPTZ,
    consumed_by_terminal VARCHAR(255),
    status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'consumed', 'expired')),
    token_signature TEXT NOT NULL
);

-- ----------------------------------------------------------------------------
-- Performance Indexes
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_dept ON public.profiles(assigned_department_id);
CREATE INDEX IF NOT EXISTS idx_dept_code ON public.departments(code);
CREATE INDEX IF NOT EXISTS idx_dept_service ON public.departments(service_id);
CREATE INDEX IF NOT EXISTS idx_dept_head ON public.departments(head_personnel_id);
CREATE INDEX IF NOT EXISTS idx_pass_apps_applicant ON public.pass_applications(applicant_id);
CREATE INDEX IF NOT EXISTS idx_pass_apps_dept ON public.pass_applications(department_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pass_apps_app_number ON public.pass_applications(application_number) WHERE application_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_issued_passes_code ON public.issued_passes(pass_code);
CREATE INDEX IF NOT EXISTS idx_issued_passes_status ON public.issued_passes(status);
CREATE INDEX IF NOT EXISTS idx_verif_logs_pass ON public.verification_logs(pass_id);
CREATE INDEX IF NOT EXISTS idx_verif_logs_source ON public.verification_logs(source);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event ON public.audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);

-- ----------------------------------------------------------------------------
-- Permissions & Role Grants (Least-Privilege)
-- ----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT SELECT ON public.services TO authenticated, anon;
GRANT SELECT ON public.departments TO authenticated, anon;

-- Protect sensitive tables: NEVER grant SELECT to anon
REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.pass_applications FROM anon;
REVOKE ALL ON public.issued_passes FROM anon;
REVOKE ALL ON public.pass_revocations FROM anon;
REVOKE ALL ON public.audit_logs FROM anon;
REVOKE ALL ON public.verification_logs FROM anon;

-- ----------------------------------------------------------------------------
-- Row Level Security (RLS)
-- ----------------------------------------------------------------------------
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pass_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issued_passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pass_revocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read services" ON public.services FOR SELECT USING (true);
CREATE POLICY "Public read departments" ON public.departments FOR SELECT USING (true);

CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT USING (
    auth.uid()::text = id OR
    EXISTS (SELECT 1 FROM public.profiles sp WHERE sp.id = auth.uid()::text AND UPPER(sp.role) IN ('CENTRAL_ADMIN', 'SUPER_ADMIN')) OR
    EXISTS (
        SELECT 1 FROM public.profiles da
        WHERE da.id = auth.uid()::text AND UPPER(da.role) IN ('DEPARTMENT_HEAD', 'DEPARTMENT_ADMIN')
        AND (da.assigned_department_id = profiles.assigned_department_id OR profiles.assigned_department_id IS NULL)
    )
);

CREATE POLICY "Audit logs insertable by system" ON public.audit_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Audit logs readable by authorized admins" ON public.audit_logs FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid()::text AND UPPER(profiles.role) IN ('CENTRAL_ADMIN', 'SUPER_ADMIN', 'DEPARTMENT_HEAD', 'DEPARTMENT_ADMIN'))
);
