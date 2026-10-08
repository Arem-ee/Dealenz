-- 00116: RLS infinite-recursion remediation (P0).
--
-- Root cause: several RLS policy expressions query RLS-protected tables
-- directly. PostgreSQL expands policies on every access including policy
-- subqueries, so audits → deal_shares → audits (00104/00107), the
-- organization_members self-check (00091), and every owner policy shaped
-- `EXISTS (SELECT 1 FROM audits ...)` recurse without bound. Live symptom:
-- 42P17 "infinite recursion detected in policy for relation audits" on
-- ALL reads of audits, versions, shares, orgs, groups, storage, signing
-- and monitoring tables, for every role including authenticated owners.
-- Verified live before this fix (anon + fresh authenticated user).
--
-- Fix pattern (already established in-repo via deal_visible_to /
-- deal_share_grants): policy expressions may reference ONLY auth.uid(),
-- their own row columns, cycle-free tables, or SECURITY DEFINER helpers
-- (owner bypasses RLS, terminating expansion). New helpers below cover
-- the two repeated shapes: deal ownership and org/group membership.
--
-- Semantics preserved exactly: every rewritten policy grants the same rows
-- as its predecessor minus the recursion. No access widened, none
-- narrowed — verified pair-by-pair in review. Forward-only.

-- Deal ownership without touching audits under RLS. Text parameter so
-- storage folder segments never need a failing uuid cast.
CREATE OR REPLACE FUNCTION rls_audit_owner(p_deal_id_text TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM audits WHERE id::text = p_deal_id_text AND user_id = auth.uid()
  )
$$;

-- Live share grant without touching audits under RLS. Mirrors the
-- enforcement predicates (open or unexpired + membership); expiry hygiene
-- stays with the cron pass, never this predicate.
CREATE OR REPLACE FUNCTION rls_deal_shared(p_deal_id_text TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM deal_shares s
    JOIN permission_group_members gm ON gm.group_id = s.group_id
    WHERE s.deal_id::text = p_deal_id_text
      AND gm.user_id = auth.uid()
      AND (s.expires_at IS NULL OR s.expires_at > now())
  )
$$;

-- Org membership without the self-referencing policy subquery.
CREATE OR REPLACE FUNCTION rls_org_member(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members WHERE org_id = p_org_id AND user_id = auth.uid()
  )
$$;

-- "Caller sits in the group org" without policy cycles.
CREATE OR REPLACE FUNCTION rls_group_org_member(p_group_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM permission_groups g
    JOIN organization_members m ON m.org_id = g.org_id
    WHERE g.id = p_group_id AND m.user_id = auth.uid()
  )
$$;

-- "Caller holds membership of this group" without policy cycles.
CREATE OR REPLACE FUNCTION rls_is_group_member(p_group_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM permission_group_members WHERE group_id = p_group_id AND user_id = auth.uid()
  )
$$;

