import { describe, it, expect, vi } from "vitest"
import { seedEnvelopeWithProfile } from "./profile"

function clientWith(profile: unknown) {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data: profile })),
        })),
      })),
    })),
  }
}

describe("seedEnvelopeWithProfile", () => {
  it("confirms jurisdiction and currency from the user's own profile", async () => {
    const envelope = await seedEnvelopeWithProfile(
      clientWith({ country: "Canada", default_currency: "usd" }),
      "u1",
      "freelance"
    )
    expect(envelope.fields.jurisdiction).toEqual({ value: "Canada", source: "user_confirmed", confidence: 1 })
    expect(envelope.fields.transactionCurrency).toEqual({ value: "USD", source: "user_confirmed", confidence: 1 })
    expect(envelope.fields.dealType.value).toBe("freelance")
  })

  it("falls back to the plain seed without a profile", async () => {
    const envelope = await seedEnvelopeWithProfile(clientWith(null), "u1", "generic")
    expect(envelope.fields.jurisdiction.source).toBe("unknown")
  })

  it("ignores profile values the schema rejects", async () => {
    const envelope = await seedEnvelopeWithProfile(
      clientWith({ country: "", default_currency: "not-a-currency!!!" }),
      "u1",
      "generic"
    )
    expect(envelope.fields.jurisdiction.source).toBe("unknown")
    expect(envelope.fields.transactionCurrency.source).toBe("unknown")
  })

  it("never throws when the profile query fails", async () => {
    const failing = { from: () => { throw new Error("db down") } }
    const envelope = await seedEnvelopeWithProfile(failing, "u1", "generic")
    expect(envelope.fields.dealType.value).toBe("generic")
  })
})
