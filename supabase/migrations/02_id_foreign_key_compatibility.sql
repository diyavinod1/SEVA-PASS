-- ============================================================================
-- SEVA PASS: PostgreSQL Identifier & Foreign-Key Compatibility Migration
-- File: supabase/migrations/02_id_foreign_key_compatibility.sql
-- 
-- PURPOSE:
-- Supabase initial schema defined primary and foreign keys as UUID.
-- However, SEVA PASS uses domain-prefixed string IDs across models and fixtures:
--   - Services:   'srv-army-01', 'srv-navy-01', 'srv-iaf-01'
--   - Depts:      'dept-wc-01', 'dept-sc-01', 'dept-ec-01', 'dept-nc-01'
--   - Profiles:   'admin-01', 'head-wc-01', 'user-priya-01', 'user-vikram-01'
--   - Passes:     'pass-priya-01', 'pass-vikram-01'
--
-- In PostgreSQL, inserting non-UUID strings into UUID columns throws:
--   ERROR: invalid input syntax for type uuid: "user-priya-01"
--
-- This migration converts all 11 tables' primary keys and foreign keys to
-- VARCHAR(64) while maintaining DEFAULT uuid_generate_v4()::text so auto-generated
-- UUIDs continue to work when explicit string IDs are omitted.
--
-- EXECUTION:
-- Run this script in the Supabase Dashboard -> SQL Editor.
-- Transactional: Wrapped in BEGIN ... COMMIT for atomic execution.
-- ============================================================================

BEGIN;

-- ============================================================================
-- SECTION 1: DROP ALL FOREIGN KEY CONSTRAINTS (DEPENDENCY ORDER)
-- ============================================================================

-- Drop audit_logs FKs (if any)
-- audit_logs has actor_id and department_id as loose references

-- Drop verification_logs FKs
ALTER TABLE IF EXISTS public.verification_logs DROP CONSTRAINT IF EXISTS verification_logs_pass_id_fkey;
ALTER TABLE IF EXISTS public.verification_logs DROP CONSTRAINT IF EXISTS verification_logs_operator_id_fkey;
ALTER TABLE IF EXISTS public.verification_logs DROP CONSTRAINT IF EXISTS fk_veriflog_pass;
ALTER TABLE IF EXISTS public.verification_logs DROP CONSTRAINT IF EXISTS fk_veriflog_operator;

-- Drop pass_revocations FKs
ALTER TABLE IF EXISTS public.pass_revocations DROP CONSTRAINT IF EXISTS pass_revocations_pass_id_fkey;
ALTER TABLE IF EXISTS public.pass_revocations DROP CONSTRAINT IF EXISTS pass_revocations_revoked_by_fkey;
ALTER TABLE IF EXISTS public.pass_revocations DROP CONSTRAINT IF EXISTS fk_passrev_pass;
ALTER TABLE IF EXISTS public.pass_revocations DROP CONSTRAINT IF EXISTS fk_passrev_revoked_by;

-- Drop verification_tokens FKs
ALTER TABLE IF EXISTS public.verification_tokens DROP CONSTRAINT IF EXISTS verification_tokens_pass_id_fkey;
ALTER TABLE IF EXISTS public.verification_tokens DROP CONSTRAINT IF EXISTS fk_veriftok_pass;

-- Drop issued_passes FKs
ALTER TABLE IF EXISTS public.issued_passes DROP CONSTRAINT IF EXISTS issued_passes_application_id_fkey;
ALTER TABLE IF EXISTS public.issued_passes DROP CONSTRAINT IF EXISTS issued_passes_applicant_id_fkey;
ALTER TABLE IF EXISTS public.issued_passes DROP CONSTRAINT IF EXISTS issued_passes_department_id_fkey;
ALTER TABLE IF EXISTS public.issued_passes DROP CONSTRAINT IF EXISTS issued_passes_issued_by_fkey;
ALTER TABLE IF EXISTS public.issued_passes DROP CONSTRAINT IF EXISTS fk_isspass_app;
ALTER TABLE IF EXISTS public.issued_passes DROP CONSTRAINT IF EXISTS fk_isspass_applicant;
ALTER TABLE IF EXISTS public.issued_passes DROP CONSTRAINT IF EXISTS fk_isspass_dept;
ALTER TABLE IF EXISTS public.issued_passes DROP CONSTRAINT IF EXISTS fk_isspass_issued_by;

