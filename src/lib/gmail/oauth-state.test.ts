import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
  gmailOAuthStateSecret,
  signGmailOAuthState,
  verifyGmailOAuthState,
} from "./oauth-state"

// P0-2: Gmail OAuth state must be keyed ONLY by the dedicated
// GMAIL_OAUTH_STATE_SECRET and fail closed when it is absent.
describe("gmail oauth state (P0-2)", () => {
  beforeEach(() => {
    vi.stubEnv("GMAIL_OAUTH_STATE_SECRET", "test-state-secret-sentinel")
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("round-trips a valid state for the same user", () => {
    const state = signGmailOAuthState("user-1")
    expect(verifyGmailOAuthState(state, "user-1")).toEqual({ ok: true })
  })

  it("rejects tampered payloads", () => {
    const state = signGmailOAuthState("user-1")
    const raw = decodeURIComponent(state)
    const dot = raw.lastIndexOf(".")
    const forged = Buffer.from(JSON.stringify({ userId: "user-2", nonce: "x", ts: Date.now() }), "utf8").toString("base64url")
    const tampered = encodeURIComponent(`${forged}.${raw.slice(dot + 1)}`)
    expect(verifyGmailOAuthState(tampered, "user-2")).toEqual({ ok: false, error: "Invalid state" })
  })

  it("rejects states bound to a different user", () => {
    const state = signGmailOAuthState("user-1")
    expect(verifyGmailOAuthState(state, "user-2")).toEqual({ ok: false, error: "State mismatch" })
  })

  it("rejects expired states", () => {
    const old = signGmailOAuthState("user-1", Date.now() - 11 * 60 * 1000)
    expect(verifyGmailOAuthState(old, "user-1")).toEqual({ ok: false, error: "State expired" })
  })

  it("fails closed when the dedicated secret is absent", () => {
    vi.stubEnv("GMAIL_OAUTH_STATE_SECRET", "")
    expect(() => gmailOAuthStateSecret()).toThrow(/GMAIL_OAUTH_STATE_SECRET/)
    expect(() => signGmailOAuthState("user-1")).toThrow(/GMAIL_OAUTH_STATE_SECRET/)
    // Verify path must not throw and must not accept anything.
    const state = "anything.sig"
    expect(verifyGmailOAuthState(state, "user-1")).toEqual({ ok: false, error: "Invalid state" })
  })

  it("never falls back to other secrets or a dev key", () => {
    vi.stubEnv("GMAIL_OAUTH_STATE_SECRET", "")
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "oauth-client-secret")
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key")
    expect(() => signGmailOAuthState("user-1")).toThrow(/GMAIL_OAUTH_STATE_SECRET/)
  })
})

describe("gmail oauth routes use the dedicated secret (P0-2 static)", () => {
  const auth = readFileSync(join(process.cwd(), "src", "app", "api", "gmail", "auth", "route.ts"), "utf8")
  const callback = readFileSync(join(process.cwd(), "src", "app", "api", "gmail", "callback", "route.ts"), "utf8")

  it("routes sign/verify through the shared helper", () => {
    expect(auth).toMatch(/signGmailOAuthState/)
    expect(callback).toMatch(/verifyGmailOAuthState/)
  })

  it("routes contain no fallback key material for state", () => {
    for (const src of [auth, callback]) {
      expect(src).not.toMatch(/dev-state-key/)
      expect(src).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY \?\?/)
      expect(src).not.toMatch(/GOOGLE_CLIENT_SECRET \?\?/)
    }
  })
})
