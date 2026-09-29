-- 00091: organizations and membership (E2 team foundation).
--
-- An organization groups users with a role each (owner/admin/member/viewer).
-- Solo users keep working exactly as before: nothing references org_id yet.
-- Data sharing (org-scoped deal rooms) lands in a follow-up migration once
-- membership flows are live. Forward-only, additive. Owner-scoped RLS:
-- members read their own memberships and their orgs; all writes flow through
-- server actions that enforce the acting member's role, never raw SQL.

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_org ON organization_members (org_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members (user_id);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read own organizations"
  ON organizations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members m
      WHERE m.org_id = organizations.id AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Members read own memberships"
  ON organization_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM organization_members m
      WHERE m.org_id = organization_members.org_id AND m.user_id = auth.uid()
    )
  );

-- No INSERT/UPDATE/DELETE policies: membership writes flow exclusively
-- through SECURITY DEFINER functions below, which enforce role checks
-- server-side (owner/admin only, last-owner protection).

CREATE OR REPLACE FUNCTION create_organization(p_name TEXT)
RETURNS TABLE (id UUID, name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org organizations%ROWTYPE;
  v_name TEXT;
BEGIN
  v_name := btrim(COALESCE(p_name, ''));
  IF char_length(v_name) < 1 OR char_length(v_name) > 120 THEN
    RAISE EXCEPTION 'Organization name must be 1 to 120 characters';
  END IF;
  INSERT INTO organizations (name, created_by)
  VALUES (v_name, auth.uid())
  RETURNING * INTO v_org;
  INSERT INTO organization_members (org_id, user_id, role, invited_by)
  VALUES (v_org.id, auth.uid(), 'owner', auth.uid());
  RETURN QUERY SELECT v_org.id, v_org.name;
END;
$$;

GRANT EXECUTE ON FUNCTION create_organization(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION add_organization_member(p_org_id UUID, p_user_id UUID, p_role TEXT)
RETURNS TABLE (success BOOLEAN, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_acting_role TEXT;
  v_target_role TEXT;
BEGIN
  IF p_role NOT IN ('admin', 'member', 'viewer') THEN
    RETURN QUERY SELECT false, 'Role must be admin, member, or viewer';
    RETURN;
  END IF;
  SELECT role INTO v_acting_role FROM organization_members
  WHERE org_id = p_org_id AND user_id = auth.uid();
  IF NOT FOUND OR v_acting_role NOT IN ('owner', 'admin') THEN
    RETURN QUERY SELECT false, 'Only organization owners and admins can invite members';
    RETURN;
  END IF;
  IF v_acting_role = 'admin' AND p_role = 'admin' THEN
    RETURN QUERY SELECT false, 'Only owners can grant the admin role';
    RETURN;
  END IF;
  INSERT INTO organization_members (org_id, user_id, role, invited_by)
  VALUES (p_org_id, p_user_id, p_role, auth.uid())
  ON CONFLICT (org_id, user_id) DO NOTHING;
  RETURN QUERY SELECT true, 'Member added';
END;
$$;

GRANT EXECUTE ON FUNCTION add_organization_member(UUID, UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION remove_organization_member(p_org_id UUID, p_user_id UUID)
RETURNS TABLE (success BOOLEAN, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_acting_role TEXT;
  v_target_role TEXT;
  v_owner_count INTEGER;
BEGIN
  SELECT role INTO v_acting_role FROM organization_members
  WHERE org_id = p_org_id AND user_id = auth.uid();
  IF NOT FOUND OR v_acting_role NOT IN ('owner', 'admin') THEN
    IF NOT (p_user_id = auth.uid()) THEN
      RETURN QUERY SELECT false, 'Only organization owners and admins can remove members';
      RETURN;
    END IF;
  END IF;
  SELECT role INTO v_target_role FROM organization_members
  WHERE org_id = p_org_id AND user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Member not found';
    RETURN;
  END IF;
  IF v_target_role = 'owner' THEN
    IF v_acting_role IS DISTINCT FROM 'owner' THEN
      RETURN QUERY SELECT false, 'Only an owner can remove another owner';
      RETURN;
    END IF;
    SELECT COUNT(*) INTO v_owner_count FROM organization_members
    WHERE org_id = p_org_id AND role = 'owner';
    IF v_owner_count <= 1 THEN
      RETURN QUERY SELECT false, 'An organization must keep at least one owner';
      RETURN;
    END IF;
  END IF;
  DELETE FROM organization_members WHERE org_id = p_org_id AND user_id = p_user_id;
  RETURN QUERY SELECT true, 'Member removed';
END;
$$;

GRANT EXECUTE ON FUNCTION remove_organization_member(UUID, UUID) TO authenticated;
