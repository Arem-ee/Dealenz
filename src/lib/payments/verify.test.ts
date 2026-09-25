import { describe, it, expect } from "vitest"
import { verifyStripeSignature, verifyPaystackSignature } from "./verify"
import { createHmac } from "node:crypto"

describe("payment webhook verification", () => {
  function stripeSig(payload: string, secret: string, ts: number): string {
    const h1 = createHmac("sha256", secret).update(`${ts}.${payload}`, "utf8").digest("hex")
    return `t=${ts},v1=${h1}`
  }

  it("verifies a genuine timestamped stripe signature", () => {
    const secret = "whsec_test123"
    const payload = JSON.stringify({ id: "evt_123", type: "payment_intent.succeeded" })
    const nowS = Math.floor(Date.now() / 1000)
    expect(verifyStripeSignature(payload, stripeSig(payload, secret, nowS), secret, nowS)).toBe(true)
    expect(verifyStripeSignature(payload, "bad", secret, nowS)).toBe(false)
  })

  it("rejects raw-body HMAC and stale timestamps, which are not Stripe", () => {
    const secret = "whsec_test123"
    const payload = JSON.stringify({ id: "evt_123" })
    const rawHmac = createHmac("sha256", secret).update(payload).digest("hex")
    const nowS = Math.floor(Date.now() / 1000)
    // Previously accepted: a forger replaying a plain body HMAC.
    expect(verifyStripeSignature(payload, rawHmac, secret, nowS)).toBe(false)
    expect(verifyStripeSignature(payload, `t=${nowS},v1=${rawHmac}`, secret, nowS)).toBe(false)
    // Genuine signature, replayed 10 minutes later.
    expect(verifyStripeSignature(payload, stripeSig(payload, secret, nowS - 600), secret, nowS)).toBe(false)
    // Malformed headers.
    expect(verifyStripeSignature(payload, "t=abc,v1=deadbeef", secret, nowS)).toBe(false)
    expect(verifyStripeSignature(payload, "v1=deadbeef", secret, nowS)).toBe(false)
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
