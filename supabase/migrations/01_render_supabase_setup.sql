-- ============================================================================
-- SEVA PASS: Supabase PostgreSQL Grants, Schema Compatibility & Permissions
-- Target Project: baxvuknavtndoliszadz (or any target Supabase project)
-- Instruction: Run this script in the Supabase Dashboard -> SQL Editor
-- ============================================================================

-- 1. Ensure public schema usage for PostgREST API roles
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- 2. Grant full permissions to service_role (used by FastAPI backend)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role;

-- 3. Grant authenticated permissions (least-privilege for authenticated API consumers)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT SELECT ON public.services TO authenticated;
GRANT SELECT ON public.departments TO authenticated;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT ON public.pass_applications TO authenticated;
GRANT SELECT ON public.issued_passes TO authenticated;
GRANT INSERT ON public.verification_logs TO authenticated;

-- 4. Grant anonymous public access strictly for public reference and verification logging
-- NOTE: anon must NEVER have direct SELECT access to issued_passes or profiles (PII leak).
-- Public pass verification is performed securely via the backend /api/passes/verify endpoint.
GRANT SELECT ON public.services TO anon;
GRANT SELECT ON public.departments TO anon;
GRANT INSERT ON public.verification_logs TO anon;

-- 5. Future table defaults (DO NOT grant SELECT on future tables to anon)
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE ON TABLES TO authenticated;

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

-- 8. Verification Result constraint normalization
ALTER TABLE IF EXISTS public.verification_logs DROP CONSTRAINT IF EXISTS verification_logs_verification_result_check;
ALTER TABLE IF EXISTS public.verification_logs ADD CONSTRAINT verification_logs_verification_result_check 
    CHECK (verification_result IN ('VALID', 'INVALID', 'INVALID SIGNATURE', 'EXPIRED', 'REVOKED', 'VEHICLE MISMATCH', 'VEHICLE_MISMATCH', 'REPLAY DETECTED', 'MANUAL REVIEW REQUIRED'));
