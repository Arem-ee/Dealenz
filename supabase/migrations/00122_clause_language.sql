-- 00122: agreement-language dimension on library lines (i18n D3).
--
-- Localized lines are children of a line key, one history per
-- key+variant+language: preferred-FR evolves independently of
-- preferred-EN, each with its own versions, deprecation, and provenance.
-- Assembly resolves the requested language per clause with explicit
-- English fallback (labeled, never silent). Machine translation never
-- writes here: rows enter through the same save/version/deprecate
-- governance as English, enforced in the server actions, not the schema.
--
-- Forward-only, additive. Existing rows read as English. RLS untouched
-- (owner-scoped policy from 00110 still applies).

ALTER TABLE library_clauses
  ADD COLUMN language TEXT NOT NULL DEFAULT 'en'
    CHECK (language IN ('en', 'fr', 'de'));

ALTER TABLE library_clauses
  DROP CONSTRAINT library_clauses_user_key_variant_version_key;

ALTER TABLE library_clauses
  ADD CONSTRAINT library_clauses_user_key_variant_lang_version_key
    UNIQUE (user_id, key, variant, language, version);
