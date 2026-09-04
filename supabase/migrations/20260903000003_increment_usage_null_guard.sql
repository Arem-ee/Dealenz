-- Restore graceful default-deny for sessionless callers of increment_usage.
-- The check-first rewrite (00018) has no explicit null-session guard, so a
-- call without a session reaches the insert with a null user_id and raises
-- on the NOT NULL constraint instead of returning default-deny. All
-- application callers invoke this RPC only after user validation, so no
-- current flow changes behavior. Authenticated check-first-then-increment
-- semantics are otherwise identical to 00018.

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
  v_user_id UUID;
  v_count INTEGER := 0;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT false, 0;
    RETURN;
  END IF;

  SELECT t.count INTO v_count
  FROM usage_tracking t
  WHERE t.user_id = v_user_id
    AND t.action_type = p_action_type
    AND t.date = CURRENT_DATE;

  IF COALESCE(v_count, 0) >= p_limit THEN
    RETURN QUERY SELECT false, COALESCE(v_count, 0);
    RETURN;
  END IF;

  INSERT INTO usage_tracking (user_id, action_type, count, date)
  VALUES (v_user_id, p_action_type, 1, CURRENT_DATE)
  ON CONFLICT (user_id, action_type, date)
  DO UPDATE SET count = usage_tracking.count + 1;

  SELECT t.count INTO v_count
  FROM usage_tracking t
  WHERE t.user_id = v_user_id
    AND t.action_type = p_action_type
    AND t.date = CURRENT_DATE;

  RETURN QUERY SELECT true, COALESCE(v_count, 0);
END;
$$;
