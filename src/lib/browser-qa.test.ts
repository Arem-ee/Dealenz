import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"

// Browser QA regressions: invalid links must render designed states (never
// the raw framework 404), and marketing must not sell what does not exist.
describe("invalid-link surfaces", () => {
  it("signing links degrade to a designed ceremony, not a framework 404", () => {
    const source = readFileSync(join(process.cwd(), "src/app/sign/not-found.tsx"), "utf8")
    expect(source).toContain("This signing link is no longer valid.")
    expect(source).toContain("expired, been revoked, or does not exist")
  })

  it("unknown routes degrade to a branded page with a next action", () => {
    const source = readFileSync(join(process.cwd(), "src/app/not-found.tsx"), "utf8")
    expect(source).toContain("Go to your home")
    expect(source).toContain('href="/dashboard"')
  })
})

describe("landing pricing honesty", () => {
  const source = readFileSync(
    join(process.cwd(), "src/components/landing/landing-pricing.tsx"),
    "utf8"
  )

  it("contains no price placeholders", () => {
    expect(source).not.toContain("$[")
    expect(source).not.toContain("price]")
  })

  it("links only to routes that exist", () => {
    expect(source).not.toContain('"/contact"')
    expect(source).toContain('"/register"')
  })

  it("does not sell a subscription tier or a higher limit that does not exist", () => {
    expect(source).not.toMatch(/Higher daily analysis limit/)
    expect(source).not.toMatch(/Everything in Free, plus/)
    expect(source).not.toMatch(/For active professionals/)
  })
})

describe("auth error visibility", () => {  for (const file of ["src/app/login/page.tsx", "src/app/register/page.tsx"]) {
    it(`${file} always renders its auth error state`, () => {
      const source = readFileSync(join(process.cwd(), file), "utf8")
      expect(source).toMatch(/\{error && \(/)
      expect(source).toContain('role="alert"')
    })
  }

  it("login never uses a native alert for password reset", () => {
    const source = readFileSync(join(process.cwd(), "src/app/login/page.tsx"), "utf8")
    expect(source).not.toContain("alert(")
    expect(source).toContain('role="status"')
  })
})

describe("anonymous widget honesty", () => {
  const file = "src/components/landing/landing-mini-dashboard.tsx"
  const source = readFileSync(join(process.cwd(), file), "utf8")

  it("renders its error state instead of swallowing failures", () => {
    expect(source).toMatch(/\{error &&/)
    expect(source).toContain('role="alert"')
  })

  it("sanitizes failures through the shared boundary, never raw text", () => {
    expect(source).toContain("publicErrorMessage(err,")
    expect(source).not.toMatch(/setError\(err instanceof Error \? err\.message/)
  })

  it("rejects non-JSON responses before parsing", () => {
    expect(source).toContain("application/json")
  })

  it("names its icon-only submit for assistive tech", () => {
    expect(source).toContain('aria-label={loading ? "Analyzing your deal" : "Analyze deal"}')
  })
})
