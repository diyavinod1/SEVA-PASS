-- ============================================================================
-- SEVA PASS: Supabase Schema Compatibility, Grants & Permissions Setup
-- File: supabase/migrations/01_render_supabase_setup.sql
-- Instruction: Run this script in the Supabase Dashboard -> SQL Editor
-- ============================================================================

BEGIN;

-- 1. Ensure public schema usage for PostgREST API roles
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- 2. Grant full permissions to service_role (used by FastAPI backend)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role;

-- 3. Least-privilege grants for authenticated users (read-only reference data)
-- All state mutations (applications, approvals, reviews) are processed by the FastAPI backend
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT SELECT ON public.services TO authenticated;
GRANT SELECT ON public.departments TO authenticated;

-- Revoke direct table write grants from authenticated if previously applied
REVOKE INSERT, UPDATE, DELETE ON public.profiles FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.pass_applications FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.issued_passes FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.verification_logs FROM authenticated;

-- 4. Grant anonymous public access strictly for public reference
-- NOTE: anon must NEVER have SELECT access to issued_passes or profiles (PII protection).
-- Public pass verification is performed securely via the backend /api/verification/verify-public endpoint.
GRANT SELECT ON public.services TO anon;
GRANT SELECT ON public.departments TO anon;

REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.pass_applications FROM anon;
REVOKE ALL ON public.issued_passes FROM anon;
REVOKE ALL ON public.pass_revocations FROM anon;
REVOKE ALL ON public.audit_logs FROM anon;
REVOKE ALL ON public.verification_logs FROM anon;

-- 5. Future table defaults (DO NOT grant table permissions to anon)
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM authenticated;

-- 6. Role check constraint normalization
-- Allows both uppercase ('CENTRAL_ADMIN', 'DEPARTMENT_HEAD', 'PERSONNEL') and lowercase
ALTER TABLE IF EXISTS public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE IF EXISTS public.profiles ADD CONSTRAINT profiles_role_check 
    CHECK (UPPER(role) IN ('CENTRAL_ADMIN', 'DEPARTMENT_HEAD', 'PERSONNEL', 'TOLL_OPERATOR', 'SUPER_ADMIN', 'DEPARTMENT_ADMIN', 'MEMBER'));

ALTER TABLE IF EXISTS public.profiles DROP CONSTRAINT IF EXISTS profiles_account_type_check;
ALTER TABLE IF EXISTS public.profiles ADD CONSTRAINT profiles_account_type_check 
    CHECK (LOWER(account_type) IN ('central_admin', 'department_head', 'personnel', 'toll_operator'));

-- 7. Pass Application status constraint normalization
ALTER TABLE IF EXISTS public.pass_applications DROP CONSTRAINT IF EXISTS pass_applications_status_check;
ALTER TABLE IF EXISTS public.pass_applications ADD CONSTRAINT pass_applications_status_check 
    CHECK (LOWER(status) IN ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'revoked', 'expired'));

-- 8. Verification Result constraint normalization (Supports both backend 'INVALID'/'VEHICLE_MISMATCH' and legacy strings)
ALTER TABLE IF EXISTS public.verification_logs DROP CONSTRAINT IF EXISTS verification_logs_verification_result_check;
ALTER TABLE IF EXISTS public.verification_logs ADD CONSTRAINT verification_logs_verification_result_check 
    CHECK (verification_result IN ('VALID', 'INVALID', 'INVALID SIGNATURE', 'EXPIRED', 'REVOKED', 'VEHICLE MISMATCH', 'VEHICLE_MISMATCH', 'REPLAY DETECTED', 'MANUAL REVIEW REQUIRED'));

COMMIT;
