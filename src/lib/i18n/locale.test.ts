import { describe, expect, it } from "vitest"
import { isLocale, isNonEnglishLocale, localeLabel, negotiateLocale, resolveLocale } from "./locale"

describe("resolveLocale", () => {
  it("prefers a valid cookie", () => {
    expect(resolveLocale("fr", "de")).toBe("fr")
  })

  it("falls to the profile override, then English", () => {
    expect(resolveLocale("xx", "de")).toBe("de")
    expect(resolveLocale(null, null)).toBe("en")
    expect(resolveLocale(undefined, "es")).toBe("en")
  })

  it("labels locales for the switcher", () => {
    expect(localeLabel("fr")).toBe("Français")
    expect(localeLabel("de")).toBe("Deutsch")
    expect(localeLabel("nl")).toBe("Nederlands")
    expect(localeLabel("en")).toBe("English")
    expect(isLocale("it")).toBe(false)
  })

  it("separates agreement/response locales from English", () => {
    expect(isNonEnglishLocale("nl")).toBe(true)
    expect(isNonEnglishLocale("en")).toBe(false)
    expect(negotiateLocale("nl-NL,nl;q=0.9")).toBe("nl")
  })

  it("negotiates first-visit locale from Accept-Language", () => {
    expect(negotiateLocale("fr-FR,fr;q=0.9,en;q=0.8")).toBe("fr")
    expect(negotiateLocale("de-AT, de;q=0.9")).toBe("de")
    expect(negotiateLocale("es-ES,es;q=0.9")).toBe("en")
    expect(negotiateLocale(null)).toBe("en")
    expect(negotiateLocale("")).toBe("en")
  })
})
