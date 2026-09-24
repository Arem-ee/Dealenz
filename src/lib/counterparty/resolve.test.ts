import { describe, it, expect } from "vitest"
import { resolveCandidates, candidateLabel } from "./resolve"

describe("resolveCandidates", () => {
  it("returns a details-only candidate with no search available", async () => {
    const out = await resolveCandidates({ name: "Acme Ltd", country: "Nigeria" }, null)
    expect(out).toHaveLength(1)
    expect(out[0].detailsOnly).toBe(true)
    expect(out[0].url).toBeNull()
    expect(out[0].label).toContain("Acme Ltd")
  })

  it("builds a Companies House fast-path candidate from a registration number", async () => {
    const out = await resolveCandidates({ name: "Acme Ltd", country: "United Kingdom", regNumber: "12345678" }, null)
    expect(out).toHaveLength(2)
    expect(out[0].url).toBe("https://find-and-update.company-information.service.gov.uk/company/12345678")
    expect(out[0].source).toBe("Companies House")
    expect(out[0].detailsOnly).toBe(false)
    expect(out[1].detailsOnly).toBe(true)
  })

  it("turns search hits into candidates ahead of the details fallback", async () => {
    const searcher = { search: async () => ["https://find-and-update.company-information.service.gov.uk/company/99999999", "https://example.com/other"] }
    const out = await resolveCandidates({ name: "Acme Ltd", country: "United Kingdom" }, searcher)
    expect(out).toHaveLength(3)
    expect(out[0].url).toContain("company/99999999")
    expect(out[2].detailsOnly).toBe(true)
  })

  it("survives search failure with the details fallback intact", async () => {
    const searcher = { search: async () => { throw new Error("down") } }
    const out = await resolveCandidates({ name: "Acme Ltd", country: "Nigeria" }, searcher)
    expect(out).toHaveLength(1)
    expect(out[0].detailsOnly).toBe(true)
  })

  it("rejects empty names and unsupported jurisdictions", async () => {
    await expect(resolveCandidates({ name: " ", country: "Nigeria" }, null)).rejects.toThrow()
    await expect(resolveCandidates({ name: "Acme", country: "Atlantis" as never }, null)).rejects.toThrow()
  })

  it("labels candidates from URL hosts", () => {
    expect(candidateLabel("https://find-and-update.company-information.service.gov.uk/company/12345678")).toContain("company-information.service.gov.uk")
  })
})
