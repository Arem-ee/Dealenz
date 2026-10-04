import { describe, expect, it } from "vitest"
import { dailyCounts, daysBetween, formatDays, median, medianDays, monthBuckets, toCsv } from "./stats"

describe("median", () => {
  it("takes the middle value, averaging even counts, null when empty", () => {
    expect(median([])).toBeNull()
    expect(median([3])).toBe(3)
    expect(median([1, 9, 3])).toBe(3)
    expect(median([1, 2, 3, 4])).toBe(2.5)
  })
})

describe("daysBetween/medianDays", () => {
  it("counts whole days and skips unparseable or inverted pairs", () => {
    expect(daysBetween("2026-01-01T00:00:00Z", "2026-01-03T12:00:00Z")).toBe(2)
    expect(daysBetween(null, "2026-01-03T00:00:00Z")).toBeNull()
    expect(daysBetween("2026-01-03T00:00:00Z", "2026-01-01T00:00:00Z")).toBeNull()
    const pairs: Array<{ from: string | null; to: string | null }> = [
      { from: "2026-01-01T00:00:00Z", to: "2026-01-03T00:00:00Z" },
      { from: null, to: "2026-01-03T00:00:00Z" },
    ]
    expect(medianDays(pairs)).toEqual({ median: 2, n: 1 })
  })
})

describe("dailyCounts", () => {
  it("zero-fills trailing days oldest-first", () => {
    const now = Date.parse("2026-01-10T12:00:00Z")
    const out = dailyCounts(["2026-01-10T08:00:00Z", "2026-01-08T08:00:00Z"], 3, now)
    expect(out).toEqual([
      { day: "2026-01-08", count: 1 },
      { day: "2026-01-09", count: 0 },
      { day: "2026-01-10", count: 1 },
    ])
  })
})

describe("formatDays/toCsv", () => {
  it("renders days and escapes csv cells", () => {
    expect(formatDays(null)).toBe("—")
    expect(formatDays(0)).toBe("<1 day")
    expect(formatDays(5)).toBe("5 days")
    expect(toCsv(["a", "b"], [["x", 'say "hi", ok'], ["y", "z"]])).toBe('a,b\nx,"say ""hi"", ok"\ny,z')
  })
})

describe("monthBuckets", () => {
  it("buckets by calendar month, zero-filled oldest-first", () => {
    const now = Date.parse("2026-03-15T12:00:00Z")
    const out = monthBuckets(["2026-03-02T00:00:00Z", "2026-01-20T00:00:00Z", "2026-01-21T00:00:00Z"], 3, now)
    expect(out).toEqual([
      { month: "2026-01", count: 2 },
      { month: "2026-02", count: 0 },
      { month: "2026-03", count: 1 },
    ])
  })
})
