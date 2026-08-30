CREATE TABLE activity_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  audit_id UUID REFERENCES audits(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE activity_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own events"
  ON activity_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own events"
  ON activity_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_activity_events_user_id ON activity_events(user_id);
CREATE INDEX idx_activity_events_audit_id ON activity_events(audit_id);
CREATE INDEX idx_activity_events_created_at ON activity_events(created_at DESC);
