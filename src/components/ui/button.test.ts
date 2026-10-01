import { describe, it, expect } from "vitest"
import { buttonVariants } from "./button"

// Color-stack rule: buttons render ink, paper, muted, or the destructive
// token only. Destructive resolves red through the token (never a literal
// hue class); severity otherwise travels in labels and icons, never hue.
const CHROMATIC = ["burgundy", "red-", "amber-", "emerald-", "blue-", "green-", "purple-", "orange-", "brick-", "pine-"]

describe("button monochrome restraint", () => {
  it("renders the default action in ink", () => {
    const classes = buttonVariants({ variant: "default" })
    expect(classes).toContain("bg-primary")
  })

  it("renders destructive through the destructive token (red by system)", () => {
    const classes = buttonVariants({ variant: "destructive" })
    expect(classes).toContain("bg-destructive")
    for (const hue of CHROMATIC) expect(classes).not.toContain(hue)
  })

  it("offers no burgundy variant", () => {
    const classes = buttonVariants({})
    expect(classes).not.toContain("burgundy")
  })

  it("never defaults link actions to a filled surface", () => {
    const classes = buttonVariants({ variant: "link" })
    expect(classes).not.toContain("bg-primary")
    expect(classes).not.toContain("bg-destructive")
  })
})
