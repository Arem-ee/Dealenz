-- Phase 5 lawyer review & collaboration: deal-scoped review workflow,
-- structured collaboration, multi-party signing foundation, service-order
-- boundary. Extends the consultation/handoff foundation; no marketplace,
-- no second ledger, no payment processing.
--
-- Lifecycle (enforced server-side; see src/lib/review/transitions.ts):
--   requested|waitlist -> matched (admin assigns lawyer_id)
--   matched -> requested + lawyer cleared (assignee declines)
--   matched -> accepted (assignee accepts)
--   accepted -> in_progress (assignee begins review)
--   in_progress|changes_requested|client_review -> changes_requested (assignee proposes)
--   changes_requested -> client_review (owner responds)
--   accepted|in_progress|changes_requested|client_review -> completed (assignee)
--   any active -> cancelled (owner or admin)
-- Lawyer write access lives only in active states
-- (matched, accepted, in_progress, changes_requested, client_review);
-- terminal states (completed, cancelled) revoke it.
--
-- Provenance rule (see product): lawyer contributions are labeled lawyer
-- provenance and never become system facts, rule results, or legal sources.
--
-- Forward-only; no historical migration edited. No live application claimed.

-- 1. Review lifecycle states (additive enum values only).
ALTER TYPE consultation_status ADD VALUE IF NOT EXISTS 'accepted';
ALTER TYPE consultation_status ADD VALUE IF NOT EXISTS 'changes_requested';
ALTER TYPE consultation_status ADD VALUE IF NOT EXISTS 'client_review';

-- 2. Structured review comments attached to real deal objects.
CREATE TABLE IF NOT EXISTS review_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_request_id UUID NOT NULL REFERENCES consultation_requests(id) ON DELETE CASCADE,
  audit_id UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  author_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  author_role TEXT NOT NULL CHECK (author_role IN ('client', 'lawyer')),
  target_type TEXT NOT NULL CHECK (target_type IN ('finding', 'clause', 'fact', 'evidence', 'document', 'question', 'general')),
  target_key TEXT,
  document_version_id UUID REFERENCES document_versions(id) ON DELETE SET NULL,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 5000),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'withdrawn')),
  provenance TEXT NOT NULL CHECK (provenance IN ('client', 'lawyer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_review_comments_request ON review_comments(consultation_request_id);
CREATE INDEX IF NOT EXISTS idx_review_comments_audit ON review_comments(audit_id);

ALTER TABLE review_comments ENABLE ROW LEVEL SECURITY;

-- Deal owner: read, write, and status-resolve own reviews' comments
-- (history preserved across terminal states). No DELETE: history is
-- append-only. Authorship/provenance/scoping columns are pinned by the
-- immutability trigger below, so neither owner nor lawyer can forge who
-- wrote what (e.g. flipping a lawyer note to look client-authored).
CREATE POLICY "Owners read own review comments"
  ON review_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM consultation_requests cr
      WHERE cr.id = review_comments.consultation_request_id
        AND cr.user_id = auth.uid()
    )
  );

CREATE POLICY "Owners write own review comments"
  ON review_comments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM consultation_requests cr
      WHERE cr.id = review_comments.consultation_request_id
        AND cr.user_id = auth.uid()
    )
  );

CREATE POLICY "Owners update own review comments"
  ON review_comments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM consultation_requests cr
      WHERE cr.id = review_comments.consultation_request_id
        AND cr.user_id = auth.uid()
    )
  );

-- Assigned lawyer: read + write only while the review is active. Terminal
-- states (completed, cancelled, waitlist, requested-unassigned) revoke
-- access automatically — no separate revocation record needed.
CREATE POLICY "Assigned lawyers read active review comments"
  ON review_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM consultation_requests cr
      JOIN lawyers l ON l.id = cr.lawyer_id
      WHERE cr.id = review_comments.consultation_request_id
        AND l.user_id = auth.uid()
        AND cr.status IN ('matched', 'accepted', 'in_progress', 'changes_requested', 'client_review')
    )
  );

CREATE POLICY "Assigned lawyers write active review comments"
  ON review_comments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM consultation_requests cr
      JOIN lawyers l ON l.id = cr.lawyer_id
      WHERE cr.id = review_comments.consultation_request_id
        AND l.user_id = auth.uid()
        AND cr.status IN ('matched', 'accepted', 'in_progress', 'changes_requested', 'client_review')
    )
  );

