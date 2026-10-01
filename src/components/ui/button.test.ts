import { describe, it, expect } from "vitest"
import { buttonVariants } from "./button"

// Monochrome rule: buttons render ink, paper, or muted surfaces only.
// Severity and brand color never appear in button chrome; meaning travels
// in labels and icons, never hue.
const CHROMATIC = ["burgundy", "red-", "amber-", "emerald-", "blue-", "green-", "purple-", "orange-"]

describe("button monochrome restraint", () => {
  it("renders the default action in ink", () => {
    const classes = buttonVariants({ variant: "default" })
    expect(classes).toContain("bg-primary")
  })

  it("keeps destructive actions chromatic-free (ink, not red)", () => {
    const classes = buttonVariants({ variant: "destructive" })
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
