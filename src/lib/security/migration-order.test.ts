import { describe, it, expect } from "vitest"
import { readdirSync } from "node:fs"
import { join } from "node:path"

// Migration presence/order guard: the full forward chain through the
// execution-lockdown head must exist exactly once each, in order, plus the
// three known remediation drafts. Catches accidental renames, gaps, or
// duplicated sequence numbers without touching migration contents.
describe("migration chain presence and order", () => {
  it("contains 00001 through 00048 exactly once, in order", () => {
    const files = readdirSync(join(process.cwd(), "supabase", "migrations"))
    const numbered = files
      .map((f) => /^(\d{5})_.*\.sql$/.exec(f)?.[1])
      .filter((n): n is string => n !== undefined)
      .sort()
    const expected = Array.from({ length: 48 }, (_, i) => String(i + 1).padStart(5, "0"))
    expect(numbered).toEqual(expected)
  })

  it("retains the known remediation drafts alongside the chain", () => {
    const files = readdirSync(join(process.cwd(), "supabase", "migrations"))
    for (const draft of [
      "20260903000001_storage_rls_remediation.sql",
      "20260903000002_lawyer_policy_remediation.sql",
      "20260903000003_increment_usage_null_guard.sql",
    ]) {
      expect(files).toContain(draft)
    }
  })
})