-- Explicit execute grants (project convention per 00088: never rely on the
-- PUBLIC default — one hardening migration revoking it must not brick RLS).
GRANT EXECUTE ON FUNCTION rls_audit_owner(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION rls_deal_shared(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION rls_org_member(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION rls_group_org_member(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION rls_is_group_member(UUID) TO anon, authenticated;

-- audits: shared leg routes through the existing DEFINER helper.
DROP POLICY IF EXISTS "Shared readers read deals" ON audits;
CREATE POLICY "Shared readers read deals"
  ON audits FOR SELECT
  USING (public.deal_visible_to(audits.id, auth.uid()));

-- deal_shares: owner leg via helper; membership leg reads one clean table.
DROP POLICY IF EXISTS "Share parties read shares" ON deal_shares;
CREATE POLICY "Share parties read shares"
  ON deal_shares FOR SELECT
  USING (
    public.rls_audit_owner(deal_shares.deal_id::text)
    OR public.rls_is_group_member(deal_shares.group_id)
  );

-- organizations / memberships: self-reference replaced by helpers.
DROP POLICY IF EXISTS "Members read own organizations" ON organizations;
CREATE POLICY "Members read own organizations"
  ON organizations FOR SELECT
  USING (public.rls_org_member(organizations.id));

DROP POLICY IF EXISTS "Members read own memberships" ON organization_members;
CREATE POLICY "Members read own memberships"
  ON organization_members FOR SELECT
  USING (user_id = auth.uid() OR public.rls_org_member(organization_members.org_id));

-- groups / members: org-membership helper only.
DROP POLICY IF EXISTS "Org members read groups" ON permission_groups;
CREATE POLICY "Org members read groups"
  ON permission_groups FOR SELECT
  USING (public.rls_group_org_member(permission_groups.id));

DROP POLICY IF EXISTS "Org members read group members" ON permission_group_members;
CREATE POLICY "Org members read group members"
  ON permission_group_members FOR SELECT
  USING (public.rls_group_org_member(permission_group_members.group_id));

-- storage.objects owner legs (4 ops): path pin + helper ownership.
DROP POLICY IF EXISTS "Users can upload own files to audit-files" ON storage.objects;
CREATE POLICY "Users can upload own files to audit-files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'audit-files'
    AND auth.uid()::text = (storage.foldername(name))[1]
    AND public.rls_audit_owner((storage.foldername(name))[2])
  );

DROP POLICY IF EXISTS "Users can view own files in audit-files" ON storage.objects;
CREATE POLICY "Users can view own files in audit-files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'audit-files'
    AND auth.uid()::text = (storage.foldername(name))[1]
    AND public.rls_audit_owner((storage.foldername(name))[2])
  );

DROP POLICY IF EXISTS "Users can update own files in audit-files" ON storage.objects;
CREATE POLICY "Users can update own files in audit-files"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'audit-files'
    AND auth.uid()::text = (storage.foldername(name))[1]
    AND public.rls_audit_owner((storage.foldername(name))[2])
  );

DROP POLICY IF EXISTS "Users can delete own files in audit-files" ON storage.objects;
CREATE POLICY "Users can delete own files in audit-files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'audit-files'
    AND auth.uid()::text = (storage.foldername(name))[1]
    AND public.rls_audit_owner((storage.foldername(name))[2])
  );

-- storage.objects shared leg: helper, no audits join.
DROP POLICY IF EXISTS "Shared readers view deal files" ON storage.objects;
CREATE POLICY "Shared readers view deal files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'audit-files'
    AND public.rls_deal_shared((storage.foldername(name))[2])
  );

-- Owner-managed child tables: helper ownership in USING and WITH CHECK.
DROP POLICY IF EXISTS "Users can manage own document versions" ON document_versions;
CREATE POLICY "Users can manage own document versions"
  ON document_versions FOR ALL
  USING (
    auth.uid() = user_id
    AND public.rls_audit_owner(audit_id::text)
  )
  WITH CHECK (
    auth.uid() = user_id
    AND public.rls_audit_owner(audit_id::text)
  );

DROP POLICY IF EXISTS "Users manage own checklist items" ON checklist_items;
CREATE POLICY "Users manage own checklist items"
  ON checklist_items FOR ALL
  USING (
    auth.uid() = user_id
    AND public.rls_audit_owner(audit_id::text)
  )
  WITH CHECK (
    auth.uid() = user_id
    AND public.rls_audit_owner(audit_id::text)
  );

DROP POLICY IF EXISTS "Users manage own monitoring events" ON monitoring_events;
CREATE POLICY "Users manage own monitoring events"
  ON monitoring_events FOR ALL
  USING (
    auth.uid() = user_id
    AND public.rls_audit_owner(audit_id::text)
  )
  WITH CHECK (
    auth.uid() = user_id
    AND public.rls_audit_owner(audit_id::text)
  );

DROP POLICY IF EXISTS "Users manage own monitoring alerts" ON monitoring_alerts;
CREATE POLICY "Users manage own monitoring alerts"
  ON monitoring_alerts FOR ALL
  USING (
    auth.uid() = user_id
    AND public.rls_audit_owner(audit_id::text)
    AND EXISTS (SELECT 1 FROM monitoring_events e WHERE e.id = monitoring_event_id AND e.audit_id = monitoring_alerts.audit_id)
  )
  WITH CHECK (
    auth.uid() = user_id
    AND public.rls_audit_owner(audit_id::text)
    AND EXISTS (SELECT 1 FROM monitoring_events e WHERE e.id = monitoring_event_id AND e.audit_id = monitoring_alerts.audit_id)
  );

DROP POLICY IF EXISTS "Users manage own activity events" ON activity_events;
DROP POLICY IF EXISTS "Users can manage own activity events" ON activity_events;
CREATE POLICY "Users can manage own activity events"
  ON activity_events FOR ALL
  USING (
    auth.uid() = user_id
    AND (audit_id IS NULL OR public.rls_audit_owner(audit_id::text))
  )
  WITH CHECK (
    auth.uid() = user_id
    AND (audit_id IS NULL OR public.rls_audit_owner(audit_id::text))
  );

