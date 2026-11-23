-- ============================================================================
-- SEVA PASS: PostgreSQL Identifier, Column & Foreign-Key Compatibility Migration
-- File: supabase/migrations/02_id_foreign_key_compatibility.sql
--
-- PURPOSE:
-- 1. Dynamically discovers and drops all existing foreign keys across target tables.
-- 2. Adds missing columns required by the backend:
--    - profiles.status
--    - pass_applications.application_number
--    - issued_passes.qr_payload_encoded
--    - verification_logs.source
-- 3. Safely alters primary key and referencing foreign key columns from UUID to VARCHAR(64).
--    Retains DEFAULT uuid_generate_v4()::text for automatic UUID generation.
-- 4. Re-creates all foreign key relationships with ON DELETE RESTRICT on issued_passes
--    to guarantee legal military exemption passes are never accidentally cascade-deleted.
-- 5. Hardens Row Level Security (RLS) policies for text-based ID comparisons.
-- ============================================================================

BEGIN;

-- ============================================================================
-- SECTION 1: DYNAMICALLY DROP ALL EXISTING FOREIGN KEYS ON TARGET TABLES
-- ============================================================================
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT tc.table_schema, tc.table_name, tc.constraint_name
        FROM information_schema.table_constraints tc
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
          AND tc.table_name IN (
            'services', 'profiles', 'departments', 'membership_requests',
            'department_memberships', 'pass_applications', 'issued_passes',
            'verification_tokens', 'pass_revocations', 'verification_logs', 'audit_logs'
          )
    ) LOOP
        EXECUTE 'ALTER TABLE ' || quote_ident(r.table_schema) || '.' || quote_ident(r.table_name) || 
                ' DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name);
    END LOOP;
END $$;

-- ============================================================================
-- SECTION 2: ADD MISSING COLUMNS REQUIRED BY BACKEND ROUTES
-- ============================================================================

-- 1. profiles.status (Required by auth_routes.py line 226)
ALTER TABLE IF EXISTS public.profiles 
    ADD COLUMN IF NOT EXISTS status VARCHAR(32) DEFAULT 'active' NOT NULL;

-- 2. pass_applications.application_number (Required by passes_routes.py line 50)
ALTER TABLE IF EXISTS public.pass_applications 
    ADD COLUMN IF NOT EXISTS application_number VARCHAR(64);

-- 3. issued_passes.qr_payload_encoded (Required by passes_routes.py line 367)
ALTER TABLE IF EXISTS public.issued_passes 
    ADD COLUMN IF NOT EXISTS qr_payload_encoded TEXT;

-- 4. verification_logs.source (Required by verification_routes.py line 76)
ALTER TABLE IF EXISTS public.verification_logs 
    ADD COLUMN IF NOT EXISTS source VARCHAR(32) DEFAULT 'public_web';

-- ============================================================================
-- SECTION 3: ALTER ALL PRIMARY AND FOREIGN KEY COLUMNS TO VARCHAR(64)
-- ============================================================================

-- Table 1: services
ALTER TABLE IF EXISTS public.services 
    ALTER COLUMN id DROP DEFAULT,
    ALTER COLUMN id TYPE VARCHAR(64) USING id::text,
    ALTER COLUMN id SET DEFAULT uuid_generate_v4()::text;

-- Table 2: profiles
ALTER TABLE IF EXISTS public.profiles 
    ALTER COLUMN id DROP DEFAULT,
    ALTER COLUMN id TYPE VARCHAR(64) USING id::text,
    ALTER COLUMN id SET DEFAULT uuid_generate_v4()::text,
    ALTER COLUMN linked_personnel_id TYPE VARCHAR(64) USING linked_personnel_id::text,
    ALTER COLUMN assigned_department_id TYPE VARCHAR(64) USING assigned_department_id::text;

-- Table 3: departments
ALTER TABLE IF EXISTS public.departments 
    ALTER COLUMN id DROP DEFAULT,
    ALTER COLUMN id TYPE VARCHAR(64) USING id::text,
    ALTER COLUMN id SET DEFAULT uuid_generate_v4()::text,
    ALTER COLUMN service_id TYPE VARCHAR(64) USING service_id::text,
    ALTER COLUMN parent_id TYPE VARCHAR(64) USING parent_id::text,
    ALTER COLUMN head_personnel_id TYPE VARCHAR(64) USING head_personnel_id::text,
    ALTER COLUMN head_account_id TYPE VARCHAR(64) USING head_account_id::text;