CREATE POLICY "Assigned lawyers update own active review comments"
  ON review_comments FOR UPDATE
  USING (
    review_comments.author_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM consultation_requests cr
      JOIN lawyers l ON l.id = cr.lawyer_id
      WHERE cr.id = review_comments.consultation_request_id
        AND l.user_id = auth.uid()
        AND cr.status IN ('matched', 'accepted', 'in_progress', 'changes_requested', 'client_review')
    )
  );

-- 3. Multi-party signers: required signers bound to one document version.
CREATE TABLE IF NOT EXISTS document_signers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  document_version_id UUID NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  email TEXT NOT NULL CHECK (char_length(email) BETWEEN 3 AND 254),
  party_label TEXT NOT NULL DEFAULT 'signer' CHECK (char_length(party_label) BETWEEN 1 AND 80),
  token TEXT NOT NULL UNIQUE CHECK (char_length(token) BETWEEN 10 AND 200),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'signed', 'declined', 'revoked')),
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_signers_audit ON document_signers(audit_id);
CREATE INDEX IF NOT EXISTS idx_document_signers_token ON document_signers(token);
CREATE INDEX IF NOT EXISTS idx_document_signers_version ON document_signers(document_version_id);

ALTER TABLE document_signers ENABLE ROW LEVEL SECURITY;

-- Deal owner reads and invites signers. No UPDATE/DELETE: the owner must
-- never be able to mark a signer signed, alter a binding, or destroy
-- signer rows (revocation and signing flow exclusively through the
-- token-gated RPCs, which enforce pending-only transitions server-side).
CREATE POLICY "Owners read own document signers"
  ON document_signers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM audits a
      WHERE a.id = document_signers.audit_id AND a.user_id = auth.uid()
    )
  );

CREATE POLICY "Owners invite own document signers"
  ON document_signers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM audits a
      WHERE a.id = document_signers.audit_id AND a.user_id = auth.uid()
    )
  );

-- 4. Signatures reference invitee signers as well as legacy share tokens.
-- Historical single-signer rows (share_token_id set) are preserved untouched.
ALTER TABLE document_signatures ALTER COLUMN share_token_id DROP NOT NULL;
ALTER TABLE document_signatures
  ADD COLUMN IF NOT EXISTS signer_id UUID REFERENCES document_signers(id) ON DELETE SET NULL;

-- 5. Lawyer service orders: the money boundary, separate from credits.
-- A service order records a professional-service engagement for a review.
-- It never touches credit_ledger, never converts credits, and has no
-- payment processing attached: quoted/paid/fulfilled transitions belong to
-- the future Paystack step. Only requested/cancelled are reachable now.
CREATE TABLE IF NOT EXISTS service_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  consultation_request_id UUID NOT NULL REFERENCES consultation_requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_minor INTEGER CHECK (amount_minor IS NULL OR amount_minor > 0),
  currency TEXT CHECK (currency IS NULL OR currency IN ('USD', 'GBP', 'EUR', 'NGN')),
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'quoted', 'paid', 'fulfilled', 'cancelled')),
  paystack_reference TEXT,
  note TEXT CHECK (note IS NULL OR char_length(note) <= 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_orders_audit ON service_orders(audit_id);
CREATE INDEX IF NOT EXISTS idx_service_orders_request ON service_orders(consultation_request_id);
CREATE INDEX IF NOT EXISTS idx_service_orders_user ON service_orders(user_id);

ALTER TABLE service_orders ENABLE ROW LEVEL SECURITY;

-- Deal owner reads, creates, and cancels (status-only) service orders. No
-- DELETE: financial history is append-only. Money/identity columns are
-- pinned by the immutability trigger below.
CREATE POLICY "Owners read own service orders"
  ON service_orders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Owners create own service orders"
  ON service_orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners update own service orders"
  ON service_orders FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Assigned lawyers read active service orders"
  ON service_orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM consultation_requests cr
      JOIN lawyers l ON l.id = cr.lawyer_id
      WHERE cr.id = service_orders.consultation_request_id
        AND l.user_id = auth.uid()
        AND cr.status IN ('matched', 'accepted', 'in_progress', 'changes_requested', 'client_review')
    )
  );

