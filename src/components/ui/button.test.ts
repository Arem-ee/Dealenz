import { describe, it, expect } from "vitest"
import { buttonVariants } from "./button"

describe("button restraint (burgundy is emphasis, never default)", () => {
  it("renders the default action in ink, not burgundy", () => {
    const classes = buttonVariants({ variant: "default" })
    expect(classes).toContain("bg-primary")
    expect(classes).not.toContain("burgundy")
  })

  it("keeps an explicit burgundy variant for intentional emphasis", () => {
    expect(buttonVariants({ variant: "burgundy" })).toContain("bg-burgundy")
  })

  it("never defaults destructive or link actions to burgundy", () => {
    expect(buttonVariants({ variant: "destructive" })).not.toContain("burgundy")
    expect(buttonVariants({ variant: "link" })).not.toContain("burgundy")
  })
})
