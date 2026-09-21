import { describe, it, expect } from "vitest"
import { redactText, redactMetadata } from "./redact"

describe("redactText", () => {
  it("masks API keys, secrets, and bearer tokens", () => {
    expect(redactText("key sk_live_abc123 happened")).toContain("[REDACTED_API_KEY]")
    expect(redactText("key sk_live_abc123 happened")).not.toContain("sk_live_abc123")
    expect(redactText("whsec_def456 bad")).toContain("[REDACTED_SECRET]")
    expect(redactText("nvapi-ghi789 bad")).toContain("[REDACTED_API_KEY]")
    expect(redactText("sk-ant-jkl0123456789 bad")).toContain("[REDACTED_API_KEY]")
    expect(redactText("key sk-or-v1-abc123def456 bad")).toContain("[REDACTED_API_KEY]")
    expect(redactText("key sk-or-v1-abc123def456 bad")).not.toContain("sk-or-v1-abc123def456")
    expect(redactText("paddle pdl_live_xyz789 bad")).toContain("[REDACTED_API_KEY]")
    expect(redactText("Authorization: Bearer tokengoeshere123")).toContain("Bearer [REDACTED]")
    expect(redactText("https://x.test/cb?key=secretvalue123")).toContain("key=[REDACTED]")
  })

  it("drops email local parts but keeps domains", () => {
    const out = redactText("User alice@example.com failed")
    expect(out).not.toContain("alice")
    expect(out).toContain("@example.com")
  })

  it("bounds length and never throws", () => {
    expect(redactText("x".repeat(5000)).length).toBeLessThanOrEqual(2100)
    expect(redactText(new Error("boom"))).toContain("boom")
    expect(redactText(null)).toBe("")
    expect(redactText(undefined)).toBe("")
    const circular: Record<string, unknown> = {}
    circular.self = circular
    expect(typeof redactText(circular)).toBe("string")
  })
})

describe("redactMetadata", () => {
  it("keeps scalars, drops objects, bounds keys", () => {
    const out = redactMetadata({
      surface: "authenticated",
      count: 3,
      ok: true,
      nested: { deal: "secret" } as never,
      secret: "sk_live_abc123",
    })
    expect(out.surface).toBe("authenticated")
    expect(out.count).toBe(3)
    expect(out.ok).toBe(true)
    expect(out.nested).toBeNull()
    expect(String(out.secret)).not.toContain("sk_live_abc123")
  })

  it("returns {} for non-records", () => {
    expect(redactMetadata(null)).toEqual({})
    expect(redactMetadata(undefined)).toEqual({})
  })
})