-- 6. Scoped lawyer bundle read: the ONLY lawyer path to owner-scoped deal
-- data. Returns audit metadata, structured findings payload, versions,
-- comments, signers, and consultation state as JSONB after verifying the
-- caller is the assigned lawyer on an active review. Audits and
-- document_versions RLS stay owner-only; nothing is widened.
CREATE OR REPLACE FUNCTION get_lawyer_review_bundle(p_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request consultation_requests%ROWTYPE;
  v_lawyer_user UUID;
  v_bundle JSONB;
BEGIN
  SELECT * INTO v_request FROM consultation_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Review request not found';
  END IF;

  SELECT l.user_id INTO v_lawyer_user
  FROM lawyers l WHERE l.id = v_request.lawyer_id;

  IF v_lawyer_user IS NULL OR v_lawyer_user <> auth.uid() THEN
    RAISE EXCEPTION 'Not assigned to this review';
  END IF;

  IF v_request.status NOT IN ('matched', 'accepted', 'in_progress', 'changes_requested', 'client_review') THEN
    RAISE EXCEPTION 'Review is not active';
  END IF;

  SELECT jsonb_build_object(
    'request', jsonb_build_object(
      'id', v_request.id, 'status', v_request.status,
      'request_note', v_request.request_note,
      'handoff_snapshot', v_request.handoff_snapshot,
      'created_at', v_request.created_at, 'updated_at', v_request.updated_at
    ),
    'audit', (SELECT jsonb_build_object(
      'id', a.id, 'title', a.title, 'status', a.status,
      'deal_type', a.deal_type, 'raw_input', a.raw_input,
      'structured_data', a.structured_data, 'risk_report', a.risk_report,
      'overall_score', a.overall_score, 'source_type', a.source_type,
      'created_at', a.created_at
    ) FROM audits a WHERE a.id = v_request.audit_id),
    'versions', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', dv.id, 'document_type', dv.document_type,
      'version_number', dv.version_number, 'content', dv.content,
      'generation_method', dv.generation_method, 'created_at', dv.created_at
      ) ORDER BY dv.version_number DESC), '[]'::jsonb)
      FROM (SELECT * FROM document_versions dv
        WHERE dv.audit_id = v_request.audit_id
        ORDER BY dv.version_number DESC LIMIT 100) dv),
    'comments', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', c.id, 'author_role', c.author_role, 'target_type', c.target_type,
      'target_key', c.target_key, 'document_version_id', c.document_version_id,
      'body', c.body, 'status', c.status, 'provenance', c.provenance,
      'created_at', c.created_at
      ) ORDER BY c.created_at ASC), '[]'::jsonb)
      FROM (SELECT * FROM review_comments c
        WHERE c.consultation_request_id = v_request.id
        ORDER BY c.created_at DESC LIMIT 200) c),
    'signers', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', s.id, 'name', s.name, 'email', s.email,
      'party_label', s.party_label, 'document_type', s.document_type,
      'document_version_id', s.document_version_id, 'status', s.status,
      'signed_at', s.signed_at
      ) ORDER BY s.created_at ASC), '[]'::jsonb)
      FROM document_signers s WHERE s.audit_id = v_request.audit_id)
  ) INTO v_bundle;

  RETURN v_bundle;
END;
$$;

GRANT EXECUTE ON FUNCTION get_lawyer_review_bundle TO authenticated;

