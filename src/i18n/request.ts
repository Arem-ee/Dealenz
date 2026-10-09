import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";
import { LOCALE_COOKIE } from "@/lib/i18n/locale";

type Messages = Record<string, unknown>;

// English underneath, active locale on top: a missing key renders English
// (never empty), and the key-parity test fails the build on drift so the
// fallback stays a safety net, not a lifestyle.
function deepMerge(base: Messages, over: Messages): Messages {
  const out: Messages = { ...base };
  for (const [key, value] of Object.entries(over)) {
    const current = out[key];
    if (
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value) &&
      typeof current === "object" &&
      current !== null &&
      !Array.isArray(current)
    ) {
      out[key] = deepMerge(current as Messages, value as Messages);
    } else {
      out[key] = value;
    }
  }
  return out;
}

// Cookie-based locale, no URL routing (deliberation D2). The cookie is the
// request locale; Settings writes it on explicit choice, the proxy seeds it
// from Accept-Language on first visit, login reseeds it from the profile.
// Unknown values fall through to the default — never a 404, never empty.
export default getRequestConfig(async () => {
  const store = await cookies();
  const raw = store.get(LOCALE_COOKIE)?.value;
  const locale = hasLocale(routing.locales, raw) ? raw : routing.defaultLocale;
  const en = (await import(`../../messages/en.json`)).default as Messages;
  if (locale === routing.defaultLocale) return { locale, messages: en };
  const active = (await import(`../../messages/${locale}.json`)).default as Messages;
  return { locale, messages: deepMerge(en, active) };
});
