import { describe, expect, it } from "vitest"
import { isScheduleDue, isSupportedTimezone, type DueSchedule } from "./schedules"

function schedule(over: Partial<DueSchedule> = {}): DueSchedule {
  return {
    cadence: "weekly",
    timezone: "UTC",
    sendHour: 8,
    sendWeekday: 1,
    active: false,
    expiresAt: null,
    lastRunAt: null,
    ...over,
  }
}

describe("isScheduleDue", () => {
  // Monday 2026-10-12 08:00 UTC.
  const monday = new Date("2026-10-12T08:00:00Z")

  it("fires weekly on weekday+hour", () => {
    expect(isScheduleDue(schedule({ active: true }), monday)).toBe(true)
  })

  it("holds inactive, expired, and wrong slots", () => {
    expect(isScheduleDue(schedule({ active: true }), new Date("2026-10-13T08:00:00Z"))).toBe(false)
    expect(isScheduleDue(schedule({ active: true }), new Date("2026-10-12T09:00:00Z"))).toBe(false)
    expect(isScheduleDue(schedule({ active: false }), monday)).toBe(false)
    expect(isScheduleDue(schedule({ active: true, expiresAt: "2026-10-01T00:00:00Z" }), monday)).toBe(false)
  })

  it("does not double-fire within the period", () => {
    expect(
      isScheduleDue(schedule({ active: true, lastRunAt: "2026-10-12T08:05:00Z" }), new Date("2026-10-12T08:00:00Z"))
    ).toBe(false)
  })

  it("fires monthly on the 1st at hour", () => {
    const monthly = schedule({ active: true, cadence: "monthly", sendWeekday: null })
    expect(isScheduleDue(monthly, new Date("2026-11-01T08:00:00Z"))).toBe(true)
    expect(isScheduleDue(monthly, new Date("2026-11-02T08:00:00Z"))).toBe(false)
  })

  it("validates timezones against the curated list", () => {
    expect(isSupportedTimezone("Africa/Lagos")).toBe(true)
    expect(isSupportedTimezone("Mars/Olympus")).toBe(false)
  })
})
