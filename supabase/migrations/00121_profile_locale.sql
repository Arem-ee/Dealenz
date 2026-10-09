-- 00121: profile interface locale (i18n D2).
--
-- Language is a personal-layer setting like model keys: the profile stores
-- the override, the cookie carries the request locale, English is the
-- fallback. Constrained to shipped locales; new languages extend the
-- CHECK when their message catalogs land. No RLS change (owner-managed
-- profile rows, migration 00011 policy still applies).
--
-- Forward-only, additive.

ALTER TABLE business_profiles
  ADD COLUMN IF NOT EXISTS locale TEXT NOT NULL DEFAULT 'en'
    CHECK (locale IN ('en', 'fr', 'de'));
