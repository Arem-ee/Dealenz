// Payment provider webhook verification (Phase 3) — Stripe/Paystack style
// No secrets in code: reads from env STRIPE_WEBHOOK_SECRET / PAYSTACK_WEBHOOK_SECRET
// Stripe: real timestamped scheme (t=...,v1=HMAC(`${t}.${payload}`), 300s
// tolerance) — plain raw-body HMAC is NOT Stripe and is rejected, otherwise
// genuine Stripe events fail closed and forged simple-HMAC events pass.
// Paystack: HMAC-SHA512 hex of the raw body. Replay protection via
// provider_webhook_events unique.

import { createHmac, timingSafeEqual } from "node:crypto"

export const WEBHOOK_TIMESTAMP_TOLERANCE_S = 300

export function verifyStripeSignature(payload: string, signature: string, secret: string, nowS: number = Math.floor(Date.now() / 1000)): boolean {
  if (!signature || !secret) return false
  try {
    let ts: string | null = null
    const v1s: string[] = []
    for (const part of signature.split(",")) {
      const eq = part.indexOf("=")
      if (eq < 0) continue
      const k = part.slice(0, eq).trim()
      const v = part.slice(eq + 1).trim()
      if (k === "t" && ts === null) ts = v
      else if (k === "v1" && v) v1s.push(v)
    }
    if (!ts || v1s.length === 0) return false
    const t = Number(ts)
    if (!Number.isFinite(t) || Math.abs(nowS - t) > WEBHOOK_TIMESTAMP_TOLERANCE_S) return false
    const expected = createHmac("sha256", secret).update(`${ts}.${payload}`, "utf8").digest("hex")
    return v1s.some((sig) => {
      if (sig.length !== expected.length) return false
      try {
        return timingSafeEqual(Buffer.from(sig, "utf8"), Buffer.from(expected, "utf8"))
      } catch {
        return false
      }
    })
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
