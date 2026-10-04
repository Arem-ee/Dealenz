import { describe, expect, it } from "vitest"
import { timeAgo, validateNotification } from "./store"

describe("validateNotification", () => {
  const base = { userId: "u1", type: "signing" as const, title: "Signed", body: "Ava signed." }
  it("accepts clean rows and rejects bad types, lengths, and links", () => {
    expect(validateNotification(base)).toBeNull()
    expect(validateNotification({ ...base, type: "spam" as never })).toContain("type")
    expect(validateNotification({ ...base, title: "" })).toContain("Title")
    expect(validateNotification({ ...base, body: "x".repeat(501) })).toContain("Body")
    expect(validateNotification({ ...base, link: "https://evil.example" })).toContain("in-app")
    expect(validateNotification({ ...base, link: "/signing" })).toBeNull()
  })
})

describe("timeAgo", () => {
  const now = Date.parse("2026-06-01T12:00:00.000Z")
  it("stamps just now, minutes, hours, days, then dates", () => {
    expect(timeAgo("2026-06-01T11:59:40.000Z", now)).toBe("just now")
    expect(timeAgo("2026-06-01T11:58:00.000Z", now)).toBe("2 min ago")
    expect(timeAgo("2026-06-01T10:00:00.000Z", now)).toBe("2 hr ago")
    expect(timeAgo("2026-05-31T12:00:00.000Z", now)).toBe("1 day ago")
    expect(timeAgo("2026-05-20T12:00:00.000Z", now)).toContain("May")
    expect(timeAgo("not-a-date", now)).toBe("")
  })
})
