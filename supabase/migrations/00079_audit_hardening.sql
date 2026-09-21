-- Post-audit hardening bundle (all items verified against live code).
--
-- 1. share_tokens: the owner-scoped policy had USING but no WITH CHECK, so
--    an authenticated caller could INSERT/UPDATE token rows pointing at
--    unowned audits. Same condition on both paths now.
-- 2. sign_document_as_counterparty: no production caller uses the anonymous
--    path (invitees sign via the token-bound sign_as_invitee RPC), so the
--    anon grant is pure attack surface. Revoked; authenticated retained.
-- 3. enforce_document_version_lock: rejected every mutation of locked rows,
--    which also blocked the legitimate locked -> superseded redraft step
--    (child created, then throw). Exactly that single-column transition is
--    now permitted; everything else stays immutable.
-- 4. enforce_document_version_transition: owner_signed -> fully_signed let
--    an owner self-complete with zero counterparty signatures. Removed;
--    full signing still requires every signer via the RPC count check.
-- 5. finalize_reservation: consumption is now capped at the reserved
--    amount. Correct callers pass equal values and see no change.
-- 6. lawyers.user_id: SET NULL orphaned professional PII (name, bar
--    license) when a lawyer deletes their account. CASCADE completes
--    erasure; past consultations keep working via their own SET NULL refs.
-- 7. document_versions_document_type_check: 00059 narrowed the 00042 family
--    list; code still addresses the wider families. Union of both lists so
--    a future vertical enablement cannot hit a wall.
-- 8. Anonymous system_logs inserts: restricted to the auth/client-error
--    phases the product actually writes anonymously, with a length cap.
-- 9. get_shared_report: UUID gate plus 10-minute report_viewed write
--    throttle, mirroring the document-share hardening in 00040.
-- 10. Index backing the document_viewed throttle lookup.
--
-- Forward-only. Safe re-run (IF EXISTS / OR REPLACE / IF NOT EXISTS).

-- 1. share_tokens write check.
DROP POLICY IF EXISTS "Users manage own share tokens" ON share_tokens;
CREATE POLICY "Users manage own share tokens"
  ON share_tokens FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM audits WHERE audits.id = share_tokens.audit_id AND audits.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM audits WHERE audits.id = share_tokens.audit_id AND audits.user_id = auth.uid()
    )
  );

-- 2. Revoke anonymous counterparty signing (no legitimate anon caller).
REVOKE EXECUTE ON FUNCTION sign_document_as_counterparty(UUID, TEXT) FROM anon;

-- 3. Allow the single legitimate locked-row mutation.
CREATE OR REPLACE FUNCTION enforce_document_version_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.status IN ('locked','fully_signed','superseded') THEN
    IF NEW IS DISTINCT FROM OLD THEN
      -- Sole exception: the redraft flow marks locked -> superseded.
      -- Only the status transition is allowed; every other column must
      -- be byte-identical (jsonb key-drop comparison is future-proof).
      IF OLD.status = 'locked' AND NEW.status = 'superseded'
        AND to_jsonb(NEW) - '{status,updated_at}' = to_jsonb(OLD) - '{status,updated_at}' THEN
        RETURN NEW;
      END IF;
      RAISE EXCEPTION 'Immutable document version: locked/fully_signed/superseded versions cannot be mutated (id=%)', OLD.id;
    END IF;
  END IF;
  IF OLD.content_hash IS NOT NULL AND NEW.content_hash IS DISTINCT FROM OLD.content_hash THEN
    RAISE EXCEPTION 'content_hash is immutable once set (id=%)', OLD.id;
  END IF;
  IF OLD.parent_version_id IS NOT NULL AND NEW.parent_version_id IS DISTINCT FROM OLD.parent_version_id THEN
    RAISE EXCEPTION 'parent_version_id is immutable (id=%)', OLD.id;
  END IF;
  RETURN NEW;
END;
$$;

-- 4. Owner can no longer self-complete execution.
CREATE OR REPLACE FUNCTION enforce_document_version_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;
  IF OLD.status = 'draft' AND NEW.status IN ('ready_to_sign','ready_to_send') THEN RETURN NEW; END IF;
  IF OLD.status IN ('ready_to_sign','ready_to_send') AND NEW.status = 'owner_signed' THEN RETURN NEW; END IF;
  IF OLD.status = 'owner_signed' AND NEW.status IN ('counterparty_pending','sent') THEN RETURN NEW; END IF;
  IF OLD.status IN ('counterparty_pending','sent') AND NEW.status IN ('fully_signed','locked') THEN RETURN NEW; END IF;
  IF OLD.status = 'fully_signed' AND NEW.status = 'locked' THEN RETURN NEW; END IF;
  IF OLD.status = 'locked' AND NEW.status = 'superseded' THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Illegal document_versions transition % -> %', OLD.status, NEW.status;
END;
$$;

