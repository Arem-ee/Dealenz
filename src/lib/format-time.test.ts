import { describe, it, expect } from "vitest"
import { formatClock, formatDateTime, formatDayShort } from "./format-time"

// Wall-clock formatters use a pinned locale (never the runtime default) so
// server and browser output cannot diverge by locale. Exact wall-clock values
// depend on the machine timezone, so assertions target shape, not instants.
describe("format-time", () => {
  it("formats clock times with pinned locale", () => {
    expect(formatClock(new Date("2026-09-19T15:09:00Z"))).toMatch(/^\d{2}:\d{2} [AP]M$/)
  })

  it("formats short days with pinned locale", () => {
    expect(formatDayShort(new Date("2026-09-19T15:09:00Z"))).toMatch(/^[A-Z][a-z]{2} \d{1,2}$/)
  })

  it("formats datetimes with pinned locale", () => {
    expect(formatDateTime(new Date("2026-09-19T15:09:00Z"))).toMatch(/^[A-Z][a-z]{2} \d{1,2}, \d{2}:\d{2} [AP]M$/)
  })

  it("renders invalid input as absent, never throws", () => {
    const bad = new Date("not-a-date")
    expect(formatClock(bad)).toBe("")
    expect(formatDayShort(bad)).toBe("")
    expect(formatDateTime(bad)).toBe("")
  })
})
