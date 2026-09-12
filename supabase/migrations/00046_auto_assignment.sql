-- 00046 Lawyer auto-assignment (operations autonomy).
--
-- Normal lawyer matching should not wait on an administrator. This migration
-- adds ONE conservative deterministic matcher; it does not build a
-- marketplace, a scoring engine, an availability calendar, or background
-- infrastructure.
--
-- Eligibility uses only safe existing signals:
--   1. verification_status = 'verified' (never unverified/pending/rejected)
--   2. self-deal exclusion via lawyers.user_id <> request owner
--      (a lawyer must never be auto-assigned to their own deal)
--   3. decliner exclusion via recorded review_decline activity for this
--      request (a lawyer who declined is never silently re-assigned)
--
-- Deliberately NOT used (unsafe to infer from current data):
--   - bar_jurisdiction / specialties are free text with no controlled
--     vocabulary, so filtering on them would wrongly include or exclude.
--     Jurisdiction-aware matching is a later product decision (normalized
--     taxonomy on lawyer profiles), not something to guess here.
--   - No availability concept exists; load is spread by least active
--     workload instead of an invented capacity cap.
--
-- Determinism: least active workload (matched/accepted/in_progress/
-- changes_requested/client_review), tie-broken by profile age then id, so
-- repeated calls with unchanged data pick the same lawyer.
--
-- Concurrency: the request row is locked, and the final UPDATE is
-- conditional on (status still assignable AND lawyer_id still NULL), so two
-- simultaneous callers cannot double-assign; the loser gets 'race_lost'.
--
-- Forward-only, safely re-runnable (CREATE OR REPLACE + GRANT).

CREATE OR REPLACE FUNCTION auto_assign_review(p_request_id UUID)
RETURNS TABLE (assigned BOOLEAN, lawyer_id UUID, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request consultation_requests%ROWTYPE;
  v_pick UUID;
BEGIN
  IF p_request_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::UUID, 'Invalid review request';
    RETURN;
  END IF;

  -- Lock the request so concurrent matchers serialize here.
  SELECT * INTO v_request
  FROM consultation_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::UUID, 'Review request not found';
    RETURN;
  END IF;

  -- Ownership: only the requesting owner can trigger automatic matching on
  -- their own request. Admins keep the manual assign path; lawyers act only
  -- on assigned reviews through the existing transition actions.
  IF v_request.user_id IS DISTINCT FROM auth.uid() THEN
    RETURN QUERY SELECT false, NULL::UUID, 'Not your review request';
    RETURN;
  END IF;

  IF v_request.lawyer_id IS NOT NULL THEN
    RETURN QUERY SELECT false, v_request.lawyer_id, 'A lawyer is already assigned';
    RETURN;
  END IF;

  IF v_request.status NOT IN ('requested', 'waitlist') THEN
    RETURN QUERY SELECT false, NULL::UUID, 'Request is no longer awaiting assignment';
    RETURN;
  END IF;

  -- Conservative pick: verified, not the owner's own lawyer profile, never a
  -- recorded decliner on this request, least active workload, deterministic
  -- tie-break. No jurisdiction/specialty guessing (see header).
  SELECT l.id INTO v_pick
  FROM lawyers l
  LEFT JOIN consultation_requests active
    ON active.lawyer_id = l.id
    AND active.status IN ('matched', 'accepted', 'in_progress', 'changes_requested', 'client_review')
  WHERE l.verification_status = 'verified'
    AND (l.user_id IS NULL OR l.user_id IS DISTINCT FROM v_request.user_id)
    AND NOT EXISTS (
      SELECT 1 FROM activity_events e
      WHERE e.audit_id = v_request.audit_id
        AND e.event_type = 'review_decline'
        AND (e.payload ->> 'request_id') = v_request.id::TEXT
        AND (e.payload ->> 'lawyer_id') = l.id::TEXT
    )
  GROUP BY l.id, l.created_at
  ORDER BY COUNT(active.id) ASC, l.created_at ASC, l.id ASC
  LIMIT 1;

  IF v_pick IS NULL THEN
    RETURN QUERY SELECT false, NULL::UUID, 'no_eligible_lawyer';
    RETURN;
  END IF;

  -- Conditional write: only lands if nobody assigned meanwhile.
  UPDATE consultation_requests
  SET lawyer_id = v_pick,
      status = 'matched',
      updated_at = now()
  WHERE id = v_request.id
    AND lawyer_id IS NULL
    AND status IN ('requested', 'waitlist');

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::UUID, 'race_lost';
    RETURN;
  END IF;

  INSERT INTO activity_events (user_id, audit_id, event_type, payload)
  VALUES (
    v_request.user_id,
    v_request.audit_id,
    'review_auto_assigned',
    jsonb_build_object('request_id', v_request.id, 'lawyer_id', v_pick)
  );

  RETURN QUERY SELECT true, v_pick, 'Lawyer assigned automatically';
END;
$$;

GRANT EXECUTE ON FUNCTION auto_assign_review TO authenticated;