-- Table 4: membership_requests
ALTER TABLE IF EXISTS public.membership_requests 
    ALTER COLUMN id DROP DEFAULT,
    ALTER COLUMN id TYPE VARCHAR(64) USING id::text,
    ALTER COLUMN id SET DEFAULT uuid_generate_v4()::text,
    ALTER COLUMN user_id TYPE VARCHAR(64) USING user_id::text,
    ALTER COLUMN department_id TYPE VARCHAR(64) USING department_id::text,
    ALTER COLUMN reviewed_by TYPE VARCHAR(64) USING reviewed_by::text;

-- Table 5: department_memberships
ALTER TABLE IF EXISTS public.department_memberships 
    ALTER COLUMN id DROP DEFAULT,
    ALTER COLUMN id TYPE VARCHAR(64) USING id::text,
    ALTER COLUMN id SET DEFAULT uuid_generate_v4()::text,
    ALTER COLUMN user_id TYPE VARCHAR(64) USING user_id::text,
    ALTER COLUMN department_id TYPE VARCHAR(64) USING department_id::text,
    ALTER COLUMN approved_by TYPE VARCHAR(64) USING approved_by::text;

-- Table 6: pass_applications
ALTER TABLE IF EXISTS public.pass_applications 
    ALTER COLUMN id DROP DEFAULT,
    ALTER COLUMN id TYPE VARCHAR(64) USING id::text,
    ALTER COLUMN id SET DEFAULT uuid_generate_v4()::text,
    ALTER COLUMN applicant_id TYPE VARCHAR(64) USING applicant_id::text,
    ALTER COLUMN department_id TYPE VARCHAR(64) USING department_id::text,
    ALTER COLUMN reviewed_by TYPE VARCHAR(64) USING reviewed_by::text;

-- Table 7: issued_passes
ALTER TABLE IF EXISTS public.issued_passes 
    ALTER COLUMN id DROP DEFAULT,
    ALTER COLUMN id TYPE VARCHAR(64) USING id::text,
    ALTER COLUMN id SET DEFAULT uuid_generate_v4()::text,
    ALTER COLUMN application_id TYPE VARCHAR(64) USING application_id::text,
    ALTER COLUMN applicant_id TYPE VARCHAR(64) USING applicant_id::text,
    ALTER COLUMN department_id TYPE VARCHAR(64) USING department_id::text,
    ALTER COLUMN issued_by TYPE VARCHAR(64) USING issued_by::text;

-- Table 8: verification_tokens
ALTER TABLE IF EXISTS public.verification_tokens 
    ALTER COLUMN id DROP DEFAULT,
    ALTER COLUMN id TYPE VARCHAR(64) USING id::text,
    ALTER COLUMN id SET DEFAULT uuid_generate_v4()::text,
    ALTER COLUMN pass_id TYPE VARCHAR(64) USING pass_id::text;

-- Table 9: pass_revocations
ALTER TABLE IF EXISTS public.pass_revocations 
    ALTER COLUMN id DROP DEFAULT,
    ALTER COLUMN id TYPE VARCHAR(64) USING id::text,
    ALTER COLUMN id SET DEFAULT uuid_generate_v4()::text,
    ALTER COLUMN pass_id TYPE VARCHAR(64) USING pass_id::text,
    ALTER COLUMN revoked_by TYPE VARCHAR(64) USING revoked_by::text;

-- Table 10: verification_logs
ALTER TABLE IF EXISTS public.verification_logs 
    ALTER COLUMN id DROP DEFAULT,
    ALTER COLUMN id TYPE VARCHAR(64) USING id::text,
    ALTER COLUMN id SET DEFAULT uuid_generate_v4()::text,
    ALTER COLUMN pass_id TYPE VARCHAR(64) USING pass_id::text,
    ALTER COLUMN operator_id TYPE VARCHAR(64) USING operator_id::text,
    ALTER COLUMN token_id TYPE VARCHAR(64) USING token_id::text;

-- Table 11: audit_logs
ALTER TABLE IF EXISTS public.audit_logs 
    ALTER COLUMN id DROP DEFAULT,
    ALTER COLUMN id TYPE VARCHAR(64) USING id::text,
    ALTER COLUMN id SET DEFAULT uuid_generate_v4()::text,
    ALTER COLUMN actor_id TYPE VARCHAR(64) USING actor_id::text,
    ALTER COLUMN department_id TYPE VARCHAR(64) USING department_id::text;

