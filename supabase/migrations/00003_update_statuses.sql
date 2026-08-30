ALTER TABLE audits DROP CONSTRAINT IF EXISTS audits_status_check;

ALTER TABLE audits ADD CONSTRAINT audits_status_check
  CHECK (status IN ('draft', 'in_progress', 'completed', 'archived', 'processing', 'analyzed', 'failed'));
