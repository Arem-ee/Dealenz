-- Counterparty research briefs (P1: registry brief).
--
-- One row per completed research run: the confirmed subject, the sourced
-- claims, the explicit unknowns, and what was charged. Briefs are private to
-- the requesting user (unlike published knowledge): counterparty research is
-- per-deal work product, and the subject is a real-world party the user may
-- be negotiating with. No public read policies by design.
--
-- Forward-only. Safe re-run (IF NOT EXISTS guards).

CREATE TABLE IF NOT EXISTS counterparty_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  audit_id UUID REFERENCES audits(id) ON DELETE SET NULL,
  subject_name TEXT NOT NULL CHECK (char_length(subject_name) BETWEEN 1 AND 200),
  country TEXT NOT NULL CHECK (char_length(country) BETWEEN 1 AND 120),
  region TEXT CHECK (region IS NULL OR char_length(region) BETWEEN 1 AND 120),
  brief JSONB NOT NULL DEFAULT '{}'::jsonb,
  credits_charged INTEGER NOT NULL CHECK (credits_charged >= 0),
  -- Research retries must never persist twice: the server upserts on this
  -- key and reads the row back, so a retried run returns the original brief.
  idempotency_key TEXT NOT NULL UNIQUE CHECK (char_length(idempotency_key) BETWEEN 1 AND 120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_counterparty_briefs_user ON counterparty_briefs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_counterparty_briefs_audit ON counterparty_briefs(audit_id) WHERE audit_id IS NOT NULL;

ALTER TABLE counterparty_briefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own briefs" ON counterparty_briefs;
CREATE POLICY "Users can read their own briefs"
  ON counterparty_briefs FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own briefs" ON counterparty_briefs;
CREATE POLICY "Users can insert their own briefs"
  ON counterparty_briefs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Briefs are immutable audit artifacts: no UPDATE or DELETE policies exist
-- by design. Corrections are new research runs, never rewrites.
