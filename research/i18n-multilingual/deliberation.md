# i18n / Multilingual Deliberation

Status: PROPOSED. Nothing below changes `product.md` / `architecture.md`
until approved. Approval amends the docs first, then code follows.

## D1. Layer order: UI locale → agreement language → extraction quality

- Options: (a) all three layers at once; (b) UI strings first, agreement
  language second, per-language extraction third.
- Evidence: Ironclad shipped requester-UI translation alone and calls it
  complete for its audience; Icertis treats clause localization as the
  deeper project; buyers buy on extraction quality, which is ongoing work,
  not a milestone.
- Recommendation: **(b)**. Each layer ships value independently; each
  later layer assumes the earlier one (you can't review a French UI
  showing English-only clauses without confusion about what's localized).

## D2. UI strings: cookie locale, no URL routing

- Options: (a) `next-intl` with cookie-based locale (no route moves, no
  middleware merge beyond the existing proxy); (b) full `[locale]`
  prefixed routing.
- Evidence: prefixed routing exists for SEO; Dealenz's app is
  authenticated (SEO irrelevant there), has ~50 routes under one proxy
  doing session refresh + auth redirects, and product.md fixes the
  single-search/top-bar shell. A route move is risk without reward.
- Recommendation: **(a)**. Locale resolves browser → profile override →
  English fallback (the Ironclad cascade); missing keys fall back to
  English **and log** (the production gotcha); typed message keys.
  Pilot languages: French + German (EU deal coverage; both top every
  vendor list). Dutch next by buyer demand (Gartner thread), not upfront.

## D3. Agreement language: localized clause variants (Icertis model)

- Options: (a) language as a variant dimension on library lines
  (preferred-FR, fallback-FR…) assembled by an Agreement Language
  attribute; (b) parallel templates per language.
- Evidence: secondary-clauses-as-children kills the N-templates problem;
  rules stay English and evaluate unchanged — exactly Dealenz's
  rule-determined doctrine.
- Recommendation: **(a)**. Language joins the variant key; assembly
  picks the requested language with English fallback per clause (never
  a half-French document silently); anchors record the language used.
  Machine translation never writes approved language — localized lines
  enter through the same save/version/deprecate governance as English.

## D4. AI prose language: per-call instruction, verdicts untouched

- Options: (a) response-language instruction + localized clause
  insertion, rules/fallback logic unchanged; (b) per-language prompts.
- Evidence: doctrine split (language affects prose only, like model
  choice); BYOK models differ in non-English quality, so output language
  is best-effort with the active model, never guaranteed.
- Recommendation: **(a)**. Findings cite the English rule + show the
  localized rendering; unknown-stays-unknown applies to translation
  doubt too (qualify rather than invent legal French).

## D5. Locale correctness from day one of UI strings

- Recommendation (no real alternative): `Intl` dates/numbers/currencies,
  per-locale formats in assembled tables (Icertis lesson), profile-stored
  locale driving both UI and document defaults. RTL out of scope until a
  right-to-left buyer exists (font + layout cost unjustified before that).

## D6. Per-language search (APPROVED — building)

- Design (Postgres built-ins: Snowball stemmers per language, GIN per
  column): stored `content_tsv_fr` / `content_tsv_de` (+ quote variants)
  beside the English columns — one table rewrite each, explicit and
  planner-friendly over concatenated-vector or config-function tricks.
- One call, two recalls: the query runs in the user's config against
  same-language columns **and** in English against English columns, so a
  French user still finds English deals (no recall cliff). Full
  cross-language semantic search stays deferred; recall never breaks.
- Remaining deferred: localized rule text (rules stay English, per
  Icertis); CJK/Arabic fonts; SEO hreflang; extraction benchmarking.

## Doc amendments on approval

1. `product.md` Design Language + Settings: personal-layer language
   setting (profile, like language/model keys/billing); French + German
   pilot; agreement language attribute on generation.
2. `architecture.md` Frontend Rules: cookie locale via next-intl, English
   fallback with logging; clause variant key gains language; AI
   per-call language instruction.
