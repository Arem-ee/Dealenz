import { describe, expect, it } from "vitest"
import { findCorpusConflicts, hashText, segmentClauses, type CorpusClause } from "./conflicts"

const CORPUS: CorpusClause[] = [
  {
    auditId: "a-old",
    auditTitle: "Vendor MSA",
    clauseKey: "exclusivity",
    title: "Exclusivity",
    quote: "Supplier is the exclusive provider of widgets for the term.",
  },
  {
    auditId: "a-old",
    auditTitle: "Vendor MSA",
    clauseKey: "liability",
    title: "Liability",
    quote: "Liability is uncapped for breach of confidentiality.",
  },
]

describe("hashText", () => {
  it("normalizes before hashing", () => {
    expect(hashText("Hello  World")).toBe(hashText("hello world"))
    expect(hashText("a")).not.toBe(hashText("b"))
  })
})

describe("segmentClauses", () => {
  it("splits assembly markdown at H3 boundaries", () => {
    const md = `# Agreement\n\n### Ownership\nThe ownership split is 60/40 between founders.\n\n### Vesting\nFour years with a twelve month cliff.`
    const sections = segmentClauses(md)
    expect(sections.map((s) => s.key)).toEqual(["ownership", "vesting"])
    expect(sections[0]!.quote).toContain("60/40")
    expect(sections.every((s) => s.textHash.length === 64)).toBe(true)
  })

  it("drops boilerplate sections and indexes whole documents without H3s", () => {
    expect(segmentClauses(`### A\n${"x".repeat(10)}\n\n### B\n${"y".repeat(30)}`).map((s) => s.key)).toEqual(["b"])
    const whole = segmentClauses("This is a plain agreement text with enough words to count as content here.")
    expect(whole).toHaveLength(1)
    expect(whole[0]!.key).toBe("document")
    expect(segmentClauses("tiny")).toEqual([])
  })
})

describe("findCorpusConflicts", () => {
  it("flags two-sided overlaps and never self-conflicts", () => {
    const conflicts = findCorpusConflicts(
      "This deal grants exclusive distribution rights for widgets.",
      CORPUS,
      "a-new"
    )
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0]!.type).toBe("exclusivity")
    expect(conflicts[0]!.message).toContain("Vendor MSA")
  })

  it("stays silent on one-sided language and own deals", () => {
    expect(findCorpusConflicts("A quiet statement of work.", CORPUS, "a-new")).toEqual([])
    expect(
      findCorpusConflicts("Exclusive rights granted here.", CORPUS, "a-old")
    ).toEqual([])
  })

  it("caps output and dedupes", () => {
    const big: CorpusClause[] = Array.from({ length: 20 }, (_, i) => ({
      auditId: `a-${i}`,
      auditTitle: `Deal ${i}`,
      clauseKey: "exclusivity",
      title: "Exclusivity",
      quote: "exclusive provider of widgets",
    }))
    const conflicts = findCorpusConflicts("exclusive arrangement", big, "a-new")
    expect(conflicts.length).toBeLessThanOrEqual(10)
  })
})
