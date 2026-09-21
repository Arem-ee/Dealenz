import { describe, it, expect } from "vitest"
import { bucketActivityByDay } from "./week"

describe("bucketActivityByDay", () => {
  it("buckets a trailing week with today flagged", () => {
    const buckets = bucketActivityByDay(
      [
        { created_at: "2026-09-22T10:00:00.000Z" },
        { created_at: "2026-09-22T11:00:00.000Z" },
        { created_at: "2026-09-20T10:00:00.000Z" },
        { created_at: "2026-08-01T10:00:00.000Z" },
        null,
        {},
        { created_at: "not-a-date" },
      ],
      "2026-09-22T12:00:00.000Z"
    )
    expect(buckets).toHaveLength(7)
    expect(buckets[6]).toMatchObject({ key: "2026-09-22", label: "Today", count: 2, isToday: true })
    expect(buckets[4]).toMatchObject({ key: "2026-09-20", count: 1, isToday: false })
    expect(buckets.slice(0, 4).every((b) => b.count === 0)).toBe(true)
  })

  it("returns empty on unparseable now", () => {
    expect(bucketActivityByDay([{ created_at: "2026-09-22T10:00:00.000Z" }], "garbage")).toEqual([])
  })
})
