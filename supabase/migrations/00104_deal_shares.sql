-- 00104: group-based deal access (phase 1: read-only shares).
--
-- deal_shares links a deal to a permission group; members read, never
-- write. The owner path is untouched everywhere: shares add an OR leg to
-- SELECT policies, and every mutation keeps its user_id chain, so shared
-- readers are excluded by construction. Writes flow only through the two
-- RPCs below (owner + same-org checks, mirroring the group RPCs).
-- Rollback is DROP TABLE + the added policies: app reads use the
-- two-query pattern (owned first, shared union second), which degrades
-- to owner-only with the table gone.

CREATE TABLE IF NOT EXISTS deal_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES permission_groups(id) ON DELETE CASCADE,
  shared_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (deal_id, group_id)
);

CREATE INDEX IF NOT EXISTS idx_deal_shares_deal ON deal_shares(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_shares_group ON deal_shares(group_id);

ALTER TABLE deal_shares ENABLE ROW LEVEL SECURITY;

-- Reads open to the deal owner and to members of shared-with groups.
-- No direct writes: RPCs only.
DROP POLICY IF EXISTS "Share parties read shares" ON deal_shares;
CREATE POLICY "Share parties read shares"
  ON deal_shares FOR SELECT
  USING (
    auth.uid() = (SELECT user_id FROM audits WHERE id = deal_shares.deal_id)
    OR EXISTS (
      SELECT 1 FROM permission_group_members gm
      WHERE gm.group_id = deal_shares.group_id AND gm.user_id = auth.uid()
    )
  );

-- Shared visibility predicate, one shape reused for every child table:
-- the caller reads a row when they own the parent deal or sit in a
-- group the deal is shared with.
CREATE OR REPLACE FUNCTION deal_visible_to(p_deal_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM audits a WHERE a.id = p_deal_id AND a.user_id = p_user_id)
    OR EXISTS (
      SELECT 1
      FROM deal_shares s
      JOIN permission_group_members gm ON gm.group_id = s.group_id
      WHERE s.deal_id = p_deal_id AND gm.user_id = p_user_id
    )
$$;

DROP POLICY IF EXISTS "Shared readers read deals" ON audits;
CREATE POLICY "Shared readers read deals"
  ON audits FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM deal_shares s
      JOIN permission_group_members gm ON gm.group_id = s.group_id
      WHERE s.deal_id = audits.id AND gm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Shared readers read versions" ON document_versions;
CREATE POLICY "Shared readers read versions"
  ON document_versions FOR SELECT
  USING (deal_visible_to(audit_id, auth.uid()));

DROP POLICY IF EXISTS "Shared readers read conversations" ON conversations;
CREATE POLICY "Shared readers read conversations"
  ON conversations FOR SELECT
  USING (
    attached_audit_id IS NOT NULL
    AND deal_visible_to(attached_audit_id, auth.uid())
  );

DROP POLICY IF EXISTS "Shared readers read messages" ON conversation_messages;
CREATE POLICY "Shared readers read messages"
  ON conversation_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_messages.conversation_id
        AND c.attached_audit_id IS NOT NULL
        AND deal_visible_to(c.attached_audit_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "Shared readers read monitoring" ON monitoring_events;
CREATE POLICY "Shared readers read monitoring"
  ON monitoring_events FOR SELECT
  USING (deal_visible_to(audit_id, auth.uid()));

DROP POLICY IF EXISTS "Shared readers read alerts" ON monitoring_alerts;
CREATE POLICY "Shared readers read alerts"
  ON monitoring_alerts FOR SELECT
  USING (deal_visible_to(audit_id, auth.uid()));

DROP POLICY IF EXISTS "Shared readers read corpus" ON corpus_clauses;
CREATE POLICY "Shared readers read corpus"
  ON corpus_clauses FOR SELECT
  USING (deal_visible_to(audit_id, auth.uid()));

-- Storage: shared readers may READ deal files. No write arms (read-only
-- shares). Path layout stays {ownerUid}/{auditId}/... — no migration.
DROP POLICY IF EXISTS "Shared readers view deal files" ON storage.objects;
CREATE POLICY "Shared readers view deal files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'audit-files'
    AND EXISTS (
      SELECT 1
      FROM audits a
      JOIN deal_shares s ON s.deal_id = a.id
      JOIN permission_group_members gm ON gm.group_id = s.group_id
      WHERE a.id::text = (storage.foldername(name))[2]
        AND gm.user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION share_deal_with_group(p_deal_id UUID, p_group_id UUID)
RETURNS TABLE (success BOOLEAN, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner UUID;
  v_org_id UUID;
  v_acting_role TEXT;
BEGIN
  SELECT user_id INTO v_owner FROM audits WHERE id = p_deal_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Deal not found';
    RETURN;
  END IF;
  IF v_owner <> auth.uid() THEN
    RETURN QUERY SELECT false, 'Only the deal owner can share it';
    RETURN;
  END IF;
  SELECT org_id INTO v_org_id FROM permission_groups WHERE id = p_group_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Group not found';
    RETURN;
  END IF;
  SELECT role INTO v_acting_role FROM organization_members
  WHERE org_id = v_org_id AND user_id = auth.uid();
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'You can only share with groups of your own organizations';
    RETURN;
  END IF;
  INSERT INTO deal_shares (deal_id, group_id, shared_by)
  VALUES (p_deal_id, p_group_id, auth.uid())
  ON CONFLICT (deal_id, group_id) DO NOTHING;
  RETURN QUERY SELECT true, 'Deal shared with group';
END;
$$;

GRANT EXECUTE ON FUNCTION share_deal_with_group(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION unshare_deal_with_group(p_deal_id UUID, p_group_id UUID)
RETURNS TABLE (success BOOLEAN, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner UUID;
BEGIN
  SELECT user_id INTO v_owner FROM audits WHERE id = p_deal_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Deal not found';
    RETURN;
  END IF;
  IF v_owner <> auth.uid() THEN
    RETURN QUERY SELECT false, 'Only the deal owner can change sharing';
    RETURN;
  END IF;
  DELETE FROM deal_shares WHERE deal_id = p_deal_id AND group_id = p_group_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'That share does not exist';
    RETURN;
  END IF;
  RETURN QUERY SELECT true, 'Sharing revoked';
END;
$$;

GRANT EXECUTE ON FUNCTION unshare_deal_with_group(UUID, UUID) TO authenticated;
