-- 00126: report schedules + run history (delivery D3).
--
-- Schedules bind a saved report to a cadence (weekly/monthly), an hour,
-- and an explicit IANA timezone — never implicit UTC. Subscriptions
-- expire (default +12 months) with no silent renewal; expiry pauses
-- delivery, it never deletes the schedule. Every execution lands in
-- report_runs with status (sent / skipped_empty / failed) so failures
-- and empty skips are auditable, never silent.
--
-- Forward-only, additive. Owner-scoped RLS throughout. No service-role
-- bypass (the cron executor reads due schedules with the service client
-- and re-scopes every run to the schedule owner's user_id).

CREATE TABLE report_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  saved_report_id UUID NOT NULL REFERENCES saved_reports(id) ON DELETE CASCADE,
  cadence TEXT NOT NULL CHECK (cadence IN ('weekly', 'monthly')),
  timezone TEXT NOT NULL CHECK (char_length(timezone) BETWEEN 1 AND 64),
  send_hour INT NOT NULL CHECK (send_hour >= 0 AND send_hour <= 23),
  send_weekday INT NULL CHECK (send_weekday IS NULL OR (send_weekday >= 0 AND send_weekday <= 6)),
  active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '12 months'),
  last_run_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX report_schedules_due_idx ON report_schedules (active, expires_at);

ALTER TABLE report_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own report schedules"
  ON report_schedules FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE report_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES report_schedules(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('sent', 'skipped_empty', 'failed')),
  row_count INT NOT NULL DEFAULT 0 CHECK (row_count >= 0),
  channel TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'in_app')),
  error TEXT NOT NULL DEFAULT '' CHECK (char_length(error) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX report_runs_schedule_idx ON report_runs (schedule_id, created_at DESC);

ALTER TABLE report_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own report runs"
  ON report_runs FOR SELECT
  USING (auth.uid() = user_id);
