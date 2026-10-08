-- 00113: guest grants + staged counterparty uploads (Phase C, D4/D5/D7/D9/D10).
--
-- One external surface, audience-typed grants (D4): the owner invites an
-- outsider by email onto one deal with an audience (employee / supplier /
-- customer) and a scope (reader, or uploader for the single primary owner
-- per deal). Guests are token principals, never members — no accounts, no
-- seats, invitation-only (self-registration deferred with the identity
-- story). Grants expire and auto-revoke (D7).
--
-- Staged reconciliation (D5): the primary owner's redlines stage OUTSIDE
-- version control in staged_uploads; an internal owner accepts them into
-- document_versions (or rejects them). Staged rows are owner-readable only.
--
-- Access pattern follows /sign/[token] (token-gated SECURITY DEFINER RPCs,
-- fail-closed on unknown/expired tokens). Direct writes: RPCs only.

CREATE TABLE guest_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT NOT NULL CHECK (char_length(email) BETWEEN 3 AND 254),
  audience TEXT NOT NULL CHECK (audience IN ('employee', 'supplier', 'customer')),
  scope TEXT NOT NULL CHECK (scope IN ('reader', 'uploader')),
  is_primary_owner BOOLEAN NOT NULL DEFAULT false,
  token TEXT NOT NULL UNIQUE CHECK (char_length(token) BETWEEN 32 AND 200),
  expires_at TIMESTAMPTZ NULL,
  revoked_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (deal_id, email)
);

CREATE INDEX guest_grants_deal_idx ON guest_grants (deal_id);
CREATE INDEX guest_grants_token_idx ON guest_grants (token);

ALTER TABLE guest_grants ENABLE ROW LEVEL SECURITY;

-- Owners manage their deals' grants; guests never touch this table
-- directly (token RPCs only).
DROP POLICY IF EXISTS "Owners manage own deal guest grants" ON guest_grants;
CREATE POLICY "Owners manage own deal guest grants"
  ON guest_grants FOR ALL
  USING (
    auth.uid() = (SELECT user_id FROM audits WHERE id = guest_grants.deal_id)
  )
  WITH CHECK (
    auth.uid() = (SELECT user_id FROM audits WHERE id = guest_grants.deal_id)
  );

CREATE TABLE staged_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  grant_id UUID NOT NULL REFERENCES guest_grants(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL CHECK (char_length(file_name) BETWEEN 1 AND 120),
  storage_path TEXT NOT NULL CHECK (char_length(storage_path) BETWEEN 1 AND 500),
  mime TEXT NOT NULL CHECK (char_length(mime) BETWEEN 1 AND 160),
  size_bytes INT NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ NULL
);

CREATE INDEX staged_uploads_deal_idx ON staged_uploads (deal_id, status);

ALTER TABLE staged_uploads ENABLE ROW LEVEL SECURITY;

-- Owner-readable only. Guests upload through the token RPC (service-side
-- insert); they never read staged rows back.
DROP POLICY IF EXISTS "Owners read own deal staged uploads" ON staged_uploads;
CREATE POLICY "Owners read own deal staged uploads"
  ON staged_uploads FOR ALL
  USING (
    auth.uid() = (SELECT user_id FROM audits WHERE id = staged_uploads.deal_id)
  )
  WITH CHECK (
    auth.uid() = (SELECT user_id FROM audits WHERE id = staged_uploads.deal_id)
  );

