-- Phase 3 data lifecycle & reliability: forward-only consistency fixes.
--
-- 1. document_versions.document_type: the CHECK only allowed the four
--    freelance values, so every business-owner draft persist (family id as
--    document_type) failed with a CHECK violation that the caller swallowed.
--    Drafts were therefore never persisted (no versions, no review/export
--    history). Extended to the 11 real family ids. Share/sign tables keep
--    their freelance-only CHECKs: sharing stays freelance-scoped by product
--    boundary (createShareToken allowlists the same four values).
-- 2. document_versions.generation_method: deterministic assembly is neither
--    "ai" nor "template" output; record it honestly as "assembled".
-- 3. uq_document_version: concurrent generations for one audit+type raced
--    the read-then-insert version counter and silently duplicated version
--    numbers. Uniqueness makes the second writer fail loudly so callers
--    retry with a fresh number instead of forking history.
-- 4. credit_balance: pending reservation holds had no expiry — a crash
--    between reserve and finalize/void locked those credits forever.
--    Pending holds older than 1 hour no longer count (operations are
--    request-scoped seconds; 1h is generous). finalize/void on stale rows
--    still work: voiding is a no-op balance-wise, finalizing records the
--    measured consumption exactly once. reserve_credits needs no change:
--    it derives both balance checks from credit_balance().
-- 5. grant_credits: optional p_idempotency_key (default NULL preserves all
--    existing calls). Supplied keys insert ON CONFLICT DO NOTHING against
--    the ledger UNIQUE(user_id, idempotency_key), so retried admin/reward
--    grants cannot double-grant. Behavior otherwise identical.
-- 6. uq_consultation_active_per_audit: the application duplicate guard
--    (check-then-insert) races under double-submit. Partial unique index
--    over active statuses makes the second insert fail at the database;
--    callers already translate that into "already submitted".
-- 7. check_anonymous_rate_limit: opportunistic expiry cleanup (bounded,
--    probabilistic) so the counter table cannot grow on distinct IPs
--    forever. No cron, no new infra; behavior otherwise identical.
--
-- Forward-only; no historical migration edited. No live application claimed.

-- 1+2+3. Document versions: family ids, assembled method, version uniqueness.
ALTER TABLE document_versions DROP CONSTRAINT IF EXISTS document_versions_document_type_check;
ALTER TABLE document_versions ADD CONSTRAINT document_versions_document_type_check CHECK (
  document_type IN (
    'proposal', 'sow', 'contract', 'checklist',
    'founder-agreement', 'shareholders-agreement', 'founder-ip-assignment', 'vesting-schedule',
    'partnership-agreement', 'llp-agreement', 'contribution-schedule', 'profit-schedule',
    'purchase-terms-sheet', 'lease-terms-summary', 'employment-terms-summary'
  )
);

