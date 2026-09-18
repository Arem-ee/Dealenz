-- Phase 21B: narrow service-role grants for Paddle billing fulfillment.
--
-- The Paddle webhook is a verified server-side fulfillment path
-- (HMAC-verified in src/app/api/billing/webhook/route.ts). It runs
-- unauthenticated, so it cannot act as the purchasing user; the billing
-- tables intentionally expose no user write policies (see 00023, 00037).
-- It therefore requires direct writes through the service_role client.
--
-- No historical migration ever granted service_role any table privileges,
-- so paid fulfillment currently fails with permission-denied errors.
-- This migration grants the minimum set the webhook and its failure
-- reporting perform, and nothing else:
--
--   credit_purchases: SELECT (idempotency lookup), INSERT (record purchase),
--     UPDATE (pending -> succeeded/failed/canceled). No DELETE.
--   credit_ledger: SELECT (grant-existence check), INSERT (purchase grant).
--     No UPDATE (grants are append-only), no DELETE.
--   system_logs: INSERT (critical failure reporting). No SELECT/UPDATE/DELETE.
--
-- Primary keys are UUID DEFAULT gen_random_uuid(): no sequence privileges
-- are required for the INSERT path, so none are granted.
--
-- Explicit table names only. No GRANT ALL, no default privileges, no RLS,
-- policy, ownership, column, constraint, index, or RPC changes.

GRANT SELECT, INSERT, UPDATE ON public.credit_purchases TO service_role;

GRANT SELECT, INSERT ON public.credit_ledger TO service_role;

GRANT INSERT ON public.system_logs TO service_role;
