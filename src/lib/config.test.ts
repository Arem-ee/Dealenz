import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { supabasePublicConfig } from "./config"

const URL_KEY = "NEXT_PUBLIC_SUPABASE_URL"
const ANON_KEY = "NEXT_PUBLIC_SUPABASE_ANON_KEY"

describe("supabasePublicConfig", () => {
  const saved: Record<string, string | undefined> = {}

  beforeEach(() => {
    saved[URL_KEY] = process.env[URL_KEY]
    saved[ANON_KEY] = process.env[ANON_KEY]
    process.env[URL_KEY] = "https://example.supabase.co"
    process.env[ANON_KEY] = "ci-dummy-anon-key"
  })

  afterEach(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })

  it("returns trimmed values when present and well-formed", () => {
    process.env[URL_KEY] = "  https://example.supabase.co  "
    expect(supabasePublicConfig()).toEqual({
      url: "https://example.supabase.co",
      anonKey: "ci-dummy-anon-key",
    })
  })

  it("fails clearly when the URL is missing", () => {
    delete process.env[URL_KEY]
    expect(() => supabasePublicConfig()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/)
  })

  it("fails clearly when the key is missing, without leaking anything", () => {
    delete process.env[ANON_KEY]
    let message = ""
    try {
      supabasePublicConfig()
    } catch (err) {
      message = err instanceof Error ? err.message : ""
    }
    expect(message).toMatch(/NEXT_PUBLIC_SUPABASE_ANON_KEY/)
    expect(message).not.toContain("ci-dummy")
  })

  it("rejects non-URL and placeholder values without echoing them", () => {
    for (const bad of ["not-a-url", "your-supabase-project-url", "ftp://files.example.com/x"]) {
      process.env[URL_KEY] = bad
      let message = ""
      try {
        supabasePublicConfig()
      } catch (err) {
        message = err instanceof Error ? err.message : ""
      }
      expect(message.length).toBeGreaterThan(0)
      expect(message).not.toContain(bad)
    }
  })

  it("accepts localhost for local development", () => {
    process.env[URL_KEY] = "http://localhost:54321"
    expect(supabasePublicConfig().url).toBe("http://localhost:54321")
  })
})
