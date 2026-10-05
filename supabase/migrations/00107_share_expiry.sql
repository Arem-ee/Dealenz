-- 00107: share expiry + leakage predicates (phase 1: time-boxed shares).
--
-- deal_shares gains an optional expiry. Enforcement is lazy (the RLS
-- time predicates below, 00090 style), so the cron gap grants nothing; a
-- hygiene pass flips husks so queues read honestly. Existing shares keep
-- NULL expiry (open, exactly as before). The corpus-leakage read fix
-- lives in app code (getThread suppresses cross-deal conflicts for
-- shared viewers); these predicates close the direct-read paths.

ALTER TABLE deal_shares
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_deal_shares_expiry
  ON deal_shares (expires_at) WHERE expires_at IS NOT NULL;

-- Liveness shared by every predicate below: open or unexpired.
CREATE OR REPLACE FUNCTION deal_share_is_live(p_share deal_shares)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT p_share.expires_at IS NULL OR p_share.expires_at > now()
$$;

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
        AND deal_share_is_live(s)
    )
$$;

CREATE OR REPLACE FUNCTION deal_share_grants(
  p_deal_id UUID,
  p_user_id UUID,
  p_need TEXT
)
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
    WHERE s.deal_id = p_deal_id
      AND gm.user_id = p_user_id
      AND deal_share_is_live(s)
      AND (
        s.scope = 'participant'
        OR s.scope = p_need
      )
  )
$$;

-- delegation_covers_request is unaffected (delegation expiry lives in
-- approval_delegations), but the queue SELECT/UPDATE policies join
-- through group membership only — no change needed there.

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
        AND deal_share_is_live(s)
    )
  );

-- DROP first: the expiry parameter changes the signature, and the old
-- 2-arg version would otherwise linger beside the new one.
DROP FUNCTION IF EXISTS share_deal_with_group(UUID, UUID);
CREATE OR REPLACE FUNCTION share_deal_with_group(p_deal_id UUID, p_group_id UUID, p_expires_at TIMESTAMPTZ DEFAULT NULL)
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
  IF p_expires_at IS NOT NULL AND p_expires_at <= now() THEN
    RETURN QUERY SELECT false, 'Share expiry must be in the future';
    RETURN;
  END IF;
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
  INSERT INTO deal_shares (deal_id, group_id, shared_by, expires_at)
  VALUES (p_deal_id, p_group_id, auth.uid(), p_expires_at)
  ON CONFLICT (deal_id, group_id) DO UPDATE
  SET expires_at = EXCLUDED.expires_at;
  RETURN QUERY SELECT true, 'Deal shared with group';
END;
$$;

GRANT EXECUTE ON FUNCTION share_deal_with_group(UUID, UUID, TIMESTAMPTZ) TO authenticated;

CREATE OR REPLACE FUNCTION set_deal_share_expiry(p_deal_id UUID, p_group_id UUID, p_expires_at TIMESTAMPTZ)
RETURNS TABLE (success BOOLEAN, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner UUID;
BEGIN
  IF p_expires_at IS NOT NULL AND p_expires_at <= now() THEN
    RETURN QUERY SELECT false, 'Share expiry must be in the future';
    RETURN;
  END IF;
  SELECT user_id INTO v_owner FROM audits WHERE id = p_deal_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Deal not found';
    RETURN;
  END IF;
  IF v_owner <> auth.uid() THEN
    RETURN QUERY SELECT false, 'Only the deal owner can change sharing';
    RETURN;
  END IF;
  UPDATE deal_shares SET expires_at = p_expires_at
  WHERE deal_id = p_deal_id AND group_id = p_group_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'That share does not exist';
    RETURN;
  END IF;
  RETURN QUERY SELECT true, 'Share expiry updated';
END;
$$;

GRANT EXECUTE ON FUNCTION set_deal_share_expiry(UUID, UUID, TIMESTAMPTZ) TO authenticated;

-- Hygiene: revoke lapsed shares so queues read honestly (revoke =
-- unshare: the row goes away). Enforcement lives in the live-checks,
-- never in this pass. The cron caller reads lapsed rows first for owner
-- notice, then calls this.
CREATE OR REPLACE FUNCTION expire_deal_shares()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  DELETE FROM deal_shares
  WHERE expires_at IS NOT NULL AND expires_at <= now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
