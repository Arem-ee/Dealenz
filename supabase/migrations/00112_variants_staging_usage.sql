-- 00112: clause variants, library usage counters, Lab staging label.
--
-- Closes the industry-parity gaps: three-tier clause variants
-- (preferred / fallback / walk-away — without an explicit walk-away,
-- lawyers concede under deal pressure), per-line usage counters (which
-- clauses get used, accepted, and pushed back on), and a staging release
-- label alongside prod (promote dev → staging → prod without redeploys).
--
-- library_clauses gains `variant` (versions are tracked per key+variant, so
-- the uniqueness scope widens from (user,key,version) to
-- (user,key,variant,version); existing rows read as 'preferred').
-- `use_count`/`last_used_at` are maintained best-effort by draft
-- generation and never gate it. prompt_templates gains `staging_version`.
--
-- Forward-only, additive. Existing rows keep their history; RLS is
-- untouched (owner-scoped policies from 00110/00111 still apply).

ALTER TABLE library_clauses
  ADD COLUMN variant TEXT NOT NULL DEFAULT 'preferred'
    CHECK (variant IN ('preferred', 'fallback', 'walkaway'));

ALTER TABLE library_clauses
  DROP CONSTRAINT library_clauses_user_id_key_version_key;

ALTER TABLE library_clauses
  ADD CONSTRAINT library_clauses_user_key_variant_version_key
    UNIQUE (user_id, key, variant, version);

ALTER TABLE library_clauses
  ADD COLUMN use_count INT NOT NULL DEFAULT 0 CHECK (use_count >= 0);

ALTER TABLE library_clauses
  ADD COLUMN last_used_at TIMESTAMPTZ NULL;

ALTER TABLE prompt_templates
  ADD COLUMN staging_version INT NULL
    CHECK (staging_version IS NULL OR staging_version >= 1);
