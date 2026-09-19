import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  createMonitoringAlertAction,
  createMonitoringEventAction,
  sendMonitoringAlertAction,
} from "./actions"

// P0-3: monitoring mutations and alert sends are consequential (signed-deal
// state + external email), so they require a verified email. The read-only
// getMonitoringState stays available pre-verification.
const mockGetUser = vi.hoisted(() => vi.fn())
const mockFrom = vi.hoisted(() => vi.fn())

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}))

const unverifiedUser = { id: "00000000-0000-0000-0000-000000000001", email: "t@t.co", email_confirmed_at: null }

beforeEach(() => {
  mockGetUser.mockReset()
  mockFrom.mockReset()
  mockFrom.mockImplementation(() => {
    throw new Error("DB must not be touched before verification")
  })
  mockGetUser.mockResolvedValue({ data: { user: unverifiedUser }, error: null })
})

describe("monitoring actions email verification (P0-3)", () => {
  it("denies event creation for unverified users", async () => {
    const result = await createMonitoringEventAction("audit-1", {
      eventType: "renewal",
      title: "Renewal",
      dueDate: "2026-12-01",
    } as never)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/verify your email/)
  })

  it("denies alert creation for unverified users", async () => {
    const result = await createMonitoringAlertAction({ auditId: "audit-1", monitoringEventId: "evt-1", destination: "a@b.co" } as never)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/verify your email/)
  })

  it("denies alert sends for unverified users", async () => {
    const result = await sendMonitoringAlertAction("alert-1")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/verify your email/)
  })

  it("touches no database rows on any denied path", async () => {
    await createMonitoringEventAction("audit-1", { eventType: "renewal", title: "R", dueDate: "2026-12-01" } as never)
    await createMonitoringAlertAction({ auditId: "audit-1", monitoringEventId: "evt-1", destination: "a@b.co" } as never)
    await sendMonitoringAlertAction("alert-1")
    expect(mockFrom).not.toHaveBeenCalled()
  })
})
