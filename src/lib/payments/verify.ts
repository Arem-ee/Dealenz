// Payment provider webhook verification (Phase 3) — Stripe/Paystack style
// No secrets in code: reads from env STRIPE_WEBHOOK_SECRET / PAYSTACK_WEBHOOK_SECRET
// HMAC SHA256 verification, timing-safe compare, replay protection via provider_webhook_events unique.

import { createHmac, timingSafeEqual } from "node:crypto"

export function verifyStripeSignature(payload: string, signature: string, secret: string): boolean {
  if (!signature || !secret) return false
  // Stripe style: t=...,v1=...
  // For Phase 3 we support simple HMAC of payload: hex digest in header x-stripe-signature or stripe-signature
  try {
    const expected = createHmac("sha256", secret).update(payload, "utf8").digest("hex")
    const sig = signature.includes("v1=") ? signature.split("v1=")[1].split(",")[0] : signature
    if (sig.length !== expected.length) return false
    return timingSafeEqual(Buffer.from(sig, "utf8"), Buffer.from(expected, "utf8"))
  } catch {
    return false
  }
}

export function verifyPaystackSignature(payload: string, signature: string, secret: string): boolean {
  if (!signature || !secret) return false
  try {
    const expected = createHmac("sha512", secret).update(payload, "utf8").digest("hex")
    if (signature.length !== expected.length) return false
    return timingSafeEqual(Buffer.from(signature, "utf8"), Buffer.from(expected, "utf8"))
  } catch {
    return false
  }
}

export function parseProviderEventId(payload: Record<string, unknown>, provider: "stripe" | "paystack"): string | null {
  if (provider === "stripe") {
    return (payload.id as string) ?? (payload.event_id as string) ?? null
  }
  if (provider === "paystack") {
    return (payload.id as string) ?? (payload.event as string) ?? (payload.data as Record<string, unknown>)?.id as string ?? null
  }
  return null
}
