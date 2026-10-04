-- 00099: approval delegation (OOO cover, depth 1).
--
-- approval_delegations lets an owner/admin hand their deciding power to
-- an org member for a window: all-scope (group_id NULL) or one group.
-- Any-one-of-group semantics extend naturally — a delegate is one more
-- decider, and first-writer-wins still settles. The guarded list:
--  - self-dealing: delegate may never be the request's requester
--    (checked at grant and at decide, since rows arrive later);
--  - chains: delegates cannot grant (grant RPCs require owner/admin,
--    and a delegatee's Member role fails that check);
--  - outsiders: both sides must share the org, re-checked at decide
--    (handles removal mid-delegation);
--  - post-expiry: the RLS arms carry the time predicate (00090 style),
--    so the cron gap grants nothing; a hygiene pass flips husks.
-- Request rows stay immutable; delegation adds EXISTS arms to the queue
-- policies, same shape as the group-member arms in 00098.

CREATE TABLE IF NOT EXISTS approval_delegations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  group_id UUID REFERENCES permission_groups(id) ON DELETE CASCADE,
  delegator UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delegate UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (delegator <> delegate),
  CHECK (ends_at IS NULL OR ends_at > starts_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_delegation_live_scoped
  ON approval_delegations (org_id, group_id, delegator, delegate)
  WHERE is_active AND group_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_delegation_live_blanket
  ON approval_delegations (org_id, delegator, delegate)
  WHERE is_active AND group_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_delegations_delegate
  ON approval_delegations (delegate) WHERE is_active;

CREATE INDEX IF NOT EXISTS idx_delegations_expiry
  ON approval_delegations (ends_at) WHERE is_active AND ends_at IS NOT NULL;

ALTER TABLE approval_delegations ENABLE ROW LEVEL SECURITY;

-- Reads open to org members; no direct writes — RPCs only.
DROP POLICY IF EXISTS "Org members read delegations" ON approval_delegations;
CREATE POLICY "Org members read delegations"
  ON approval_delegations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members m
      WHERE m.org_id = approval_delegations.org_id AND m.user_id = auth.uid()
    )
  );

-- Live-delegation predicate, shared by the queue policy arms below:
-- active, started, unexpired, unrevoked.
CREATE OR REPLACE FUNCTION delegation_is_live(p_delegation approval_delegations)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT p_delegation.is_active
    AND p_delegation.revoked_at IS NULL
    AND p_delegation.starts_at <= now()
    AND (p_delegation.ends_at IS NULL OR p_delegation.ends_at > now())
$$;

-- A delegation covers a request when it is live, the delegator is the
-- routed party (designated user or member of the routed group), and the
-- scope matches (NULL group_id covers everything).
CREATE OR REPLACE FUNCTION delegation_covers_request(p_delegate UUID, p_request approval_requests)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM approval_delegations d
    LEFT JOIN permission_group_members gm
      ON gm.group_id = p_request.approver_group_id AND gm.user_id = d.delegator
    WHERE d.delegate = p_delegate
      AND (
        d.delegator = p_request.approver_user_id
        OR (p_request.approver_group_id IS NOT NULL AND gm.user_id IS NOT NULL)
      )
      AND (
        d.group_id IS NULL
        OR (p_request.approver_group_id IS NOT NULL AND d.group_id = p_request.approver_group_id)
      )
      AND delegation_is_live(d)
  ) INTO v_match;
  RETURN COALESCE(v_match, false);
END;
$$;

