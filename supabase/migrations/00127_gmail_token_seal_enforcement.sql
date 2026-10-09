-- 00127: enforce sealed Gmail tokens at rest.
-- Legacy plaintext rows are a takeover risk on DB dump; purge them so owners
-- re-authorize into encrypted envelopes (code fails closed without the key).
DELETE FROM gmail_tokens
WHERE access_token NOT LIKE 'enc:%' OR refresh_token NOT LIKE 'enc:%';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'gmail_tokens_sealed_check'
  ) THEN
    ALTER TABLE gmail_tokens
      ADD CONSTRAINT gmail_tokens_sealed_check
      CHECK (access_token LIKE 'enc:%' AND refresh_token LIKE 'enc:%');
  END IF;
END $$;
