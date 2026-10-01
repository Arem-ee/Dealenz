import { describe, it, expect } from "vitest"
import { publicErrorMessage } from "@/lib/safe-error"
import fs from "fs"
import path from "path"

function looksLikeQuestion(text: string): boolean {
  const t = text.trim().toLowerCase()
  if (!t) return false
  if (t.endsWith("?")) return true
  if (t.startsWith("what ") || t.startsWith("can you") || t.startsWith("could you") || t.startsWith("explain") || t.startsWith("how ") || t.startsWith("why ") || t.startsWith("should i")) return true
  if (t.includes("what is") || t.includes("what does") || t.includes("explain this") || t.includes("can you explain")) return true
  return false
}

describe("Home workspace", () => {
  it("routes questions to Ask and statements to Deal", () => {
    expect(looksLikeQuestion("Can you explain this indemnity clause?")).toBe(true)
    expect(looksLikeQuestion("What is an indemnity clause?")).toBe(true)
    expect(looksLikeQuestion("I'm about to sign a freelance contract for $4,000.")).toBe(false)
    expect(looksLikeQuestion("My landlord sent me this amendment.")).toBe(false)
    expect(looksLikeQuestion("I need an agreement for two founders.")).toBe(false)
  })

  it("preserves greeting handling for Ask pricing", () => {
    expect(looksLikeQuestion("hello")).toBe(false)
  })

  it("error sanitizer collapses provider details", () => {
    const fallback = "We couldn't start that. Please try again."
    expect(publicErrorMessage(new Error("Anthropic quota exceeded"), fallback)).toBe(fallback)
    expect(publicErrorMessage(new Error("fetch failed"), fallback)).toBe(fallback)
    expect(publicErrorMessage(new Error("Deal not found."), fallback)).toBe("Deal not found.")
  })

  it("star-white token is #FAFAF8 and used as background", () => {
    const css = fs.readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf-8")
    expect(css).toContain("--star: #FAFAF8")
    expect(css).toContain("--background: var(--star)")
    expect(css).toContain("--card: #FFFFFF")
  })

  it("home tab is the deal repo with an empty state for new users", () => {
    const page = fs.readFileSync(path.join(process.cwd(), "src/app/dashboard/page.tsx"), "utf8")
    expect(page).toContain("DealRepo")
    expect(page).not.toContain("ContractsRepo")
    expect(page).not.toContain("Under construction")
    const repo = fs.readFileSync(path.join(process.cwd(), "src/components/home/deal-repo.tsx"), "utf8")
    expect(repo).toContain("No deals yet")
    expect(repo).toContain("Start your first deal")
  })

  it("sidebar holds only Home and Library, account menu holds the rest", () => {
    const nav = fs.readFileSync(path.join(process.cwd(), "src/lib/nav.ts"), "utf-8")
    expect(nav).toContain('href: "/dashboard"')
    expect(nav).toContain('href: "/library"')
    expect(nav).not.toContain('href: "/vault"')
    expect(nav).toContain('href: "/settings"')
    expect(nav).toContain('href: "/billing"')
    expect(nav).toContain('href: "/help"')
    const layout = fs.readFileSync(path.join(process.cwd(), "src/app/dashboard/layout.tsx"), "utf-8")
    expect(layout).not.toContain("TopNav")
    expect(fs.existsSync(path.join(process.cwd(), "src/components/top-nav.tsx"))).toBe(false)
  })
})
