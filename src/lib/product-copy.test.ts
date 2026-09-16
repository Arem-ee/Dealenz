import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"

// User-visible surfaces must never frame the product around a specific AI
// provider. Internal provider code (src/lib/ai/*), tests, migrations, and
// architecture docs are intentionally out of scope here.
const USER_FACING_FILES = [
  "src/components/audit/workspace-client.tsx",
  "src/components/ask/ask-client.tsx",
  "src/components/sign/invitee-sign-view.tsx",
  "src/components/portal-view.tsx",
  "src/app/billing/page.tsx",
  "src/app/dashboard/page.tsx",
  "src/app/deals/page.tsx",
  "src/components/landing/landing-faq.tsx",
]

const BANNED = [
  "Gemini",
  "gemini",
  "Google Gemini",
  "powered by Gemini",
  "Anthropic",
  "Claude",
  "OpenAI",
  "GPT-",
]

describe("user-facing copy never names AI providers", () => {
  for (const file of USER_FACING_FILES) {
    it(`${file} contains no provider framing`, () => {
      const source = readFileSync(join(process.cwd(), file), "utf8")
      for (const banned of BANNED) {
        expect(source).not.toContain(banned)
      }
    })
  }

  it("consent copy frames processing as Dealenz AI, not a provider", () => {
    const sources = [
      readFileSync(join(process.cwd(), "src/components/audit/workspace-client.tsx"), "utf8"),
      readFileSync(join(process.cwd(), "src/components/ai-consent-modal.tsx"), "utf8"),
    ].join("\n")
    expect(sources).toContain("Dealenz AI")
  })
})