-- ============================================================================
-- SECTION 4: RE-ESTABLISH SAFE FOREIGN KEY CONSTRAINTS
-- Military passes and revocations are protected with ON DELETE RESTRICT
-- ============================================================================

-- profiles constraints
ALTER TABLE public.profiles
    ADD CONSTRAINT fk_profiles_linked_personnel
    FOREIGN KEY (linked_personnel_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- departments constraints
ALTER TABLE public.departments
    ADD CONSTRAINT fk_departments_service
    FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_departments_parent
    FOREIGN KEY (parent_id) REFERENCES public.departments(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_departments_head_personnel
    FOREIGN KEY (head_personnel_id) REFERENCES public.profiles(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_departments_head_account
    FOREIGN KEY (head_account_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- profiles -> departments circular reference
ALTER TABLE public.profiles
    ADD CONSTRAINT fk_profiles_assigned_dept
    FOREIGN KEY (assigned_department_id) REFERENCES public.departments(id) ON DELETE SET NULL;

-- pass_applications constraints
ALTER TABLE public.pass_applications
    ADD CONSTRAINT fk_passapp_applicant
    FOREIGN KEY (applicant_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_passapp_dept
    FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_passapp_reviewed_by
    FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- issued_passes constraints: PROTECTED AGAINST CASCADE DELETION
-- Legal military exemption passes must NOT be wiped if a profile/dept is removed.
ALTER TABLE public.issued_passes
    ADD CONSTRAINT fk_isspass_app
    FOREIGN KEY (application_id) REFERENCES public.pass_applications(id) ON DELETE RESTRICT,
    ADD CONSTRAINT fk_isspass_applicant
    FOREIGN KEY (applicant_id) REFERENCES public.profiles(id) ON DELETE RESTRICT,
    ADD CONSTRAINT fk_isspass_dept
    FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE RESTRICT,
    ADD CONSTRAINT fk_isspass_issued_by
    FOREIGN KEY (issued_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;

-- pass_revocations constraints
ALTER TABLE public.pass_revocations
    ADD CONSTRAINT fk_passrev_pass
    FOREIGN KEY (pass_id) REFERENCES public.issued_passes(id) ON DELETE RESTRICT,
    ADD CONSTRAINT fk_passrev_revoked_by
    FOREIGN KEY (revoked_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;

-- verification_logs constraints
ALTER TABLE public.verification_logs
    ADD CONSTRAINT fk_veriflog_pass
    FOREIGN KEY (pass_id) REFERENCES public.issued_passes(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_veriflog_operator
    FOREIGN KEY (operator_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- auxiliary tables
ALTER TABLE public.verification_tokens
    ADD CONSTRAINT fk_veriftok_pass
    FOREIGN KEY (pass_id) REFERENCES public.issued_passes(id) ON DELETE CASCADE;

ALTER TABLE public.membership_requests
    ADD CONSTRAINT fk_memreq_user FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_memreq_dept FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_memreq_reviewed_by FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.department_memberships
    ADD CONSTRAINT fk_deptmem_user FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_deptmem_dept FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_deptmem_approved_by FOREIGN KEY (approved_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- ============================================================================
-- SECTION 5: UNIQUE & PERFORMANCE INDEXES
-- ============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_pass_apps_app_number ON public.pass_applications(application_number) WHERE application_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_verif_logs_source ON public.verification_logs(source);

-- ============================================================================
-- SECTION 6: UPDATE RLS POLICIES FOR STRING ID MATCHING
-- ============================================================================
DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT USING (
    auth.uid()::text = id OR
    EXISTS (SELECT 1 FROM public.profiles sp WHERE sp.id = auth.uid()::text AND UPPER(sp.role) IN ('CENTRAL_ADMIN', 'SUPER_ADMIN')) OR
    EXISTS (
        SELECT 1 FROM public.profiles da
        WHERE da.id = auth.uid()::text AND UPPER(da.role) IN ('DEPARTMENT_HEAD', 'DEPARTMENT_ADMIN')
        AND (da.assigned_department_id = profiles.assigned_department_id OR profiles.assigned_department_id IS NULL)
    )
);

DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE 
USING (auth.uid()::text = id)
WITH CHECK (
    auth.uid()::text = id AND
    role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()::text) AND
    account_type = (SELECT p.account_type FROM public.profiles p WHERE p.id = auth.uid()::text) AND
    assigned_department_id IS NOT DISTINCT FROM (SELECT p.assigned_department_id FROM public.profiles p WHERE p.id = auth.uid()::text)
);

COMMIT;
