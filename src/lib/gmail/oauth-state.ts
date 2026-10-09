// Gmail OAuth state signing (CSRF protection for the OAuth round-trip).
//
// Server-only. The HMAC key is the dedicated GMAIL_OAUTH_STATE_SECRET and
// nothing else: no fallback to GOOGLE_CLIENT_SECRET, SUPABASE_SERVICE_ROLE_KEY,
// or a hardcoded dev key. A missing secret fails closed — callers must treat
// a throw here as "Gmail not configured" without logging or returning the
// secret itself.

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto"

const STATE_TTL_MS = 10 * 60 * 1000

export function gmailOAuthStateSecret(): string {
  const secret = process.env.GMAIL_OAUTH_STATE_SECRET
  if (!secret) {
    throw new Error("Gmail OAuth state secret is not configured (GMAIL_OAUTH_STATE_SECRET).")
  }
  return secret
}

export function signGmailOAuthState(userId: string, now: number = Date.now()): string {
  const payload = JSON.stringify({ userId, nonce: randomUUID(), ts: now })
  const sig = createHmac("sha256", gmailOAuthStateSecret()).update(payload).digest("base64url")
  return `${Buffer.from(payload, "utf8").toString("base64url")}.${sig}`
}

export type GmailStateVerification = { ok: true } | { ok: false; error: "Invalid state" | "State mismatch" | "State expired" | "State reused" }

export function verifyGmailOAuthState(state: string, userId: string, now: number = Date.now()): GmailStateVerification {
  let decoded: string
  let sig: string
  try {
    const raw = decodeURIComponent(state)
    const dot = raw.lastIndexOf(".")
    if (dot <= 0) return { ok: false, error: "Invalid state" }
    decoded = Buffer.from(raw.slice(0, dot), "base64url").toString("utf8")
    sig = raw.slice(dot + 1)
  } catch {
    return { ok: false, error: "Invalid state" }
  }
  let expected: string
  try {
    expected = createHmac("sha256", gmailOAuthStateSecret()).update(decoded).digest("base64url")
  } catch {
    // Secret missing at verify time: fail closed, same observable as tampering.
    return { ok: false, error: "Invalid state" }
  }
  if (sig.length !== expected.length) return { ok: false, error: "Invalid state" }
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return { ok: false, error: "Invalid state" }
  }
  let parsed: { userId?: unknown; ts?: unknown }
  try {
    parsed = JSON.parse(decoded) as { userId?: unknown; ts?: unknown }
  } catch {
    return { ok: false, error: "Invalid state" }
  }
  if (typeof parsed.userId !== "string" || parsed.userId !== userId) {
    return { ok: false, error: "State mismatch" }
  }
  if (typeof parsed.ts !== "number" || now - parsed.ts > STATE_TTL_MS) {
    return { ok: false, error: "State expired" }
  }
  return { ok: true }
}

export function extractGmailStateNonce(state: string): string | null {
  try {
    const raw = decodeURIComponent(state)
    const dot = raw.lastIndexOf(".")
    if (dot <= 0) return null
    const decoded = Buffer.from(raw.slice(0, dot), "base64url").toString("utf8")
    const parsed = JSON.parse(decoded) as { nonce?: unknown }
    return typeof parsed.nonce === "string" && parsed.nonce.length >= 8 ? parsed.nonce : null
  } catch {
    return null
  }
}

interface NonceStore {
  from(table: string): {
    insert(row: Record<string, unknown>): PromiseLike<{ error: { message: string; code?: string } | null }>
  }
}

/** Single-use enforcement: first presentation wins, replays fail closed. */
export async function consumeGmailOAuthNonce(
  store: NonceStore,
  state: string,
  userId: string
): Promise<{ ok: true } | { ok: false; error: "State reused" | "Invalid state" }> {
  const nonce = extractGmailStateNonce(state)
  if (!nonce) return { ok: false, error: "Invalid state" }
  const { error } = await store
    .from("gmail_oauth_nonces")
    .insert({ nonce, user_id: userId })
  if (error) {
    // Unique violation (23505) or any insert failure on the nonce table
    // means this state was already consumed — refuse the replay.
    return { ok: false, error: "State reused" }
  }
  return { ok: true }
}