-- Drop pass_applications FKs
ALTER TABLE IF EXISTS public.pass_applications DROP CONSTRAINT IF EXISTS pass_applications_applicant_id_fkey;
ALTER TABLE IF EXISTS public.pass_applications DROP CONSTRAINT IF EXISTS pass_applications_department_id_fkey;
ALTER TABLE IF EXISTS public.pass_applications DROP CONSTRAINT IF EXISTS pass_applications_reviewed_by_fkey;
ALTER TABLE IF EXISTS public.pass_applications DROP CONSTRAINT IF EXISTS fk_passapp_applicant;
ALTER TABLE IF EXISTS public.pass_applications DROP CONSTRAINT IF EXISTS fk_passapp_dept;
ALTER TABLE IF EXISTS public.pass_applications DROP CONSTRAINT IF EXISTS fk_passapp_reviewed_by;

-- Drop department_memberships FKs
ALTER TABLE IF EXISTS public.department_memberships DROP CONSTRAINT IF EXISTS department_memberships_user_id_fkey;
ALTER TABLE IF EXISTS public.department_memberships DROP CONSTRAINT IF EXISTS department_memberships_department_id_fkey;
ALTER TABLE IF EXISTS public.department_memberships DROP CONSTRAINT IF EXISTS department_memberships_approved_by_fkey;
ALTER TABLE IF EXISTS public.department_memberships DROP CONSTRAINT IF EXISTS fk_deptmem_user;
ALTER TABLE IF EXISTS public.department_memberships DROP CONSTRAINT IF EXISTS fk_deptmem_dept;
ALTER TABLE IF EXISTS public.department_memberships DROP CONSTRAINT IF EXISTS fk_deptmem_approved_by;

-- Drop membership_requests FKs
ALTER TABLE IF EXISTS public.membership_requests DROP CONSTRAINT IF EXISTS membership_requests_user_id_fkey;
ALTER TABLE IF EXISTS public.membership_requests DROP CONSTRAINT IF EXISTS membership_requests_department_id_fkey;
ALTER TABLE IF EXISTS public.membership_requests DROP CONSTRAINT IF EXISTS membership_requests_reviewed_by_fkey;
ALTER TABLE IF EXISTS public.membership_requests DROP CONSTRAINT IF EXISTS fk_memreq_user;
ALTER TABLE IF EXISTS public.membership_requests DROP CONSTRAINT IF EXISTS fk_memreq_dept;
ALTER TABLE IF EXISTS public.membership_requests DROP CONSTRAINT IF EXISTS fk_memreq_reviewed_by;

-- Drop departments FKs
ALTER TABLE IF EXISTS public.departments DROP CONSTRAINT IF EXISTS departments_service_id_fkey;
ALTER TABLE IF EXISTS public.departments DROP CONSTRAINT IF EXISTS departments_parent_id_fkey;
ALTER TABLE IF EXISTS public.departments DROP CONSTRAINT IF EXISTS departments_head_personnel_id_fkey;
ALTER TABLE IF EXISTS public.departments DROP CONSTRAINT IF EXISTS departments_head_account_id_fkey;
ALTER TABLE IF EXISTS public.departments DROP CONSTRAINT IF EXISTS fk_departments_service;
ALTER TABLE IF EXISTS public.departments DROP CONSTRAINT IF EXISTS fk_departments_parent;
ALTER TABLE IF EXISTS public.departments DROP CONSTRAINT IF EXISTS fk_departments_head_personnel;
ALTER TABLE IF EXISTS public.departments DROP CONSTRAINT IF EXISTS fk_departments_head_account;

-- Drop profiles FKs
ALTER TABLE IF EXISTS public.profiles DROP CONSTRAINT IF EXISTS profiles_linked_personnel_id_fkey;
ALTER TABLE IF EXISTS public.profiles DROP CONSTRAINT IF EXISTS fk_assigned_department;
ALTER TABLE IF EXISTS public.profiles DROP CONSTRAINT IF EXISTS profiles_assigned_department_id_fkey;
ALTER TABLE IF EXISTS public.profiles DROP CONSTRAINT IF EXISTS fk_profiles_assigned_dept;
ALTER TABLE IF EXISTS public.profiles DROP CONSTRAINT IF EXISTS fk_profiles_linked_personnel;

