-- Fix: rewrite increment_usage to check-first-then-increment
-- Previously the counter was incremented unconditionally before
-- checking the limit, consuming quota on every call including failures.

CREATE OR REPLACE FUNCTION increment_usage(
  p_action_type TEXT,
  p_limit INTEGER DEFAULT 5
)
RETURNS TABLE(allowed BOOLEAN, current_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  SELECT t.count INTO v_count
  FROM usage_tracking t
  WHERE t.user_id = auth.uid()
    AND t.action_type = p_action_type
    AND t.date = CURRENT_DATE;

  IF COALESCE(v_count, 0) >= p_limit THEN
    RETURN QUERY SELECT false, COALESCE(v_count, 0);
    RETURN;
  END IF;

  INSERT INTO usage_tracking (user_id, action_type, count, date)
  VALUES (auth.uid(), p_action_type, 1, CURRENT_DATE)
  ON CONFLICT (user_id, action_type, date)
  DO UPDATE SET count = usage_tracking.count + 1;

  SELECT t.count INTO v_count
  FROM usage_tracking t
  WHERE t.user_id = auth.uid()
    AND t.action_type = p_action_type
    AND t.date = CURRENT_DATE;

  RETURN QUERY SELECT true, COALESCE(v_count, 0);
END;
$$;

-- Add missing indexes on system_logs for query performance
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at
  ON system_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_system_logs_user_id
  ON system_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_system_logs_phase_status
  ON system_logs(phase, status);
