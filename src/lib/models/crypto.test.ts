import { afterEach, describe, expect, it, vi } from "vitest"
import { decryptSecret, encryptSecret, keyShapeFor, validateKeyShape } from "./crypto"

const KEY64 = "a".repeat(64)

describe("model key crypto", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("round-trips secrets and fails closed on tampering", () => {
    vi.stubEnv("MODEL_KEYS_ENCRYPTION_KEY", KEY64)
    const env = encryptSecret("sk-ant-secret-123")
    expect(decryptSecret(env)).toBe("sk-ant-secret-123")
    expect(env).not.toContain("sk-ant-secret-123")

    const tampered = `${env.slice(0, -4)}AAAA`
    expect(() => decryptSecret(tampered)).toThrow(/unreadable/)
  })

  it("fails closed without a configured master key", () => {
    vi.stubEnv("MODEL_KEYS_ENCRYPTION_KEY", "")
    expect(() => encryptSecret("x")).toThrow(/not configured/)
    expect(() => decryptSecret("eA==")).toThrow(/not configured/)
  })

  it("fails closed on a short master key", () => {
    vi.stubEnv("MODEL_KEYS_ENCRYPTION_KEY", "abc123")
    expect(() => encryptSecret("x")).toThrow(/not configured/)
  })

  it("validates key shapes per provider", () => {
    expect(validateKeyShape("anthropic", "sk-ant-12345678901234567")).toBeNull()
    expect(validateKeyShape("anthropic", "sk-123")).not.toBeNull()
    expect(validateKeyShape("gemini", "AIza12345678901234567")).toBeNull()
    expect(validateKeyShape("openai_compatible", "sk-12345678901234567")).toBeNull()
    expect(validateKeyShape("unknown", "sk-123")).not.toBeNull()
    expect(keyShapeFor("nope")).toBeNull()
  })
})
