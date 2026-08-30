CREATE TABLE IF NOT EXISTS usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, action_type, date)
);

ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage" ON usage_tracking
  FOR SELECT USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION increment_usage(
  p_action_type TEXT,
  p_limit INTEGER DEFAULT 5
) RETURNS TABLE (allowed BOOLEAN, current_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_count INTEGER;
  v_date DATE := CURRENT_DATE;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT false, 0;
    RETURN;
  END IF;

  INSERT INTO usage_tracking (user_id, action_type, date, count, created_at)
  VALUES (v_user_id, p_action_type, v_date, 1, NOW())
  ON CONFLICT (user_id, action_type, date)
  DO UPDATE SET count = usage_tracking.count + 1;

  SELECT t.count INTO v_count
  FROM usage_tracking t
  WHERE t.user_id = v_user_id
    AND t.action_type = p_action_type
    AND t.date = v_date;

  RETURN QUERY SELECT v_count <= p_limit, v_count;
END;
$$;