-- Drop services FKs (services has no outgoing FKs)

-- ============================================================================
-- SECTION 2: ALTER ALL PRIMARY AND FOREIGN KEY COLUMNS TO VARCHAR(64)
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

-- Ensure application_number column exists if not present in earlier schema
ALTER TABLE IF EXISTS public.pass_applications 
    ADD COLUMN IF NOT EXISTS application_number VARCHAR(64);

-- Table 7: issued_passes
ALTER TABLE IF EXISTS public.issued_passes 
    ALTER COLUMN id DROP DEFAULT,
    ALTER COLUMN id TYPE VARCHAR(64) USING id::text,
    ALTER COLUMN id SET DEFAULT uuid_generate_v4()::text,
    ALTER COLUMN application_id TYPE VARCHAR(64) USING application_id::text,
    ALTER COLUMN applicant_id TYPE VARCHAR(64) USING applicant_id::text,
    ALTER COLUMN department_id TYPE VARCHAR(64) USING department_id::text,
    ALTER COLUMN issued_by TYPE VARCHAR(64) USING issued_by::text;

-- Ensure qr_payload_encoded column exists
ALTER TABLE IF EXISTS public.issued_passes 
    ADD COLUMN IF NOT EXISTS qr_payload_encoded TEXT;

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
-- SECTION 3: RE-CREATE ALL FOREIGN KEY CONSTRAINTS
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

-- membership_requests constraints
ALTER TABLE public.membership_requests
    ADD CONSTRAINT fk_memreq_user
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_memreq_dept
    FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_memreq_reviewed_by
    FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- department_memberships constraints
