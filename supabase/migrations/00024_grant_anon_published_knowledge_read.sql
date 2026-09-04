-- Phase 5F closure fix: anonymous readability of published knowledge.
--
-- Migration 00022 created the RLS policies ("Published knowledge is publicly
-- readable") but the anon role holds no table-level SELECT privilege on the
-- new table (platform default grants cover only pre-existing tables), so
-- anonymous resolution was denied before RLS was ever evaluated. This grant
-- completes the intended design: RLS still restricts anonymous reads to
-- status = 'published' rows. Authenticated privileges are unchanged, and no
-- write privilege is granted to any public role. credit_ledger intentionally
-- receives no anon grant.

GRANT SELECT ON knowledge_items TO anon;
