-- ============================================================================
-- SEVA PASS: Database-Enforced Audit Log Append-Only Protection Migration
-- File: supabase/migrations/03_audit_log_append_only.sql
--
-- PURPOSE:
-- Enforce database-level append-only guarantees and strict least-privilege on public.audit_logs.
-- Prevents UPDATE, DELETE, and TRUNCATE operations while preserving backend logging.
--
-- SECURITY ARCHITECTURE:
-- 1. Triggers execute BEFORE UPDATE OR DELETE FOR EACH ROW and BEFORE TRUNCATE FOR EACH STATEMENT.
-- 2. Direct API roles (anon, authenticated, PUBLIC) have ALL table privileges revoked.
--    This prevents forged audit injection and unauthorized log reading via Supabase PostgREST.
-- 3. Backend service_role is granted strictly least-privilege INSERT and SELECT.
--    All UPDATE, DELETE, TRUNCATE, REFERENCES, and TRIGGER privileges are revoked.
-- 4. Superuser/Owner Limitation: A database superuser or table owner with ALTER TABLE privileges
--    can administratively disable triggers. This protection guarantees that standard DML operations,
--    application connections, compromised API tokens, and standard database roles CANNOT mutate,
--    erase, or truncate historical audit records.
-- ============================================================================

BEGIN;

-- 1. Create tamper-prevention trigger function
CREATE OR REPLACE FUNCTION public.prevent_audit_logs_tampering()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'SECURITY VIOLATION [SEVA-PASS-AUDIT]: audit_logs is append-only. Modification or deletion of audit records is strictly prohibited.'
        USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

-- 2. Attach row-level trigger preventing UPDATE and DELETE
DROP TRIGGER IF EXISTS trg_audit_logs_prevent_modification ON public.audit_logs;
CREATE TRIGGER trg_audit_logs_prevent_modification
BEFORE UPDATE OR DELETE ON public.audit_logs
FOR EACH ROW
EXECUTE FUNCTION public.prevent_audit_logs_tampering();

-- 3. Attach statement-level trigger preventing TRUNCATE
DROP TRIGGER IF EXISTS trg_audit_logs_prevent_truncate ON public.audit_logs;
CREATE TRIGGER trg_audit_logs_prevent_truncate
BEFORE TRUNCATE ON public.audit_logs
FOR EACH STATEMENT
EXECUTE FUNCTION public.prevent_audit_logs_tampering();

-- 4. Revoke ALL table privileges from untrusted and client API roles
REVOKE ALL ON public.audit_logs FROM anon;
REVOKE ALL ON public.audit_logs FROM authenticated;
REVOKE ALL ON public.audit_logs FROM PUBLIC;

-- 5. Least-privilege grants strictly for trusted backend service_role
REVOKE ALL ON public.audit_logs FROM service_role;
GRANT INSERT, SELECT ON public.audit_logs TO service_role;

COMMIT;
