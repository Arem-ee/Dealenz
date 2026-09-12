-- Phase: Founder/Business-Owner lawyer handoff — store structured snapshot for consultation.
-- Forward-only, nullable, no backfill. RLS already covers consultation_requests; snapshot is
-- user-owned via the same row. No new table, no new RLS, no secrets.

ALTER TABLE consultation_requests
  ADD COLUMN IF NOT EXISTS handoff_snapshot JSONB;

-- Optional: index for future handoff analytics (not required for MVP)
CREATE INDEX IF NOT EXISTS idx_consultation_requests_handoff_snapshot ON consultation_requests USING GIN (handoff_snapshot);
