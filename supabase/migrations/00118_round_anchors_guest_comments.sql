-- 00118: clause anchors + guest commenting + resolve tracking (gaps D1–D4).
--
-- Anchors (D1): assembly records clause spans at generation time —
-- exact offsets, zero inference — so rounds read current language from
-- recorded positions instead of pasted attestations. One row per
-- version×clause; regenerations rewrite the version's set wholesale.
--
-- Guest commenting (D3): `commenter` joins the grant scope check
-- (reader < commenter < uploader, cumulative). Comment insertion for
-- guests flows through the token RPC below, which forces
-- channel='external' server-side — a commenter grant cannot address the
-- internal channel even maliciously. Owner posting paths are unchanged.
--
-- Resolve tracking (D4): external threads resolve explicitly; round
-- acceptance requires zero unresolved external comments on the round.
--
-- Forward-only, additive. Owner-scoped RLS throughout; token RPCs stay
-- fail-closed. No service-role bypass for readers.

CREATE TABLE version_clause_spans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version_id UUID NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
  audit_id UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  clause_id TEXT NOT NULL CHECK (char_length(clause_id) BETWEEN 1 AND 120),
  start_offset INT NOT NULL CHECK (start_offset >= 0),
  end_offset INT NOT NULL CHECK (end_offset > start_offset),
  template_version INT NOT NULL DEFAULT 1 CHECK (template_version >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (version_id, clause_id)
);

CREATE INDEX version_clause_spans_version_idx ON version_clause_spans (version_id);

ALTER TABLE version_clause_spans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage own version clause spans"
  ON version_clause_spans FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Cumulative scope ladder: reader < commenter < uploader.
ALTER TABLE guest_grants
  DROP CONSTRAINT guest_grants_scope_check;

ALTER TABLE guest_grants
  ADD CONSTRAINT guest_grants_scope_check
    CHECK (scope IN ('reader', 'commenter', 'uploader'));

-- Guest attribution + resolution on comments. guest_grant_id marks
-- counterparty authorship; author_label carries their email for display.
-- user_id stays the deal owner so owner RLS keeps working unchanged.
ALTER TABLE negotiation_comments
  ADD COLUMN IF NOT EXISTS guest_grant_id UUID REFERENCES guest_grants(id) ON DELETE SET NULL;

ALTER TABLE negotiation_comments
  ADD COLUMN IF NOT EXISTS author_label TEXT NOT NULL DEFAULT '';

ALTER TABLE negotiation_comments
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ NULL;

-- Guest comment posting: live grant with comment-or-broader scope,
-- external channel forced, daily cap per grant. Returns the comment id.
CREATE OR REPLACE FUNCTION post_guest_comment(
  p_token TEXT,
  p_body TEXT,
  p_round_id UUID DEFAULT NULL
)
RETURNS TABLE (success BOOLEAN, message TEXT, comment_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_grant_id UUID;
  v_deal_id UUID;
  v_owner_id UUID;
  v_email TEXT;
  v_count INT;
  v_body TEXT;
BEGIN
  SELECT g.id, g.deal_id, a.user_id, g.email INTO v_grant_id, v_deal_id, v_owner_id, v_email
  FROM guest_grants g
  JOIN audits a ON a.id = g.deal_id
  WHERE g.token = p_token
    AND g.revoked_at IS NULL
    AND (g.expires_at IS NULL OR g.expires_at > now())
    AND g.scope IN ('commenter', 'uploader');
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'That link is no longer valid', NULL::UUID;
    RETURN;
  END IF;
  v_body := btrim(COALESCE(p_body, ''));
  IF char_length(v_body) < 1 OR char_length(v_body) > 2000 THEN
    RETURN QUERY SELECT false, 'Write the comment first', NULL::UUID;
    RETURN;
  END IF;
  IF p_round_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM negotiation_rounds r
      WHERE r.id = p_round_id AND r.audit_id = v_deal_id
    ) THEN
      RETURN QUERY SELECT false, 'That discussion is closed', NULL::UUID;
      RETURN;
    END IF;
  END IF;
  SELECT COUNT(*) INTO v_count
  FROM negotiation_comments
  WHERE guest_grant_id = v_grant_id
    AND created_at > now() - INTERVAL '1 day';
  IF v_count >= 30 THEN
    RETURN QUERY SELECT false, 'Daily comment limit reached — please try again tomorrow', NULL::UUID;
    RETURN;
  END IF;
  RETURN QUERY
  WITH ins AS (
    INSERT INTO negotiation_comments (user_id, audit_id, round_id, channel, body, guest_grant_id, author_label)
    VALUES (v_owner_id, v_deal_id, p_round_id, 'external', v_body, v_grant_id, v_email)
    RETURNING id
  )
  SELECT true, 'Comment posted', (SELECT id FROM ins);
END;
$$;

GRANT EXECUTE ON FUNCTION post_guest_comment(TEXT, TEXT, UUID) TO anon, authenticated;

-- External comments for the portal view (read side stays in
-- get_guest_negotiation; this exposes resolution state for it).
CREATE OR REPLACE FUNCTION get_guest_comments(p_token TEXT)
RETURNS TABLE (body TEXT, resolved BOOLEAN, created_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT c.body, c.resolved_at IS NOT NULL, c.created_at
  FROM guest_grants g
  JOIN negotiation_comments c ON c.audit_id = g.deal_id AND c.channel = 'external'
  WHERE g.token = p_token
    AND g.revoked_at IS NULL
    AND (g.expires_at IS NULL OR g.expires_at > now())
  ORDER BY c.created_at ASC
  LIMIT 200;
END;
$$;

GRANT EXECUTE ON FUNCTION get_guest_comments(TEXT) TO anon, authenticated;