-- Token-gated guest view: deal title, audience, scope, and version metadata.
-- Contents flow through the owner-scoped version rows only when the grant is
-- live (unexpired, unrevoked). Contents themselves are served to the portal
-- page through get_guest_version_content below, never in bulk.
CREATE OR REPLACE FUNCTION get_guest_view(p_token TEXT)
RETURNS TABLE (
  deal_id UUID,
  deal_title TEXT,
  audience TEXT,
  scope TEXT,
  is_primary_owner BOOLEAN,
  expires_at TIMESTAMPTZ,
  version_id UUID,
  document_type TEXT,
  version_number INT,
  version_status TEXT,
  version_created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH live_grant AS (
    SELECT g.deal_id, g.audience, g.scope, g.is_primary_owner, g.expires_at
    FROM guest_grants g
    WHERE g.token = p_token
      AND g.revoked_at IS NULL
      AND (g.expires_at IS NULL OR g.expires_at > now())
  )
  SELECT
    gr.deal_id,
    COALESCE((SELECT a.title FROM audits a WHERE a.id = gr.deal_id), 'Untitled'),
    gr.audience,
    gr.scope,
    gr.is_primary_owner,
    gr.expires_at,
    v.id,
    v.document_type,
    v.version_number,
    v.status,
    v.created_at
  FROM live_grant gr
  LEFT JOIN document_versions v ON v.audit_id = gr.deal_id
  ORDER BY v.version_number DESC NULLS LAST
  LIMIT 50;
END;
$$;

GRANT EXECUTE ON FUNCTION get_guest_view(TEXT) TO anon, authenticated;

-- Single version content for the portal reader. Grant must be live and the
-- version must belong to the granted deal.
CREATE OR REPLACE FUNCTION get_guest_version_content(p_token TEXT, p_version_id UUID)
RETURNS TABLE (content TEXT, document_type TEXT, version_number INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT v.content, v.document_type, v.version_number
  FROM guest_grants g
  JOIN document_versions v ON v.audit_id = g.deal_id AND v.id = p_version_id
  WHERE g.token = p_token
    AND g.revoked_at IS NULL
    AND (g.expires_at IS NULL OR g.expires_at > now())
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION get_guest_version_content(TEXT, UUID) TO anon, authenticated;

-- Owner creates a guest grant. One primary uploader per deal: granting a
-- new primary clears the flag on the deal's other grants.
CREATE OR REPLACE FUNCTION create_guest_grant(
  p_deal_id UUID,
  p_email TEXT,
  p_audience TEXT,
  p_scope TEXT,
  p_is_primary_owner BOOLEAN,
  p_token TEXT,
  p_expires_at TIMESTAMPTZ
)
RETURNS TABLE (success BOOLEAN, message TEXT, grant_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner UUID;
BEGIN
  IF p_audience NOT IN ('employee', 'supplier', 'customer') THEN
    RETURN QUERY SELECT false, 'Unknown audience', NULL::UUID;
    RETURN;
  END IF;
  IF p_scope NOT IN ('reader', 'uploader') THEN
    RETURN QUERY SELECT false, 'Unknown scope', NULL::UUID;
    RETURN;
  END IF;
  IF p_email IS NULL OR char_length(p_email) NOT BETWEEN 3 AND 254 THEN
    RETURN QUERY SELECT false, 'Enter a valid email', NULL::UUID;
    RETURN;
  END IF;
  IF p_token IS NULL OR char_length(p_token) NOT BETWEEN 32 AND 200 THEN
    RETURN QUERY SELECT false, 'Invalid grant token', NULL::UUID;
    RETURN;
  END IF;
  SELECT user_id INTO v_owner FROM audits WHERE id = p_deal_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Deal not found', NULL::UUID;
    RETURN;
  END IF;
  IF v_owner <> auth.uid() THEN
    RETURN QUERY SELECT false, 'Only the deal owner can invite externals', NULL::UUID;
    RETURN;
  END IF;
  IF p_is_primary_owner THEN
    UPDATE guest_grants SET is_primary_owner = false WHERE deal_id = p_deal_id;
  END IF;
  RETURN QUERY
  WITH ins AS (
    INSERT INTO guest_grants (deal_id, granted_by, email, audience, scope, is_primary_owner, token, expires_at)
    VALUES (p_deal_id, auth.uid(), lower(p_email), p_audience, p_scope, p_is_primary_owner, p_token, p_expires_at)
    ON CONFLICT (deal_id, email) DO UPDATE SET
      audience = EXCLUDED.audience,
      scope = EXCLUDED.scope,
      is_primary_owner = EXCLUDED.is_primary_owner,
      token = EXCLUDED.token,
      expires_at = EXCLUDED.expires_at,
      revoked_at = NULL
    RETURNING id
  )
  SELECT true, 'External invited', (SELECT id FROM ins);
END;
$$;

GRANT EXECUTE ON FUNCTION create_guest_grant(UUID, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TIMESTAMPTZ) TO authenticated;

CREATE OR REPLACE FUNCTION revoke_guest_grant(p_deal_id UUID, p_grant_id UUID)
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
    RETURN QUERY SELECT false, 'Only the deal owner can revoke access';
    RETURN;
  END IF;
  UPDATE guest_grants SET revoked_at = now()
  WHERE id = p_grant_id AND deal_id = p_deal_id AND revoked_at IS NULL;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'That grant no longer exists';
    RETURN;
  END IF;
  RETURN QUERY SELECT true, 'Access revoked';
END;
$$;

GRANT EXECUTE ON FUNCTION revoke_guest_grant(UUID, UUID) TO authenticated;

-- Primary-owner upload-back: staged outside version control. Validates the
-- live uploader grant; the app inserts the staged_uploads row + storage
-- object with the service client after this check.
CREATE OR REPLACE FUNCTION check_staged_upload(p_token TEXT)
RETURNS TABLE (success BOOLEAN, message TEXT, deal_id UUID, grant_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    TRUE,
    'Upload allowed'::TEXT,
    g.deal_id,
    g.id
  FROM guest_grants g
  WHERE g.token = p_token
    AND g.revoked_at IS NULL
    AND (g.expires_at IS NULL OR g.expires_at > now())
    AND g.scope = 'uploader'
    AND g.is_primary_owner = true
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'That upload link is no longer valid', NULL::UUID, NULL::UUID;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION check_staged_upload(TEXT) TO anon, authenticated;

-- Owner accepts a staged file into the version chain (new version row) or
-- rejects it. Acceptance never mutates history — it appends.
CREATE OR REPLACE FUNCTION decide_staged_upload(p_upload_id UUID, p_accept BOOLEAN)
RETURNS TABLE (success BOOLEAN, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner UUID;
  v_status TEXT;
BEGIN
  SELECT a.user_id INTO v_owner
  FROM staged_uploads s JOIN audits a ON a.id = s.deal_id
  WHERE s.id = p_upload_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Upload not found';
    RETURN;
  END IF;
  IF v_owner <> auth.uid() THEN
    RETURN QUERY SELECT false, 'Only the deal owner decides staged uploads';
    RETURN;
  END IF;
  SELECT status INTO v_status FROM staged_uploads WHERE id = p_upload_id;
  IF v_status <> 'pending' THEN
    RETURN QUERY SELECT false, 'That upload is already decided';
    RETURN;
  END IF;
  UPDATE staged_uploads
  SET status = CASE WHEN p_accept THEN 'accepted' ELSE 'rejected' END,
      decided_at = now()
  WHERE id = p_upload_id;
  RETURN QUERY SELECT true, CASE WHEN p_accept THEN 'Staged file accepted' ELSE 'Staged file rejected' END;
END;
$$;

GRANT EXECUTE ON FUNCTION decide_staged_upload(UUID, BOOLEAN) TO authenticated;
