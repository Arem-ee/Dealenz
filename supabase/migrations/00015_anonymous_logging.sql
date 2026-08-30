-- Allow anonymous insert into system_logs for auth failure logging
-- The existing policy checks auth.uid() = user_id, which fails when both are NULL
CREATE POLICY "Allow anonymous insert for auth failures"
  ON system_logs FOR INSERT
  WITH CHECK (user_id IS NULL);
