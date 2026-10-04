-- 00098: approval groups (phase 1: any-one-of-group routing).
--
-- permission_groups are named sets of org members that approval requests
-- can route to; any member's decision settles the request
-- (first-writer-wins on the pending row — quorum is a later slice).
-- Tables mirror organizations/organization_members (00091): reads open
-- within the org, writes exclusively through SECURITY DEFINER RPCs that
-- enforce owner/admin acting rights. The routing half relaxes
-- approval_requests from named-only to named-XOR-group and extends the
-- queue policies so group members can read and decide group-routed rows.
-- Decided verdicts stay immutable through the same pending-pinned
-- policies; nothing about the named flow changes.

CREATE TABLE IF NOT EXISTS permission_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, name)
);

CREATE INDEX IF NOT EXISTS idx_permission_groups_org ON permission_groups(org_id);

CREATE TABLE IF NOT EXISTS permission_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES permission_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  added_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_pgm_group ON permission_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_pgm_user ON permission_group_members(user_id);

ALTER TABLE permission_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE permission_group_members ENABLE ROW LEVEL SECURITY;

-- Reads open to org members; no INSERT/UPDATE/DELETE policies — writes
-- flow exclusively through the RPCs below.
DROP POLICY IF EXISTS "Org members read groups" ON permission_groups;
CREATE POLICY "Org members read groups"
  ON permission_groups FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members m
      WHERE m.org_id = permission_groups.org_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Org members read group members" ON permission_group_members;
CREATE POLICY "Org members read group members"
  ON permission_group_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM permission_groups g
      JOIN organization_members m ON m.org_id = g.org_id
      WHERE g.id = permission_group_members.group_id AND m.user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION create_permission_group(p_org_id UUID, p_name TEXT)
RETURNS TABLE (id UUID, name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group permission_groups%ROWTYPE;
  v_name TEXT;
  v_acting_role TEXT;
BEGIN
  v_name := btrim(COALESCE(p_name, ''));
  IF char_length(v_name) < 1 OR char_length(v_name) > 120 THEN
    RAISE EXCEPTION 'Group name must be 1 to 120 characters';
  END IF;
  SELECT role INTO v_acting_role FROM organization_members
  WHERE org_id = p_org_id AND user_id = auth.uid();
  IF NOT FOUND OR v_acting_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Only organization owners and admins can create groups';
  END IF;
  INSERT INTO permission_groups (org_id, name, created_by)
  VALUES (p_org_id, v_name, auth.uid())
  RETURNING * INTO v_group;
  RETURN QUERY SELECT v_group.id, v_group.name;
END;
$$;

GRANT EXECUTE ON FUNCTION create_permission_group(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION add_permission_group_member(p_group_id UUID, p_user_id UUID)
RETURNS TABLE (success BOOLEAN, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_acting_role TEXT;
  v_target_role TEXT;
BEGIN
  SELECT org_id INTO v_org_id FROM permission_groups WHERE id = p_group_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Group not found';
    RETURN;
  END IF;
  SELECT role INTO v_acting_role FROM organization_members
  WHERE org_id = v_org_id AND user_id = auth.uid();
  IF NOT FOUND OR v_acting_role NOT IN ('owner', 'admin') THEN
    RETURN QUERY SELECT false, 'Only organization owners and admins can manage groups';
    RETURN;
  END IF;
  SELECT role INTO v_target_role FROM organization_members
  WHERE org_id = v_org_id AND user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'That account is not a member of this organization';
    RETURN;
  END IF;
  INSERT INTO permission_group_members (group_id, user_id, added_by)
  VALUES (p_group_id, p_user_id, auth.uid())
  ON CONFLICT (group_id, user_id) DO NOTHING;
  RETURN QUERY SELECT true, 'Member added to group';
END;
$$;

GRANT EXECUTE ON FUNCTION add_permission_group_member(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION remove_permission_group_member(p_group_id UUID, p_user_id UUID)
RETURNS TABLE (success BOOLEAN, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_acting_role TEXT;
BEGIN
  SELECT org_id INTO v_org_id FROM permission_groups WHERE id = p_group_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Group not found';
    RETURN;
  END IF;
  SELECT role INTO v_acting_role FROM organization_members
  WHERE org_id = v_org_id AND user_id = auth.uid();
  IF NOT FOUND OR v_acting_role NOT IN ('owner', 'admin') THEN
    IF NOT (p_user_id = auth.uid()) THEN
      RETURN QUERY SELECT false, 'Only organization owners and admins can manage groups';
      RETURN;
    END IF;
  END IF;
  DELETE FROM permission_group_members WHERE group_id = p_group_id AND user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Not a member of this group';
    RETURN;
  END IF;
  RETURN QUERY SELECT true, 'Member removed from group';
END;
$$;

GRANT EXECUTE ON FUNCTION remove_permission_group_member(UUID, UUID) TO authenticated;

-- Routing relax: named-XOR-group. The old self-route guard moves into the
-- CHECK so group rows (no approver_user_id) pass while named self-routes
-- still fail.
ALTER TABLE approval_requests
  DROP CONSTRAINT IF EXISTS approval_requests_check;

ALTER TABLE approval_requests
  ALTER COLUMN approver_user_id DROP NOT NULL;

ALTER TABLE approval_requests
  ADD CONSTRAINT approval_requests_routing_check
  CHECK (
    (approver_user_id IS NOT NULL AND approver_user_id <> user_id AND approver_group_id IS NULL)
    OR (approver_user_id IS NULL AND approver_group_id IS NOT NULL)
  );

ALTER TABLE approval_requests
  ADD CONSTRAINT fk_approval_requests_group
  FOREIGN KEY (approver_group_id) REFERENCES permission_groups(id) ON DELETE SET NULL
  NOT VALID;

CREATE INDEX IF NOT EXISTS idx_approval_requests_group
  ON approval_requests (approver_group_id, verdict);

-- Queue policies: group members read and decide group-routed rows.
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
  );

DROP POLICY IF EXISTS "Requesters file approval requests" ON approval_requests;
CREATE POLICY "Requesters file approval requests"
  ON approval_requests FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      (approver_user_id IS NOT NULL AND auth.uid() <> approver_user_id AND approver_group_id IS NULL)
      OR (approver_user_id IS NULL AND approver_group_id IS NOT NULL)
    )
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
  );
