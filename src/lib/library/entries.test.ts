import { describe, expect, it } from "vitest"
import {
  canVersion,
  customClauseKey,
  isClauseUserState,
  isLibraryVariant,
  latestUsableEntries,
  missingVariants,
  normalizeLibraryBody,
  normalizeLibraryCategory,
  normalizeLibraryTitle,
  standardClauseKey,
  type LibraryClauseRow,
} from "./entries"

function row(over: Partial<LibraryClauseRow> & { key: string }): LibraryClauseRow {
  return {
    id: over.key,
    variant: "preferred",
    language: "en",
    version: 1,
    title: "Title",
    body: "Body",
    category: "general",
    dealTypes: [],
    status: "active",
    changeNote: "",
    templateId: null,
    templateVersion: null,
    useCount: 0,
    lastUsedAt: null,
    createdAt: "",
    ...over,
  }
}

describe("keys", () => {
  it("builds stable standard keys", () => {
    expect(standardClauseKey("Founder-IP-Assignment")).toBe("std:founder-ip-assignment")
  })

  it("slugs custom keys", () => {
    expect(customClauseKey("  Net-60 Never! ")).toBe("custom:net-60-never")
    expect(customClauseKey("!!!")).toBe("custom:clause")
  })
})

describe("normalizers", () => {
  it("trims and rejects blanks", () => {
    expect(normalizeLibraryTitle("  Cap  ")).toBe("Cap")
    expect(normalizeLibraryTitle("  ")).toBeNull()
    expect(normalizeLibraryBody(42)).toBeNull()
    expect(normalizeLibraryCategory(" Liability ")).toBe("liability")
    expect(normalizeLibraryCategory("")).toBe("general")
  })
})

describe("latestUsableEntries", () => {
  it("picks the highest non-superseded version per key+variant", () => {
    const rows = [
      row({ key: "a", variant: "preferred", version: 1 }),
      row({ key: "a", variant: "preferred", version: 2 }),
      row({ key: "a", variant: "fallback", version: 1 }),
      row({ key: "a", variant: "preferred", version: 3, status: "superseded" }),
      row({ key: "b", variant: "preferred", version: 1, status: "deprecated" }),
    ]
    const out = latestUsableEntries(rows)
    expect(out.map((r) => [r.key, r.variant, r.version])).toEqual([
      ["a", "preferred", 2],
      ["b", "preferred", 1],
      ["a", "fallback", 1],
    ])
  })

  it("tracks histories separately per language", () => {
    const rows = [
      row({ key: "a", variant: "preferred", language: "en", version: 2 }),
      row({ key: "a", variant: "preferred", language: "fr", version: 1 }),
    ]
    const out = latestUsableEntries(rows)
    expect(out.map((r) => [r.language, r.version])).toEqual([["en", 2], ["fr", 1]])
  })
})

describe("missingVariants / isLibraryVariant", () => {
  it("flags lines without a walk-away, per language", () => {
    const rows = [
      row({ key: "a", variant: "preferred" }),
      row({ key: "a", variant: "fallback" }),
      row({ key: "a", variant: "preferred", language: "fr" }),
    ]
    expect(missingVariants(rows, "a", "en")).toEqual(["walkaway"])
    expect(missingVariants(rows, "a", "fr")).toEqual(["fallback", "walkaway"])
    expect(missingVariants(rows, "b", "en")).toEqual(["preferred", "fallback", "walkaway"])
  })

  it("validates variant names", () => {
    expect(isLibraryVariant("walkaway")).toBe(true)
    expect(isLibraryVariant("standard")).toBe(false)
  })
})

describe("canVersion / isClauseUserState", () => {
  it("allows new versions on active or deprecated heads", () => {
    expect(canVersion("active")).toBe(true)
    expect(canVersion("deprecated")).toBe(true)
    expect(canVersion("superseded")).toBe(false)
  })

  it("validates stored user states", () => {
    expect(isClauseUserState("accepted")).toBe(true)
    expect(isClauseUserState("archived")).toBe(false)
  })
})
