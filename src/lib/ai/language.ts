// Response language for AI prose (i18n D4).
//
// Language affects prose only — never verdicts, rules, ladders, or prices
// (same split as model choice). Findings keep citing the English rule;
// the model renders the explanation in the requested language. When in
// doubt the model qualifies rather than inventing legal language.

import { isNonEnglishLocale, LOCALE_META, type AppLocale } from "@/lib/i18n/locale"

export function responseLanguageName(locale: AppLocale): string {
  return LOCALE_META[locale].aiName
}

/**
 * Appends a response-language instruction to a system prompt. Empty for
 * English (no tokens spent stating the default). Unknown locales fall
 * back to English rather than instructing in garbage.
 */
export function responseLanguageInstruction(locale: unknown): string {
  if (!isNonEnglishLocale(locale)) return ""
  const name = responseLanguageName(locale)
  return (
    `\n\nWrite your entire response in ${name}. Finding summaries, rule ` +
    `keys, clause titles, and quoted evidence stay in their original English; ` +
    `explain everything else in ${name}. If a legal term has no safe ${name} ` +
    `equivalent, keep the English term and say so plainly.`
  )
}
