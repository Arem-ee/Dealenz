import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"

// User-visible surfaces must never frame the product around a specific AI
// provider. Internal provider code (src/lib/ai/*), tests, migrations, and
// architecture docs are intentionally out of scope here.
const USER_FACING_FILES = [
  "src/app/page.tsx",
  "src/app/login/page.tsx",
  "src/app/register/page.tsx",
  "src/app/pricing/page.tsx",
  "src/app/help/page.tsx",
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

  // Consent copy was wiped with the consent modal in the rebuild; the
  // assertion returns when user-facing consent copy returns.
})