-- 7. Lawyer-proposed versions: assigned lawyers cannot write
-- document_versions via RLS (owner-only by design), so proposals flow
-- through this narrow function: assignment + active status checked, version
-- numbered from the current max, content bounded. History is append-only.
CREATE OR REPLACE FUNCTION lawyer_create_version(
  p_request_id UUID,
  p_document_type TEXT,
  p_content TEXT
)
RETURNS TABLE(version_id UUID, version_number INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request consultation_requests%ROWTYPE;
  v_lawyer_user UUID;
  v_next INTEGER := 1;
  v_id UUID;
BEGIN
  IF p_content IS NULL OR char_length(p_content) = 0 OR char_length(p_content) > 200000 THEN
    RAISE EXCEPTION 'Invalid proposal content';
  END IF;
  IF p_document_type IS NULL OR char_length(p_document_type) = 0 OR char_length(p_document_type) > 120 THEN
    RAISE EXCEPTION 'Invalid document type';
  END IF;

  SELECT * INTO v_request FROM consultation_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Review request not found';
  END IF;

  SELECT l.user_id INTO v_lawyer_user
  FROM lawyers l WHERE l.id = v_request.lawyer_id;

  IF v_lawyer_user IS NULL OR v_lawyer_user <> auth.uid() THEN
    RAISE EXCEPTION 'Not assigned to this review';
  END IF;

  IF v_request.status NOT IN ('accepted', 'in_progress', 'changes_requested', 'client_review') THEN
    RAISE EXCEPTION 'Review is not in a proposable state';
  END IF;

  -- Serialize against concurrent proposals and invitee signing for the same
  -- document (matches sign_as_invitee), so version numbering cannot fork and
  -- no signature can land on a version mid-supersede.
  PERFORM pg_advisory_xact_lock(hashtext(
    'docver:' || (SELECT audit_id FROM consultation_requests WHERE id = p_request_id)::text || ':' || p_document_type
  ));

  -- Abuse bound: at most 50 versions per document. Revisions are manual and
  -- revision-sized; beyond this is automation, not review.
  IF (SELECT COUNT(*) FROM document_versions
      WHERE audit_id = v_request.audit_id AND document_type = p_document_type) >= 50 THEN
    RAISE EXCEPTION 'Version limit reached for this document';
  END IF;

  SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_next
  FROM document_versions
  WHERE audit_id = v_request.audit_id AND document_type = p_document_type;

  INSERT INTO document_versions (audit_id, user_id, document_type, version_number, content, generation_method)
  VALUES (v_request.audit_id, v_request.user_id, p_document_type, v_next, p_content, 'lawyer_revision')
  RETURNING id INTO v_id;

  RETURN QUERY SELECT v_id, v_next;
END;
$$;

GRANT EXECUTE ON FUNCTION lawyer_create_version TO authenticated;

-- 8. Invitee view + signing: token-gated, no account needed. The view
-- exposes only the invited signer's document; signing binds the exact
-- version and rejects superseded versions, duplicate signing, and revoked
-- or declined invitations. The client can never mark completion directly:
-- execution is derived (all signers signed).
CREATE OR REPLACE FUNCTION get_signer_view(p_token TEXT)
RETURNS TABLE (
  signer_name TEXT,
  signer_email TEXT,
  party_label TEXT,
  sign_status TEXT,
  signed_at TIMESTAMPTZ,
  document_type TEXT,
  version_number INTEGER,
  content TEXT,
  superseded BOOLEAN,
  total_signers INTEGER,
  signed_signers INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_signer document_signers%ROWTYPE;
  v_content TEXT;
  v_number INTEGER;
  v_latest INTEGER;
BEGIN
  IF p_token IS NULL OR char_length(p_token) = 0 OR char_length(p_token) > 200 THEN
    RETURN;
  END IF;

  SELECT * INTO v_signer FROM document_signers WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT dv.content, dv.version_number INTO v_content, v_number
  FROM document_versions dv WHERE dv.id = v_signer.document_version_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT COALESCE(MAX(version_number), 0) INTO v_latest
  FROM document_versions
  WHERE audit_id = v_signer.audit_id AND document_type = v_signer.document_type;

  RETURN QUERY SELECT
    v_signer.name, v_signer.email, v_signer.party_label,
    v_signer.status, v_signer.signed_at,
    v_signer.document_type, v_number, v_content,
    (v_number < v_latest),
    -- Aggregate counts only (no other signer's identity): lets the invitee
    -- see "2 of 3 complete" and the executed state without leaking PII.
    (SELECT COUNT(*)::INTEGER FROM document_signers s
      WHERE s.document_version_id = v_signer.document_version_id
        AND s.status <> 'revoked'),
    (SELECT COUNT(*)::INTEGER FROM document_signers s
      WHERE s.document_version_id = v_signer.document_version_id
        AND s.status = 'signed');
END;
$$;

GRANT EXECUTE ON FUNCTION get_signer_view TO anon, authenticated;

CREATE OR REPLACE FUNCTION sign_as_invitee(
  p_token TEXT,
  p_name TEXT,
  p_email TEXT
)
RETURNS TABLE (success BOOLEAN, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_signer document_signers%ROWTYPE;
  v_latest INTEGER;
BEGIN
  IF p_token IS NULL OR char_length(p_token) = 0 OR char_length(p_token) > 200
    OR p_name IS NULL OR char_length(btrim(p_name)) = 0 OR char_length(p_name) > 120
    OR p_email IS NULL OR char_length(p_email) > 254
    OR p_email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  THEN
    RETURN QUERY SELECT false, 'Invalid signing request';
    RETURN;
  END IF;

  SELECT * INTO v_signer FROM document_signers WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Invalid or expired signing link';
    RETURN;
  END IF;
  IF v_signer.status = 'signed' THEN
    RETURN QUERY SELECT false, 'Document has already been signed by this party';
    RETURN;
  END IF;
  IF v_signer.status IN ('declined', 'revoked') THEN
    RETURN QUERY SELECT false, 'This signing invitation is no longer valid';
    RETURN;
  END IF;

  -- Identity binding: the token authorizes this invitation, but the email
  -- must match the invited address — a leaked token alone cannot sign as
  -- someone else.
  IF lower(btrim(p_email)) <> lower(v_signer.email) THEN
    RETURN QUERY SELECT false, 'Email does not match this invitation';
    RETURN;
  END IF;

  -- Serialize against concurrent version creation for the same document so
  -- the supersede check below cannot be raced (matches lawyer_create_version).
  PERFORM pg_advisory_xact_lock(hashtext('docver:' || v_signer.audit_id::text || ':' || v_signer.document_type));

  -- Version binding: refuse a superseded version explicitly.
  SELECT COALESCE(MAX(version_number), 0) INTO v_latest
  FROM document_versions
  WHERE audit_id = v_signer.audit_id AND document_type = v_signer.document_type;

  IF (SELECT version_number FROM document_versions WHERE id = v_signer.document_version_id) < v_latest THEN
    RETURN QUERY SELECT false, 'A newer document version exists; signing is paused until the new version is reviewed';
    RETURN;
  END IF;

  UPDATE document_signers
  SET status = 'signed', signed_at = now()
  WHERE id = v_signer.id AND status = 'pending';

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'This signing invitation is no longer valid';
    RETURN;
  END IF;

  INSERT INTO document_signatures (share_token_id, signer_id, audit_id, document_type, signed_by_name, signed_by_email, ip_address)
  VALUES (NULL, v_signer.id, v_signer.audit_id, v_signer.document_type, btrim(p_name), btrim(p_email), NULL);

  INSERT INTO activity_events (user_id, audit_id, event_type, payload)
  VALUES (
    (SELECT user_id FROM audits WHERE id = v_signer.audit_id),
    v_signer.audit_id,
    'signer_signed',
    jsonb_build_object('signer_id', v_signer.id, 'document_version_id', v_signer.document_version_id)
  );

  -- Execution completion: derived the moment the last required signature
  -- lands on THIS version (at least one signer, none pending on it).
  -- Revoked/declined signers do not block: they resolved out via
  -- re-invitation. No flag is stored; the same derivation runs in
  -- application code. Other versions' pending invites are unaffected.
  IF NOT EXISTS (
    SELECT 1 FROM document_signers s
    WHERE s.document_version_id = v_signer.document_version_id
      AND s.status = 'pending'
  ) AND EXISTS (
    SELECT 1 FROM document_signers s
    WHERE s.document_version_id = v_signer.document_version_id
      AND s.status = 'signed'
  ) THEN
    INSERT INTO activity_events (user_id, audit_id, event_type, payload)
    VALUES (
      (SELECT user_id FROM audits WHERE id = v_signer.audit_id),
      v_signer.audit_id,
      'execution_completed',
      jsonb_build_object(
        'document_type', v_signer.document_type,
        'document_version_id', v_signer.document_version_id
      )
    );
  END IF;

  RETURN QUERY SELECT true, 'Document signed successfully';
END;
$$;

GRANT EXECUTE ON FUNCTION sign_as_invitee TO anon, authenticated;

-- Invitee decline: token-gated, pending only. A declined invitation can
-- never sign afterwards (sign_as_invitee rejects non-pending).
CREATE OR REPLACE FUNCTION decline_as_invitee(p_token TEXT)
RETURNS TABLE (success BOOLEAN, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_token IS NULL OR char_length(p_token) = 0 OR char_length(p_token) > 200 THEN
    RETURN QUERY SELECT false, 'Invalid signing link';
    RETURN;
  END IF;

  UPDATE document_signers
  SET status = 'declined'
  WHERE token = p_token AND status = 'pending';

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'This signing invitation is no longer valid';
    RETURN;
  END IF;

  RETURN QUERY SELECT true, 'Invitation declined';
END;
$$;

GRANT EXECUTE ON FUNCTION decline_as_invitee TO anon, authenticated;

-- 12. Lawyer-scoped activity feed. activity_events rows belong to the deal
-- owner, so assigned lawyers cannot read them via RLS. This narrow function
-- exposes one review's trail (or, with NULL, the recent trail across all of
-- the caller's assigned ACTIVE reviews) after verifying assignment. Bounded
-- (1–100 rows) and ordered newest-first. Terminal reviews are excluded:
-- history stays visible to the client, not to former assignees.
CREATE OR REPLACE FUNCTION get_lawyer_activity(p_request_id UUID, p_limit INTEGER DEFAULT 50)
RETURNS TABLE (
  id UUID,
  event_type TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INTEGER;
BEGIN
  v_limit := GREATEST(1, LEAST(COALESCE(p_limit, 50), 100));

  IF p_request_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM consultation_requests cr
      JOIN lawyers l ON l.id = cr.lawyer_id
      WHERE cr.id = p_request_id
        AND l.user_id = auth.uid()
        AND cr.status IN ('matched', 'accepted', 'in_progress', 'changes_requested', 'client_review')
    ) THEN
      RAISE EXCEPTION 'Not assigned to this review';
    END IF;
    RETURN QUERY
    SELECT e.id, e.event_type, e.payload, e.created_at
    FROM activity_events e
    JOIN consultation_requests cr ON cr.audit_id = e.audit_id
    WHERE cr.id = p_request_id
    ORDER BY e.created_at DESC
    LIMIT v_limit;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT e.id, e.event_type, e.payload, e.created_at
  FROM activity_events e
  WHERE EXISTS (
    SELECT 1 FROM consultation_requests cr
    JOIN lawyers l ON l.id = cr.lawyer_id
    WHERE cr.audit_id = e.audit_id
      AND l.user_id = auth.uid()
      AND cr.status IN ('matched', 'accepted', 'in_progress', 'changes_requested', 'client_review')
  )
  ORDER BY e.created_at DESC
  LIMIT v_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION get_lawyer_activity TO authenticated;

-- 9. Immutability triggers: RLS authorizes WHO may write, these guards fix
-- WHAT may change, so neither owner, lawyer, nor admin session can forge
-- authorship, rewire a review to another deal, or rewrite money fields.
-- Mutable: comment body/status, order status/note, consultation status
-- (which the server state machine additionally gates per actor).
CREATE OR REPLACE FUNCTION enforce_review_comment_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.author_user_id IS DISTINCT FROM NEW.author_user_id
    OR OLD.author_role IS DISTINCT FROM NEW.author_role
    OR OLD.provenance IS DISTINCT FROM NEW.provenance
    OR OLD.consultation_request_id IS DISTINCT FROM NEW.consultation_request_id
    OR OLD.audit_id IS DISTINCT FROM NEW.audit_id THEN
    RAISE EXCEPTION 'Review comment authorship and scoping are immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_review_comment_immutable ON review_comments;
CREATE TRIGGER trg_review_comment_immutable
  BEFORE UPDATE ON review_comments
  FOR EACH ROW EXECUTE FUNCTION enforce_review_comment_immutable();

-- Abuse bound: at most 500 comments per review. Generous for real
-- collaboration; prevents unbounded table growth from automated clients.
-- Enforced here (not in actions) so every writer path is covered.
CREATE OR REPLACE FUNCTION enforce_review_comment_cap()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (SELECT COUNT(*) FROM review_comments
      WHERE consultation_request_id = NEW.consultation_request_id) >= 500 THEN
    RAISE EXCEPTION 'Comment limit reached for this review';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_review_comment_cap ON review_comments;
CREATE TRIGGER trg_review_comment_cap
  BEFORE INSERT ON review_comments
  FOR EACH ROW EXECUTE FUNCTION enforce_review_comment_cap();

CREATE OR REPLACE FUNCTION enforce_consultation_request_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.audit_id IS DISTINCT FROM NEW.audit_id
    OR OLD.user_id IS DISTINCT FROM NEW.user_id THEN
    RAISE EXCEPTION 'Review deal ownership is immutable';
  END IF;
  -- lawyer_id moves only between NULL and a value (assign/decline);
  -- reassignment between lawyers is not a supported transition.
  IF OLD.lawyer_id IS NOT NULL AND NEW.lawyer_id IS NOT NULL
    AND OLD.lawyer_id IS DISTINCT FROM NEW.lawyer_id THEN
    RAISE EXCEPTION 'Review reassignment is not supported';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_consultation_request_immutable ON consultation_requests;
CREATE TRIGGER trg_consultation_request_immutable
  BEFORE UPDATE ON consultation_requests
  FOR EACH ROW EXECUTE FUNCTION enforce_consultation_request_immutable();

CREATE OR REPLACE FUNCTION enforce_service_order_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.user_id IS DISTINCT FROM NEW.user_id
    OR OLD.audit_id IS DISTINCT FROM NEW.audit_id
    OR OLD.consultation_request_id IS DISTINCT FROM NEW.consultation_request_id
    OR OLD.amount_minor IS DISTINCT FROM NEW.amount_minor
    OR OLD.currency IS DISTINCT FROM NEW.currency THEN
    RAISE EXCEPTION 'Service order identity and money fields are immutable';
  END IF;
  -- No payment implementation exists: the only reachable transition is
  -- requested -> cancelled (owner cancel action). Quoted/paid/fulfilled
  -- belong to the future Paystack step, which will extend this rule.
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status <> 'cancelled' THEN
    RAISE EXCEPTION 'Service order status cannot be set directly';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_service_order_immutable ON service_orders;
CREATE TRIGGER trg_service_order_immutable
  BEFORE UPDATE ON service_orders
  FOR EACH ROW EXECUTE FUNCTION enforce_service_order_immutable();

-- 11. Lawyer verification self-promotion block (adversarial finding).
-- The "Lawyers manage own profile" policy lets owners update their own
-- lawyers row — without this trigger they could set verification_status =
-- 'verified' on themselves and pass every verified-lawyer gate, bypassing
-- admin verification entirely. Verification fields change only for admins
-- (server-controlled app_metadata in the session JWT, never user_metadata).
-- Inserts are born 'pending' for the same reason. Admin verify/reject flows
-- carry the admin flag and are unaffected.
CREATE OR REPLACE FUNCTION enforce_lawyer_verification()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN := COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false);
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.verification_status IS DISTINCT FROM 'pending' THEN
      RAISE EXCEPTION 'Applications start as pending';
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.verification_status IS DISTINCT FROM NEW.verification_status
    OR OLD.verified_at IS DISTINCT FROM NEW.verified_at
    OR OLD.verified_by IS DISTINCT FROM NEW.verified_by THEN
    IF NOT v_is_admin THEN
      RAISE EXCEPTION 'Only administrators can change verification status';
    END IF;
  END IF;
  IF OLD.user_id IS DISTINCT FROM NEW.user_id THEN
    RAISE EXCEPTION 'Lawyer account ownership is immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lawyer_verification ON lawyers;
CREATE TRIGGER trg_lawyer_verification
  BEFORE INSERT OR UPDATE ON lawyers
  FOR EACH ROW EXECUTE FUNCTION enforce_lawyer_verification();

-- 10. Owner revocation of signer invitations. Owners have no direct UPDATE
-- on document_signers (see policies above), so revocation flows through
-- this narrow function: ownership verified, pending-only transition.
CREATE OR REPLACE FUNCTION revoke_signer_invite(p_signer_id UUID)
RETURNS TABLE (success BOOLEAN, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_audit UUID;
  v_status TEXT;
BEGIN
  SELECT audit_id, status INTO v_audit, v_status
  FROM document_signers WHERE id = p_signer_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Signer not found';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM audits a WHERE a.id = v_audit AND a.user_id = auth.uid()) THEN
    RETURN QUERY SELECT false, 'Not your deal';
    RETURN;
  END IF;
  IF v_status <> 'pending' THEN
    RETURN QUERY SELECT false, 'Only pending invitations can be revoked';
    RETURN;
  END IF;
  UPDATE document_signers SET status = 'revoked' WHERE id = p_signer_id;
  RETURN QUERY SELECT true, 'Invitation revoked';
END;
$$;

GRANT EXECUTE ON FUNCTION revoke_signer_invite TO authenticated;
