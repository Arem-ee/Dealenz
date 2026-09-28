-- Read-only service_role grants for the admin activation funnel
-- (/admin/activation). Follows the least-privilege pattern (see 00055):
-- SELECT only, no INSERT/UPDATE/DELETE, consumed solely by admin-gated
-- server code that aggregates counts (never content) for founder metrics.
-- STAGING: verify on staging before prod (db push).

GRANT SELECT ON public.audits TO service_role;
GRANT SELECT ON public.conversations TO service_role;
GRANT SELECT ON public.referral_attributions TO service_role;
