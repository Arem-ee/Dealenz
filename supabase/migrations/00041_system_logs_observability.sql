-- Phase 2 observability: severity + metadata on system_logs.
--
-- Forward-only, backward compatible: new columns are defaulted, so every
-- existing insert (which names columns explicitly) keeps working unchanged.
-- No RLS change: existing insert/select policies apply as before.
-- Indexes support the fallback-spike query used by /api/health without
-- scanning the whole log table.
-- No live application claimed; verify with `supabase db push`.

ALTER TABLE system_logs
  ADD COLUMN IF NOT EXISTS severity TEXT NOT NULL DEFAULT 'info';

ALTER TABLE system_logs
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_system_logs_created_at
  ON system_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_system_logs_phase_created_at
  ON system_logs (phase, created_at DESC);