-- conversation_messages owner-delete leg.
DROP POLICY IF EXISTS "Thread owners remove reader rows" ON conversation_messages;
CREATE POLICY "Thread owners remove reader rows"
  ON conversation_messages FOR DELETE
  USING (
    auth.uid() <> user_id
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_messages.conversation_id
        AND c.attached_audit_id IS NOT NULL
        AND public.rls_audit_owner(c.attached_audit_id::text)
    )
  );

-- Signing tables: owner legs via helper (lawyer/consultation legs touch
-- only clean tables and are unchanged).
DROP POLICY IF EXISTS "Owners read own document signers" ON document_signers;
CREATE POLICY "Owners read own document signers"
  ON document_signers FOR SELECT
  USING (public.rls_audit_owner(document_signers.audit_id::text));

DROP POLICY IF EXISTS "Owners invite own document signers" ON document_signers;
CREATE POLICY "Owners invite own document signers"
  ON document_signers FOR INSERT
  WITH CHECK (public.rls_audit_owner(document_signers.audit_id::text));

DROP POLICY IF EXISTS "Owners update own document signers" ON document_signers;
CREATE POLICY "Owners update own document signers"
  ON document_signers FOR UPDATE
  USING (public.rls_audit_owner(document_signers.audit_id::text))
  WITH CHECK (public.rls_audit_owner(document_signers.audit_id::text));

DROP POLICY IF EXISTS "Users read signatures on own audits" ON document_signatures;
CREATE POLICY "Users read signatures on own audits"
  ON document_signatures FOR SELECT
  USING (public.rls_audit_owner(document_signatures.audit_id::text));

DROP POLICY IF EXISTS "Owners read own final documents" ON final_documents;
CREATE POLICY "Owners read own final documents"
  ON final_documents FOR SELECT
  USING (public.rls_audit_owner(final_documents.audit_id::text));

DROP POLICY IF EXISTS "Owners insert own final documents" ON final_documents;
CREATE POLICY "Owners insert own final documents"
  ON final_documents FOR INSERT
  WITH CHECK (public.rls_audit_owner(final_documents.audit_id::text));

DROP POLICY IF EXISTS "Owners update own final documents" ON final_documents;
CREATE POLICY "Owners update own final documents"
  ON final_documents FOR UPDATE
  USING (public.rls_audit_owner(final_documents.audit_id::text));

DROP POLICY IF EXISTS "Users read own signing events" ON signing_events;
CREATE POLICY "Users read own signing events"
  ON signing_events FOR SELECT
  USING (
    public.rls_audit_owner(signing_events.audit_id::text)
    OR EXISTS (SELECT 1 FROM document_signers ds WHERE ds.id = signing_events.signer_id AND ds.email = (SELECT email FROM auth.users WHERE id = auth.uid()))
  );

DROP POLICY IF EXISTS "Users insert own signing events" ON signing_events;
CREATE POLICY "Users insert own signing events"
  ON signing_events FOR INSERT
  WITH CHECK (public.rls_audit_owner(signing_events.audit_id::text));

DROP POLICY IF EXISTS "Owners read signature artifacts on own audits" ON signer_signature_artifacts;
CREATE POLICY "Owners read signature artifacts on own audits"
  ON signer_signature_artifacts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM document_signers s
      WHERE s.id = signer_signature_artifacts.signer_id
        AND public.rls_audit_owner(s.audit_id::text)
    )
  );

DROP POLICY IF EXISTS "Users manage own share tokens" ON share_tokens;
CREATE POLICY "Users manage own share tokens"
  ON share_tokens FOR ALL
  USING (public.rls_audit_owner(share_tokens.audit_id::text))
  WITH CHECK (public.rls_audit_owner(share_tokens.audit_id::text));

DROP POLICY IF EXISTS "Owners manage own deal guest grants" ON guest_grants;
CREATE POLICY "Owners manage own deal guest grants"
  ON guest_grants FOR ALL
  USING (public.rls_audit_owner(guest_grants.deal_id::text))
  WITH CHECK (public.rls_audit_owner(guest_grants.deal_id::text));

DROP POLICY IF EXISTS "Owners read own deal staged uploads" ON staged_uploads;
CREATE POLICY "Owners read own deal staged uploads"
  ON staged_uploads FOR ALL
  USING (public.rls_audit_owner(staged_uploads.deal_id::text))
  WITH CHECK (public.rls_audit_owner(staged_uploads.deal_id::text));