-- 5. Cap consumption at the reserved amount.
CREATE OR REPLACE FUNCTION finalize_reservation(p_reservation_id UUID, p_consumption_amount INTEGER, p_operation TEXT)
RETURNS TABLE(balance INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_balance INTEGER := 0;
  v_owner UUID;
  v_status TEXT;
  v_key TEXT;
  v_reserved INTEGER := 0;
  v_charge INTEGER;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_consumption_amount IS NOT NULL AND p_consumption_amount < 0 THEN
    RAISE EXCEPTION 'Consumption amount must be non-negative or null';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('credit_ledger:' || v_user_id::text));

  SELECT t.user_id, t.status, t.idempotency_key, t.amount INTO v_owner, v_status, v_key, v_reserved
  FROM credit_ledger t
  WHERE t.id = p_reservation_id AND t.entry_type = 'reservation';

  IF v_owner IS NULL OR v_owner <> v_user_id THEN
    RAISE EXCEPTION 'Reservation not found';
  END IF;
  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'Reservation is no longer pending';
  END IF;

  UPDATE credit_ledger SET status = 'voided' WHERE id = p_reservation_id;

  v_charge := LEAST(COALESCE(p_consumption_amount, 0), GREATEST(v_reserved, 0));
  IF v_charge > 0 THEN
    INSERT INTO credit_ledger (user_id, entry_type, amount, operation, status, related_entry_id)
    VALUES (v_user_id, 'consumption', v_charge, p_operation, 'finalized', p_reservation_id);
  END IF;

  SELECT b.balance INTO v_balance FROM credit_balance() b;
  RETURN QUERY SELECT v_balance;
END;
$$;

-- 6. Lawyer erasure completes on account deletion.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lawyers_user_id_fkey' AND conrelid = 'public.lawyers'::regclass) THEN
    ALTER TABLE public.lawyers DROP CONSTRAINT lawyers_user_id_fkey;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lawyers_user_id_fkey' AND conrelid = 'public.lawyers'::regclass) THEN
    ALTER TABLE public.lawyers
      ADD CONSTRAINT lawyers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END;
$$;

-- 7. Widen the document family check to the union of code-addressed ids.
ALTER TABLE document_versions DROP CONSTRAINT IF EXISTS document_versions_document_type_check;
ALTER TABLE document_versions ADD CONSTRAINT document_versions_document_type_check CHECK (
  document_type IN (
    'proposal', 'sow', 'contract', 'checklist',
    'founder-agreement', 'shareholders-agreement', 'founder-ip-assignment', 'vesting-schedule',
    'partnership-agreement', 'llp-agreement', 'contribution-schedule', 'profit-schedule',
    'purchase-terms-sheet', 'lease-terms-summary', 'employment-terms-summary',
    'protection_clause', 'negotiation_doc', 'clarification_request', 'protection_summary',
    'proposal_batch'
  )
);

-- 8. Anonymous log inserts: only the phases the product writes anonymously.
DROP POLICY IF EXISTS "Allow anonymous insert for auth failures" ON system_logs;
CREATE POLICY "Allow anonymous insert for auth failures"
  ON system_logs FOR INSERT
  WITH CHECK (
    user_id IS NULL
    AND phase IN ('auth_login', 'auth_register', 'client_error')
    AND octet_length(COALESCE(error_message, '')) <= 2000
  );

-- 9. Redefine the report share RPC with input gate + write throttle.
CREATE OR REPLACE FUNCTION get_shared_report(p_token TEXT)
RETURNS TABLE (
  audit_id UUID,
  deal_type TEXT,
  risk_level TEXT,
  overall_score INTEGER,
  findings JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_share_id UUID;
  v_audit_id UUID;
BEGIN
  IF p_token IS NULL
    OR char_length(p_token) > 64
    OR p_token !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  THEN
    RETURN;
  END IF;

  SELECT id, st.audit_id INTO v_share_id, v_audit_id
  FROM share_tokens st
  WHERE st.token = p_token
    AND st.document_type = 'report'
    AND st.revoked_at IS NULL
    AND st.expires_at > now();

  IF NOT FOUND THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    a.id,
    COALESCE(a.deal_type, 'unknown'),
    COALESCE((a.risk_report ->> 'riskLevel'), 'Unknown'),
    COALESCE((a.risk_report ->> 'overallScore')::INTEGER, NULL),
    COALESCE(a.structured_data -> 'deterministicFindings', '[]'::JSONB)
  FROM audits a
  WHERE a.id = v_audit_id;

  -- Throttle the write path: at most one report_viewed event per token
  -- per 10 minutes. Views still serve; only the log write is bounded.
  IF NOT EXISTS (
    SELECT 1 FROM activity_events
    WHERE event_type = 'report_viewed'
      AND payload->>'share_token_id' = v_share_id::text
      AND created_at > now() - interval '10 minutes'
  ) THEN
    INSERT INTO activity_events (user_id, audit_id, event_type, payload)
    VALUES (
      (SELECT user_id FROM audits WHERE id = v_audit_id),
      v_audit_id,
      'report_viewed',
      jsonb_build_object('share_token_id', v_share_id)
    );
  END IF;

  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION get_shared_report TO anon;

-- 10. Index backing the document_viewed throttle lookup.
CREATE INDEX IF NOT EXISTS idx_activity_events_doc_viewed
  ON activity_events (event_type, created_at);