ALTER TABLE document_versions DROP CONSTRAINT IF EXISTS document_versions_generation_method_check;
ALTER TABLE document_versions ADD CONSTRAINT document_versions_generation_method_check CHECK (
  generation_method IN ('ai', 'template', 'assembled', 'lawyer_revision')
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_document_version
  ON document_versions (audit_id, document_type, version_number);

-- 4. Balance: stale pending holds expire (self-healing, no reaper needed).
CREATE OR REPLACE FUNCTION credit_balance()
RETURNS TABLE(balance INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_balance INTEGER := 0;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT 0;
    RETURN;
  END IF;
  SELECT COALESCE(SUM(
    CASE
      WHEN t.status = 'voided' THEN 0
      WHEN t.entry_type IN ('grant', 'refund') THEN t.amount
      WHEN t.entry_type = 'adjustment' THEN t.amount
      WHEN t.entry_type = 'consumption' THEN -t.amount
      -- Pending holds count only while fresh: a crash between reserve and
      -- finalize/void must not lock credits forever. Operations are
      -- request-scoped (seconds); 1 hour is a generous bound. Late
      -- finalize/void calls still settle correctly (void = no-op,
      -- finalize = single measured consumption).
      WHEN t.entry_type = 'reservation' AND t.status = 'pending'
        AND t.created_at > now() - interval '1 hour' THEN -t.amount
      ELSE 0
    END
  ), 0) INTO v_balance
  FROM credit_ledger t
  WHERE t.user_id = v_user_id;
  RETURN QUERY SELECT v_balance;
END;
$$;

-- 5. grant_credits: optional idempotency key, otherwise identical.
-- DROP first: CREATE OR REPLACE with a changed signature would overload
-- instead of replacing, leaving the old 3-arg version live.
DROP FUNCTION IF EXISTS grant_credits(UUID, INTEGER, TEXT);
CREATE FUNCTION grant_credits(
  p_user_id UUID,
  p_amount INTEGER,
  p_reason TEXT,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS TABLE(balance INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance INTEGER := 0;
BEGIN
  IF NOT COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) THEN
    RAISE EXCEPTION 'Administrator access required';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Grant amount must be positive';
  END IF;
  IF p_idempotency_key IS NOT NULL
    AND (char_length(p_idempotency_key) = 0 OR char_length(p_idempotency_key) > 120) THEN
    RAISE EXCEPTION 'Invalid idempotency key';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('credit_ledger:' || p_user_id::text));

  IF p_idempotency_key IS NULL THEN
    INSERT INTO credit_ledger (user_id, entry_type, amount, operation, status, metadata)
    VALUES (p_user_id, 'grant', p_amount, NULL, 'finalized', jsonb_build_object('reason', p_reason));
  ELSE
    INSERT INTO credit_ledger (user_id, entry_type, amount, operation, status, idempotency_key, metadata)
    VALUES (p_user_id, 'grant', p_amount, NULL, 'finalized', p_idempotency_key, jsonb_build_object('reason', p_reason))
    ON CONFLICT (user_id, idempotency_key) DO NOTHING;
  END IF;

  SELECT COALESCE(SUM(
    CASE
      WHEN t.status = 'voided' THEN 0
      WHEN t.entry_type IN ('grant', 'refund') THEN t.amount
      WHEN t.entry_type = 'adjustment' THEN t.amount
      WHEN t.entry_type = 'consumption' THEN -t.amount
      WHEN t.entry_type = 'reservation' AND t.status = 'pending'
        AND t.created_at > now() - interval '1 hour' THEN -t.amount
      ELSE 0
    END
  ), 0) INTO v_balance
  FROM credit_ledger t
  WHERE t.user_id = p_user_id;
  RETURN QUERY SELECT v_balance;
END;
$$;

-- 6. Consultation double-submit race: one active request per audit at the DB.
CREATE UNIQUE INDEX IF NOT EXISTS uq_consultation_active_per_audit
  ON consultation_requests (audit_id)
  WHERE status IN ('requested', 'matched', 'in_progress');

-- 7. Limiter self-cleanup: bounded probabilistic expiry of dead windows.
CREATE OR REPLACE FUNCTION check_anonymous_rate_limit(
  p_key TEXT,
  p_limit INTEGER,
  p_window_seconds INTEGER DEFAULT 3600
)
RETURNS TABLE(allowed BOOLEAN, current_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
  v_window INTEGER;
BEGIN
  IF p_key IS NULL OR char_length(p_key) = 0 OR char_length(p_key) > 128 THEN
    RETURN QUERY SELECT false, 0;
    RETURN;
  END IF;
  IF p_limit IS NULL OR p_limit < 1 THEN
    RETURN QUERY SELECT false, 0;
    RETURN;
  END IF;
  v_window := GREATEST(COALESCE(p_window_seconds, 3600), 60);

  -- Opportunistic hygiene (~5% of calls, capped): expired windows are dead
  -- state. Keeps the table bounded without a cron or background worker.
  IF random() < 0.05 THEN
    DELETE FROM anonymous_rate_limits a
    USING (SELECT ctid FROM anonymous_rate_limits
           WHERE window_start < now() - interval '7 days'
           LIMIT 100) expired
    WHERE a.ctid = expired.ctid;
  END IF;

  INSERT INTO anonymous_rate_limits (rate_key, window_start, count, updated_at)
  VALUES (p_key, now(), 1, now())
  ON CONFLICT (rate_key) DO UPDATE SET
    count = CASE WHEN anonymous_rate_limits.window_start <= now() - (v_window || ' seconds')::interval THEN 1 ELSE anonymous_rate_limits.count + 1 END,
    window_start = CASE WHEN anonymous_rate_limits.window_start <= now() - (v_window || ' seconds')::interval THEN now() ELSE anonymous_rate_limits.window_start END,
    updated_at = now();

  SELECT count INTO v_count FROM anonymous_rate_limits WHERE rate_key = p_key;
  RETURN QUERY SELECT v_count <= p_limit, COALESCE(v_count, 0);
END;
$$;