CREATE OR REPLACE FUNCTION grant_approval_delegation(
  p_org_id UUID,
  p_group_id UUID,
  p_delegate UUID,
  p_ends_at TIMESTAMPTZ
)
RETURNS TABLE (success BOOLEAN, message TEXT, id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_acting_role TEXT;
  v_new_id UUID;
  v_existing UUID;
BEGIN
  IF p_delegate = auth.uid() THEN
    RETURN QUERY SELECT false, 'You cannot cover for yourself', NULL::UUID;
    RETURN;
  END IF;
  IF p_ends_at IS NOT NULL AND p_ends_at <= now() THEN
    RETURN QUERY SELECT false, 'Coverage must end in the future', NULL::UUID;
    RETURN;
  END IF;
  SELECT role INTO v_acting_role FROM organization_members
  WHERE org_id = p_org_id AND user_id = auth.uid();
  IF NOT FOUND OR v_acting_role NOT IN ('owner', 'admin') THEN
    RETURN QUERY SELECT false, 'Only organization owners and admins can hand over approvals', NULL::UUID;
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM organization_members
    WHERE org_id = p_org_id AND user_id = p_delegate
  ) THEN
    RETURN QUERY SELECT false, 'Cover must go to a member of this organization', NULL::UUID;
    RETURN;
  END IF;
  IF p_group_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM permission_groups WHERE id = p_group_id AND org_id = p_org_id
  ) THEN
    RETURN QUERY SELECT false, 'Group not found in this organization', NULL::UUID;
    RETURN;
  END IF;
  -- Serialize on granter+org: NULL group scopes never conflict in unique
  -- indexes, so the check-then-write below needs the lock, not ON CONFLICT.
  PERFORM pg_advisory_xact_lock(hashtext('deleg:' || p_org_id::text || ':' || auth.uid()::text));
  SELECT id INTO v_existing FROM approval_delegations
  WHERE org_id = p_org_id
    AND delegator = auth.uid()
    AND delegate = p_delegate
    AND ((group_id IS NULL AND p_group_id IS NULL) OR group_id = p_group_id)
    AND is_active;
  IF FOUND THEN
    UPDATE approval_delegations
    SET ends_at = p_ends_at, starts_at = now(), revoked_at = NULL
    WHERE id = v_existing
    RETURNING approval_delegations.id INTO v_new_id;
  ELSE
    INSERT INTO approval_delegations (org_id, group_id, delegator, delegate, ends_at)
    VALUES (p_org_id, p_group_id, auth.uid(), p_delegate, p_ends_at)
    RETURNING approval_delegations.id INTO v_new_id;
  END IF;
  RETURN QUERY SELECT true, 'Coverage granted', v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION grant_approval_delegation(UUID, UUID, UUID, TIMESTAMPTZ) TO authenticated;

CREATE OR REPLACE FUNCTION revoke_approval_delegation(p_delegation_id UUID)
RETURNS TABLE (success BOOLEAN, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row approval_delegations%ROWTYPE;
  v_acting_role TEXT;
BEGIN
  SELECT * INTO v_row FROM approval_delegations WHERE id = p_delegation_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Coverage not found';
    RETURN;
  END IF;
  SELECT role INTO v_acting_role FROM organization_members
  WHERE org_id = v_row.org_id AND user_id = auth.uid();
  IF v_row.delegator <> auth.uid()
    AND NOT (FOUND AND v_acting_role IN ('owner', 'admin'))
    AND v_row.delegate <> auth.uid() THEN
    RETURN QUERY SELECT false, 'Only the granter, an owner, or the cover can end coverage';
    RETURN;
  END IF;
  UPDATE approval_delegations
  SET is_active = false, revoked_at = now()
  WHERE id = p_delegation_id AND is_active;
  RETURN QUERY SELECT true, 'Coverage ended';
END;
$$;

GRANT EXECUTE ON FUNCTION revoke_approval_delegation(UUID) TO authenticated;

-- Hygiene: flip lapsed rows so queues read honestly. Enforcement lives
-- in the live-checks (RLS + decide-time), never in this pass.
CREATE OR REPLACE FUNCTION expire_approval_delegations()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE approval_delegations
  SET is_active = false
  WHERE is_active AND ends_at IS NOT NULL AND ends_at <= now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Queue policies gain the delegation arm. Decided verdicts stay
-- immutable through the same pending pins.
DROP POLICY IF EXISTS "Approval parties read shared requests" ON approval_requests;
CREATE POLICY "Approval parties read shared requests"
  ON approval_requests FOR SELECT
  USING (
    auth.uid() = user_id
    OR auth.uid() = approver_user_id
    OR (
      approver_group_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM permission_group_members gm
        WHERE gm.group_id = approval_requests.approver_group_id AND gm.user_id = auth.uid()
      )
    )
    OR delegation_covers_request(auth.uid(), approval_requests)
  );

DROP POLICY IF EXISTS "Approvers decide pending requests" ON approval_requests;
CREATE POLICY "Approvers decide pending requests"
  ON approval_requests FOR UPDATE
  USING (
    verdict = 'pending'
    AND (
      auth.uid() = approver_user_id
      OR (
        approver_group_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM permission_group_members gm
          WHERE gm.group_id = approval_requests.approver_group_id AND gm.user_id = auth.uid()
        )
      )
      OR delegation_covers_request(auth.uid(), approval_requests)
    )
  )
  WITH CHECK (
    auth.uid() = approver_user_id
    OR (
      approver_group_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM permission_group_members gm
        WHERE gm.group_id = approval_requests.approver_group_id AND gm.user_id = auth.uid()
      )
    )
    OR delegation_covers_request(auth.uid(), approval_requests)
  );
