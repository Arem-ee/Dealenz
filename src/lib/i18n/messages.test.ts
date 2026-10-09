import { describe, expect, it } from "vitest"
import en from "../../../messages/en.json"
import fr from "../../../messages/fr.json"
import de from "../../../messages/de.json"
import nl from "../../../messages/nl.json"

// Key parity: a missing key renders EMPTY in next-intl by default, so a
// locale that drifts from English shows holes, not English. This guard
// fails the build on drift; the provider's English fallback is the second
// line of defense, never the first.
function keys(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix]
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
    keys(v, prefix ? `${prefix}.${k}` : k)
  )
}

describe("message catalog parity", () => {
  const enKeys = keys(en).sort()
  it("fr mirrors en keys exactly", () => {
    expect(keys(fr).sort()).toEqual(enKeys)
  })
  it("de mirrors en keys exactly", () => {
    expect(keys(de).sort()).toEqual(enKeys)
  })
  it("nl mirrors en keys exactly", () => {
    expect(keys(nl).sort()).toEqual(enKeys)
  })
  it("has no empty strings (empty renders as nothing)", () => {
    for (const catalog of [en, fr, de, nl]) {
      const walk = (v: unknown): void => {
        if (typeof v === "string") {
          expect(v.trim().length).toBeGreaterThan(0)
          return
        }
        if (typeof v === "object" && v !== null) Object.values(v).forEach(walk)
      }
      walk(catalog)
    }
  })
})
