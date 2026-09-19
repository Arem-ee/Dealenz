-- Incremental per-step credit deduction against a plan reservation.
--
-- Until now the executor reserved the plan estimate up front and settled the
-- whole measured total once at the end (finalize_reservation). If execution
-- crashed mid-plan, consumed steps had no ledger record until finalization.
-- This RPC lets the executor settle each succeeded step immediately:
-- idempotent per (reservation, step key), capped so the running total can
-- never exceed the reserved amount, and never voiding the reservation —
-- final settlement still goes through finalize_reservation for the remainder.
--
-- Forward-only. Safe re-run (OR REPLACE throughout).

CREATE OR REPLACE FUNCTION consume_reservation_step(
  p_reservation_id UUID,
  p_step_key TEXT,
  p_amount INTEGER
)
RETURNS TABLE(consumed_total INTEGER, remaining INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_owner UUID;
  v_status TEXT;
  v_reserved INTEGER;
  v_operation TEXT;
  v_used INTEGER := 0;
  v_key TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_amount IS NULL OR p_amount < 0 THEN
    RAISE EXCEPTION 'Step amount must be non-negative';
  END IF;
  IF p_step_key IS NULL OR char_length(p_step_key) = 0 OR char_length(p_step_key) > 78 THEN
    RAISE EXCEPTION 'Step key required (max 78 chars)';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('credit_ledger:' || v_user_id::text));

  SELECT t.user_id, t.status, t.amount, t.operation
    INTO v_owner, v_status, v_reserved, v_operation
  FROM credit_ledger t
  WHERE t.id = p_reservation_id AND t.entry_type = 'reservation';

  IF v_owner IS NULL OR v_owner <> v_user_id THEN
    RAISE EXCEPTION 'Reservation not found';
  END IF;
  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'Reservation is no longer pending';
  END IF;

  v_key := 'step:' || p_reservation_id::text || ':' || p_step_key;

  -- Idempotent replay: this step already settled.
  IF EXISTS (
    SELECT 1 FROM credit_ledger
    WHERE user_id = v_user_id AND idempotency_key = v_key
  ) THEN
    SELECT COALESCE(SUM(amount), 0) INTO v_used
    FROM credit_ledger
    WHERE related_entry_id = p_reservation_id
      AND entry_type = 'consumption'
      AND status = 'finalized';
    RETURN QUERY SELECT v_used, GREATEST(v_reserved - v_used, 0);
    RETURN;
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_used
  FROM credit_ledger
  WHERE related_entry_id = p_reservation_id
    AND entry_type = 'consumption'
    AND status = 'finalized';

  IF v_used + p_amount > v_reserved THEN
    RAISE EXCEPTION 'Step consumption exceeds reservation';
  END IF;

  IF p_amount > 0 THEN
    INSERT INTO credit_ledger (user_id, entry_type, amount, operation, status, related_entry_id, idempotency_key, metadata)
    VALUES (v_user_id, 'consumption', p_amount, v_operation, 'finalized', p_reservation_id, v_key, jsonb_build_object('step_key', p_step_key));
  END IF;

  RETURN QUERY SELECT v_used + p_amount, GREATEST(v_reserved - (v_used + p_amount), 0);
END;
$$;

GRANT EXECUTE ON FUNCTION consume_reservation_step(UUID, TEXT, INTEGER) TO authenticated;
