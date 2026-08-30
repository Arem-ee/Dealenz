CREATE TABLE IF NOT EXISTS system_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID REFERENCES public.audits(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  phase TEXT NOT NULL,
  status TEXT NOT NULL,
  error_message TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own logs" ON system_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can read logs" ON system_logs
  FOR SELECT USING (auth.role() = 'service_role');
