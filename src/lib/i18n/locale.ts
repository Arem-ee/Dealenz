// Locale resolution — pure cascade for the cookie-based locale (D2).
//
// Browser preference first, profile override second, English fallback.
// No URL routing: the app shell is authenticated and SEO-irrelevant, so
// the locale travels in the `dealenz-locale` cookie and never in paths.

export const LOCALES = ["en", "fr", "de", "nl"] as const

export type AppLocale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: AppLocale = "en"

export const LOCALE_COOKIE = "dealenz-locale"

export function isLocale(raw: unknown): raw is AppLocale {
  return raw === "en" || raw === "fr" || raw === "de" || raw === "nl"
}

/** Non-English shipped locales: agreement language, response language. */
export function isNonEnglishLocale(raw: unknown): raw is Exclude<AppLocale, "en"> {
  return raw === "fr" || raw === "de" || raw === "nl"
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
  if (locale === "fr") return "Français"
  if (locale === "de") return "Deutsch"
  if (locale === "nl") return "Nederlands"
  return "English"
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
