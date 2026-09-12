import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

// Production-safety guardrails from the Auth-email bounce investigation:
// automated tests must never generate live Auth email traffic, and the
// password-reset path must stay re-click safe.
function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules") continue
      walk(full, out)
    } else if (/\.test\.(ts|tsx)$/.test(entry)) {
      out.push(full)
    }
  }
  return out
}

const testFiles = walk(join(process.cwd(), "src"))

describe("auth-email test hygiene", () => {
  it("no automated test performs a live Auth send", () => {
    const offenders: string[] = []
    for (const file of testFiles) {
      const source = readFileSync(file, "utf8")
      if (/\.signUp\(|\.signInWithOtp\(|\.resetPasswordForEmail\(|auth\/v1\//.test(source)) {
        offenders.push(file)
      }
    }
    expect(offenders).toEqual([])
  })

  it("no test fixture points at a live Supabase project", () => {
    const offenders: string[] = []
    for (const file of testFiles) {
      const source = readFileSync(file, "utf8")
      const hits = source.match(/[a-z0-9-]+\.supabase\.co/g) ?? []
      if (hits.some((h) => !h.startsWith("example."))) offenders.push(`${file}: ${hits.join(",")}`)
    }
    expect(offenders).toEqual([])
  })

  it("repo scripts never send Auth email", () => {
    const offenders: string[] = []
    for (const entry of readdirSync(join(process.cwd(), "scripts"))) {
      if (!entry.endsWith(".mjs")) continue
      const source = readFileSync(join(process.cwd(), "scripts", entry), "utf8")
      if (/\.signUp\(|\.signInWithOtp\(|\.resetPasswordForEmail\(|auth\/v1\//.test(source)) {
        offenders.push(entry)
      }
    }
    expect(offenders).toEqual([])
  })

  it("password reset stays re-click safe (resend cooldown wired)", () => {
    const source = readFileSync(join(process.cwd(), "src/app/login/page.tsx"), "utf8")
    expect(source).toContain("RESET_RESEND_COOLDOWN_MS")
    expect(source).toMatch(/disabled=\{resetCooldown\}/)
    expect(source).toContain("setTimeout(() => setResetCooldown(false), RESET_RESEND_COOLDOWN_MS)")
  })
})
