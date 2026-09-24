import { describe, it, expect } from "vitest"
import { assembleBrief } from "./brief"
import type { ConfirmedSubject } from "./types"

const SUBJECT: ConfirmedSubject = {
  name: "Acme Ltd",
  country: "United Kingdom",
  region: null,
  url: "https://find-and-update.company-information.service.gov.uk/company/12345678",
  domain: "acme.example",
  regNumber: "12345678",
}

const PAGE = `
Acme Ltd overview. Company number 12345678. Company status active.
Incorporated on 12 March 2019. Registered office in London.
Contact via acme.example for enquiries.
`

describe("assembleBrief", () => {
  it("extracts quoted Tier-1 claims from a registry page", async () => {
    const fetcher = { fetch: async () => ({ url: SUBJECT.url!, status: 200, text: PAGE }) }
    const brief = await assembleBrief(SUBJECT, "Companies House", fetcher, new Date("2026-09-24T10:00:00Z"))
    expect(brief.liveVerified).toBe(true)
    expect(brief.claims[0].tier).toBe("user")
    expect(brief.claims[0].statement).toContain("Unverified")
    const tier1 = brief.claims.filter((c) => c.tier === 1)
    expect(tier1.length).toBeGreaterThanOrEqual(3)
    expect(tier1.some((c) => c.statement.includes('"active"'))).toBe(true)
    expect(tier1.some((c) => c.statement.includes("12 March 2019"))).toBe(true)
    expect(tier1.some((c) => c.statement.includes("12345678"))).toBe(true)
    expect(tier1.every((c) => c.quote.length > 0 && c.sourceUrl === SUBJECT.url)).toBe(true)
    // Scope discipline travels with every brief.
    expect(brief.unknowns.some((u) => /adverse-media/i.test(u))).toBe(true)
  })

  it("reports negative status signals when present", async () => {
    const fetcher = { fetch: async () => ({ url: SUBJECT.url!, status: 200, text: "Acme Ltd. Company status dissolved on 1 June 2024." }) }
    const brief = await assembleBrief(SUBJECT, "Companies House", fetcher)
    expect(brief.liveVerified).toBe(true)
    expect(brief.claims.some((c) => c.statement.includes('"dissolved"'))).toBe(true)
  })

  it("records fetch failure as an unknown, never as a finding", async () => {
    const fetcher = { fetch: async () => ({ url: SUBJECT.url!, status: 404, text: "" }) }
    const brief = await assembleBrief(SUBJECT, "Companies House", fetcher)
    expect(brief.liveVerified).toBe(false)
    expect(brief.unknowns.some((u) => /could not be retrieved/i.test(u))).toBe(true)
    expect(brief.claims.every((c) => c.tier === "user")).toBe(true)
  })

  it("is explicit when live lookup never ran", async () => {
    const brief = await assembleBrief({ ...SUBJECT, url: null }, null, null)
    expect(brief.liveVerified).toBe(false)
    expect(brief.unknowns.some((u) => /not performed/i.test(u))).toBe(true)
  })

  it("surfaces official enforcement mentions as quoted leads, never verdicts", async () => {
    const fetcher = { fetch: async (url: string) => ({ url, status: 200, text: PAGE }) }
    const searcher = {
      search: async () => ["https://www.sec.gov/litigation/litreleases/example"],
    }
    const leadFetcher = {
      fetch: async (url: string) =>
        url.includes("litigation")
          ? { url, status: 200, text: "Litigation Release: proceedings involving Acme Ltd over reporting failures." }
          : fetcher.fetch(url),
    }
    const brief = await assembleBrief({ subject: SUBJECT, sourceName: "Companies House", fetcher: leadFetcher, searcher })
    const lead = brief.claims.find((c) => c.statement.includes("enforcement-adjacent"))
    expect(lead).toBeDefined()
    expect(lead!.tier).toBe(1)
    expect(lead!.quote).toContain("Acme Ltd")
    expect(lead!.statement).toContain("a mention is not a finding")
  })

  it("records empty enforcement searches as unknowns", async () => {
    const fetcher = { fetch: async () => ({ url: SUBJECT.url!, status: 200, text: PAGE }) }
    const searcher = { search: async () => [] as string[] }
    const brief = await assembleBrief({ subject: SUBJECT, sourceName: "Companies House", fetcher, searcher })
    expect(brief.unknowns.some((u) => /no enforcement-adjacent mentions/i.test(u))).toBe(true)
  })
})