ALTER TABLE public.department_memberships
    ADD CONSTRAINT fk_deptmem_user
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_deptmem_dept
    FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_deptmem_approved_by
    FOREIGN KEY (approved_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- pass_applications constraints
ALTER TABLE public.pass_applications
    ADD CONSTRAINT fk_passapp_applicant
    FOREIGN KEY (applicant_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_passapp_dept
    FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_passapp_reviewed_by
    FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- issued_passes constraints
ALTER TABLE public.issued_passes
    ADD CONSTRAINT fk_isspass_app
    FOREIGN KEY (application_id) REFERENCES public.pass_applications(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_isspass_applicant
    FOREIGN KEY (applicant_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_isspass_dept
    FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_isspass_issued_by
    FOREIGN KEY (issued_by) REFERENCES public.profiles(id);

-- verification_tokens constraints
ALTER TABLE public.verification_tokens
    ADD CONSTRAINT fk_veriftok_pass
    FOREIGN KEY (pass_id) REFERENCES public.issued_passes(id) ON DELETE CASCADE;

-- pass_revocations constraints
ALTER TABLE public.pass_revocations
    ADD CONSTRAINT fk_passrev_pass
    FOREIGN KEY (pass_id) REFERENCES public.issued_passes(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_passrev_revoked_by
    FOREIGN KEY (revoked_by) REFERENCES public.profiles(id);

-- verification_logs constraints
ALTER TABLE public.verification_logs
    ADD CONSTRAINT fk_veriflog_pass
    FOREIGN KEY (pass_id) REFERENCES public.issued_passes(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_veriflog_operator
    FOREIGN KEY (operator_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- ============================================================================
-- SECTION 4: UPDATE RLS POLICIES FOR STRING ID MATCHING
-- ============================================================================

-- Recreate RLS policies that compare auth.uid() (UUID) with profiles.id (VARCHAR)
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
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid()::text = id);

DROP POLICY IF EXISTS "Central admin manage departments" ON public.departments;
CREATE POLICY "Central admin manage departments" ON public.departments FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid()::text AND UPPER(profiles.role) IN ('CENTRAL_ADMIN', 'SUPER_ADMIN'))
);

DROP POLICY IF EXISTS "Audit logs readable by authorized admins" ON public.audit_logs;
CREATE POLICY "Audit logs readable by authorized admins" ON public.audit_logs FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid()::text AND UPPER(profiles.role) IN ('CENTRAL_ADMIN', 'SUPER_ADMIN', 'DEPARTMENT_HEAD', 'DEPARTMENT_ADMIN'))
);

-- ============================================================================
-- SECTION 5: SECURITY SANITIZATION (TASK 4 REMEDIATION)
-- Ensure anon has NO direct SELECT privilege on sensitive pass or profile tables
-- ============================================================================

REVOKE SELECT ON public.issued_passes FROM anon;
REVOKE SELECT ON public.profiles FROM anon;
REVOKE SELECT ON public.pass_applications FROM anon;
REVOKE SELECT ON public.verification_tokens FROM anon;
REVOKE SELECT ON public.pass_revocations FROM anon;
REVOKE SELECT ON public.audit_logs FROM anon;

COMMIT;

-- ============================================================================
-- ROLLBACK SCRIPT (DOCUMENTED RECOVERY STRATEGY)
-- If rollback to strict UUID columns is ever required:
-- NOTE: Rollback will only succeed if all stored values are valid UUID strings.
-- ============================================================================
/*
BEGIN;
-- 1. Drop re-added FKs
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS fk_profiles_linked_personnel;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS fk_profiles_assigned_dept;
ALTER TABLE public.departments DROP CONSTRAINT IF EXISTS fk_departments_service;
ALTER TABLE public.departments DROP CONSTRAINT IF EXISTS fk_departments_parent;
ALTER TABLE public.departments DROP CONSTRAINT IF EXISTS fk_departments_head_personnel;
ALTER TABLE public.departments DROP CONSTRAINT IF EXISTS fk_departments_head_account;
ALTER TABLE public.membership_requests DROP CONSTRAINT IF EXISTS fk_memreq_user;
ALTER TABLE public.membership_requests DROP CONSTRAINT IF EXISTS fk_memreq_dept;
ALTER TABLE public.membership_requests DROP CONSTRAINT IF EXISTS fk_memreq_reviewed_by;
ALTER TABLE public.department_memberships DROP CONSTRAINT IF EXISTS fk_deptmem_user;
ALTER TABLE public.department_memberships DROP CONSTRAINT IF EXISTS fk_deptmem_dept;
ALTER TABLE public.department_memberships DROP CONSTRAINT IF EXISTS fk_deptmem_approved_by;
ALTER TABLE public.pass_applications DROP CONSTRAINT IF EXISTS fk_passapp_applicant;
ALTER TABLE public.pass_applications DROP CONSTRAINT IF EXISTS fk_passapp_dept;
ALTER TABLE public.pass_applications DROP CONSTRAINT IF EXISTS fk_passapp_reviewed_by;
ALTER TABLE public.issued_passes DROP CONSTRAINT IF EXISTS fk_isspass_app;
ALTER TABLE public.issued_passes DROP CONSTRAINT IF EXISTS fk_isspass_applicant;
ALTER TABLE public.issued_passes DROP CONSTRAINT IF EXISTS fk_isspass_dept;
ALTER TABLE public.issued_passes DROP CONSTRAINT IF EXISTS fk_isspass_issued_by;
ALTER TABLE public.verification_tokens DROP CONSTRAINT IF EXISTS fk_veriftok_pass;
ALTER TABLE public.pass_revocations DROP CONSTRAINT IF EXISTS fk_passrev_pass;
ALTER TABLE public.pass_revocations DROP CONSTRAINT IF EXISTS fk_passrev_revoked_by;
ALTER TABLE public.verification_logs DROP CONSTRAINT IF EXISTS fk_veriflog_pass;
ALTER TABLE public.verification_logs DROP CONSTRAINT IF EXISTS fk_veriflog_operator;

-- 2. Convert back to UUID (fails if non-UUID slug strings exist)
ALTER TABLE public.services ALTER COLUMN id TYPE UUID USING id::uuid;
ALTER TABLE public.profiles ALTER COLUMN id TYPE UUID USING id::uuid, ALTER COLUMN linked_personnel_id TYPE UUID USING linked_personnel_id::uuid, ALTER COLUMN assigned_department_id TYPE UUID USING assigned_department_id::uuid;
ALTER TABLE public.departments ALTER COLUMN id TYPE UUID USING id::uuid, ALTER COLUMN service_id TYPE UUID USING service_id::uuid, ALTER COLUMN parent_id TYPE UUID USING parent_id::uuid, ALTER COLUMN head_personnel_id TYPE UUID USING head_personnel_id::uuid, ALTER COLUMN head_account_id TYPE UUID USING head_account_id::uuid;
-- (re-apply original schema.sql definitions)
COMMIT;
*/
