-- 00124: Dutch locale across profile and library (i18n follow-up).
--
-- Extends the shipped-language CHECKs from en/fr/de to en/fr/de/nl.
-- Existing rows are unaffected (constraints only bound future writes).
-- Search stemming for Dutch rides migration 00125 (same proven pattern
-- as 00123); this migration carries the write-side widening only.
--
-- Forward-only, additive. No RLS changes, no grants.

ALTER TABLE business_profiles
  DROP CONSTRAINT business_profiles_locale_check;

ALTER TABLE business_profiles
  ADD CONSTRAINT business_profiles_locale_check
    CHECK (locale IN ('en', 'fr', 'de', 'nl'));

ALTER TABLE library_clauses
  DROP CONSTRAINT library_clauses_language_check;

ALTER TABLE library_clauses
  ADD CONSTRAINT library_clauses_language_check
    CHECK (language IN ('en', 'fr', 'de', 'nl'));
