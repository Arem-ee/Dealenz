# i18n / Multilingual Market Research

Date: 2026-10-08. Method: vendor documentation + Next.js/i18n guides
(full text fetched). Nothing here is built yet; see `deliberation.md`.

## 1. What the CLM market does (three separate layers)

### Layer 1 — UI locale (Ironclad; Icertis)
- Ironclad translates **only the requester experience** (11 languages:
  French, German, Italian, Japanese, Portuguese ×2, Chinese Simplified,
  Spanish ×2, Vietnamese). Admins and power users see a mix of English +
  selected language — **deliberately partial**, not a failure.
- Icertis localizes UI elements, masterdata values, statuses, dates,
  numbers, currencies across **25 out-of-box languages** plus
  customer-uploaded languages. Rules and configurations stay in English
  and evaluate identically under any display language.
- Language resolution everywhere: browser locale detected first, user
  profile override second, English (US) fallback.

### Layer 2 — Agreement language (Icertis — the sharpest model found)
- **Secondary clauses as localized versions of a primary clause**
  (parent–child): one template, clauses swapped by the Agreement Language
  attribute at assembly. Bilingual templates supported. This kills the
  maintain-N-templates-per-language problem.
- Rules stay English and evaluate on localized values unchanged.
- Formatting localizes with content: date/time/number/currency formats
  per language, including inside assembled tables.

### Layer 3 — AI extraction across languages (Gartner peer thread)
- Buyers with English/Dutch/German/French portfolios require metadata
  extraction **regardless of underlying language** (Agiloft, Onit,
  ContractWorks/ContractSafe/CobbleStone named). Extraction quality per
  language is the buying criterion, not UI chrome.

## 2. Next.js i18n practice (next-intl; official Next 16 docs)

- Standard: `next-intl` with `defineRouting({locales, defaultLocale})`,
  messages per locale (`getTranslations` server / `useTranslations`
  client), typed keys, `Intl` formatters for dates/numbers.
- **Two routing shapes**: locale-prefixed URLs (`/[locale]`, requires
  moving every route + middleware + locale-aware Link/router) vs
  **cookie-based locale with no URL change** (supported, minimal
  migration). SEO needs prefixes; authenticated apps usually don't.
- Next 16 specifics: `next/root-params` available by default (≥16.3);
  `proxy.ts` is the middleware convention — a next-intl middleware would
  have to merge with Dealenz's auth proxy.
- Gotchas from production use: missing keys render **empty string** by
  default (configure fallback to English + log); `NEXT_LOCALE` cookie
  caching confusion in dev; ISR multiplies per locale; hreflang for SEO.
- RTL: `dir` attribute on `<html>` flips flow automatically; needs a
  text-direction hook and fonts with the target scripts.

## 3. Dealenz's current position

- Settings shows language as display-only English; every UI string is
  hardcoded; no locale files, no switcher.
- Jurisdiction is first-class (country-keyed corpus, citations) but
  **language ≠ jurisdiction**: a French contract under Delaware law and
  an English contract under French law are both real.
- Clause library has preferred/fallback/walkaway variants but **no
  language dimension** — English-only approved language.
- AI layer takes prompts as strings: language control = instruction +
  content, per call. Verdicts stay rule-determined, so language affects
  prose only — consistent with doctrine (same split as model choice).
- Search indexes with the `english` text-search config; German compounds
  and French elisions will stem poorly until per-language configs land.
- Fonts (Mona Sans + Bodoni Moda) lack Arabic/CJK glyphs — Latin-script
  languages first, or budget a fallback stack.
