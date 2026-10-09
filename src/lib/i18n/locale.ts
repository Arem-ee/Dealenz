// Locale resolution — pure cascade for the cookie-based locale (D2).
//
// Browser preference first, profile override second, English fallback.
// No URL routing: the app shell is authenticated and SEO-irrelevant, so
// the locale travels in the `dealenz-locale` cookie and never in paths.

export const LOCALES = ["en", "fr", "de", "nl"] as const

export type AppLocale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: AppLocale = "en"

export const LOCALE_COOKIE = "dealenz-locale"

/**
 * Single locale metadata table: label, Postgres text-search config, and
 * AI response-language name. Every consumer reads from here — adding a
 * language extends this table (plus its message catalog and SQL CHECKs,
 * which cannot import TypeScript by nature).
 */
export const LOCALE_META: Record<
  AppLocale,
  { label: string; searchConfig: string; aiName: string }
> = {
  en: { label: "English", searchConfig: "english", aiName: "English" },
  fr: { label: "Français", searchConfig: "french", aiName: "French" },
  de: { label: "Deutsch", searchConfig: "german", aiName: "German" },
  nl: { label: "Nederlands", searchConfig: "dutch", aiName: "Dutch" },
}

export function isLocale(raw: unknown): raw is AppLocale {
  return (LOCALES as readonly string[]).includes(typeof raw === "string" ? raw : "")
}

/** Non-English shipped locales: agreement language, response language. */
export function isNonEnglishLocale(raw: unknown): raw is Exclude<AppLocale, "en"> {
  return isLocale(raw) && raw !== DEFAULT_LOCALE
}

/**
 * Resolve the request locale: valid cookie wins, then the stored profile
 * override, then English. Unknown values fall through silently — the UI
 * never breaks on a bad cookie, it just reads English.
 */
export function resolveLocale(cookieValue: unknown, profileValue: unknown): AppLocale {
  if (isLocale(cookieValue)) return cookieValue
  if (isLocale(profileValue)) return profileValue
  return DEFAULT_LOCALE
}

export function localeLabel(locale: AppLocale): string {
  return LOCALE_META[locale].label
}

/**
 * First-visit negotiation from Accept-Language: primary subtag match
 * against shipped locales, else English. Pure so the proxy stays thin.
 */
export function negotiateLocale(acceptLanguage: string | null): AppLocale {
  if (!acceptLanguage) return DEFAULT_LOCALE
  const first = acceptLanguage.split(",")[0]?.trim().toLowerCase() ?? ""
  const primary = first.split("-")[0]?.split(";")[0]?.trim() ?? ""
  if (isLocale(primary)) return primary
  return DEFAULT_LOCALE
}
