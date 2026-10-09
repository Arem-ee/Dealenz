-- 00129: least-privilege grant hardening.
-- 00007 granted SELECT/INSERT/UPDATE/DELETE on ALL tables (present and future)
-- to `authenticated`. RLS still gates rows, but any future table that forgets
-- ENABLE RLS would be writable by every logged-in user.
-- This migration removes the *future* default DELETE grant so new tables are
-- never auto-deletable; per-table DELETE on existing tables stays governed
-- by their RLS policies. A follow-up should split remaining FOR ALL policies
-- on high-value tables (audits, document_versions, credit_ledger-adjacent)
-- into per-operation policies during a maintenance window.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE DELETE ON TABLES FROM authenticated;

-- Keep SELECT/INSERT/UPDATE future grants (required by RLS-scoped app writes).
-- No REVOKE on existing per-table grants here to avoid breaking live deletes
-- (schedules, quotas, org membership flows) outside a window.
