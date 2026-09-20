-- Token-cost measurement readout (bundle pricing input).
--
-- analyzeDeal logs every AI step's measured tokens into system_logs
-- (phase ai_usage, structured metadata: operation, dealType, step,
-- inputTokens, outputTokens). This RPC aggregates a trailing window per
-- deal type so bundle prices can be set from measured cost instead of
-- guesses. Tokens only: dollar conversion is deliberately deferred until
-- pricing design, when real provider rates can be pinned and dated.
--
-- Admin-only via the standard app_metadata gate; EXECUTE is granted to
-- authenticated so the gate (not the grant) is the boundary, matching
-- existing admin RPCs. Forward-only. Safe re-run (OR REPLACE).
CREATE OR REPLACE FUNCTION token_cost_summary(p_days INTEGER DEFAULT 7)
RETURNS TABLE(
  deal_type TEXT,
  operation TEXT,
  step TEXT,
  calls BIGINT,
  measured_calls BIGINT,
  input_tokens BIGINT,
  output_tokens BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_days INTEGER;
BEGIN
  IF NOT COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  v_days := GREATEST(1, LEAST(90, COALESCE(p_days, 7)));

  RETURN QUERY
  SELECT
    COALESCE(NULLIF(metadata ->> 'dealType', ''), 'unknown') AS deal_type,
    COALESCE(NULLIF(metadata ->> 'operation', ''), 'unknown') AS operation,
    COALESCE(NULLIF(metadata ->> 'step', ''), 'unknown') AS step,
    COUNT(*)::BIGINT AS calls,
    COUNT(*) FILTER (WHERE (metadata ->> 'inputTokens') ~ '^[0-9]+$')::BIGINT AS measured_calls,
    COALESCE(SUM((metadata ->> 'inputTokens')::BIGINT) FILTER (WHERE (metadata ->> 'inputTokens') ~ '^[0-9]+$'), 0)::BIGINT AS input_tokens,
    COALESCE(SUM((metadata ->> 'outputTokens')::BIGINT) FILTER (WHERE (metadata ->> 'outputTokens') ~ '^[0-9]+$'), 0)::BIGINT AS output_tokens
  FROM system_logs
  WHERE phase = 'ai_usage'
    AND created_at > now() - make_interval(days => v_days)
  GROUP BY 1, 2, 3
  ORDER BY 1, 2, 3;
END;
$$;

GRANT EXECUTE ON FUNCTION token_cost_summary(INTEGER) TO authenticated;
