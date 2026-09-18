import { describe, it, expect } from "vitest"
import { verifyStripeSignature, verifyPaystackSignature } from "./verify"
import { createHmac } from "node:crypto"

describe("payment webhook verification", () => {
  it("verifies stripe signature timing-safe", () => {
    const secret = "whsec_test123"
    const payload = JSON.stringify({ id: "evt_123", type: "payment_intent.succeeded" })
    const sig = createHmac("sha256", secret).update(payload).digest("hex")
    expect(verifyStripeSignature(payload, sig, secret)).toBe(true)
    expect(verifyStripeSignature(payload, "bad", secret)).toBe(false)
  })
  it("verifies paystack signature", () => {
    const secret = "sk_test_paystack"
    const payload = JSON.stringify({ event: "charge.success", data: { reference: "ref_123" } })
    const sig = createHmac("sha512", secret).update(payload).digest("hex")
    expect(verifyPaystackSignature(payload, sig, secret)).toBe(true)
    expect(verifyPaystackSignature(payload, "bad", secret)).toBe(false)
  })
  it("rejects empty signature", () => {
    expect(verifyStripeSignature("{}", "", "secret")).toBe(false)
    expect(verifyPaystackSignature("{}", "", "secret")).toBe(false)
  })
  it("does not accept without provider confirmation", () => {
    // Genuine issue fix: no payment succeeds without verified signature
    expect(verifyStripeSignature("{}", null as never, "secret")).toBe(false)
  })
})
