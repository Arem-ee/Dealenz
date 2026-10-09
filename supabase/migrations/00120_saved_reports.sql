-- 00120: saved custom reports (analytics D4).
--
-- Owner-scoped saved metric runs: name, metric id, and filter params.
-- Definitions live in code (the metric catalog); rows carry parameters
-- only, never SQL. Sharing follows the Team-tab pattern later — v1 is
-- private to the owner. Rerunnable, deletable, CSV-exportable.
--
-- Forward-only, additive. Owner-scoped RLS throughout. No service-role
-- bypass.

CREATE TABLE saved_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  metric TEXT NOT NULL CHECK (char_length(metric) BETWEEN 1 AND 60),
  params JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX saved_reports_user_idx ON saved_reports (user_id, updated_at DESC);

ALTER TABLE saved_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own saved reports"
  ON saved_reports FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
