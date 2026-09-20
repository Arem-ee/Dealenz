import { describe, it, expect, vi } from "vitest"
import { runDeadlineReminders, selectDueEvents, type ReminderEvent } from "./reminders"

function event(overrides: Partial<ReminderEvent> = {}): ReminderEvent {
  return {
    id: "evt-1",
    user_id: "user-1",
    audit_id: "audit-1",
    title: "Renewal",
    due_date: "2026-09-25",
    status: "active",
    ...overrides,
  }
}

describe("selectDueEvents", () => {
  const now = "2026-09-20T12:00:00.000Z"
  it("keeps active dated events inside the window, including recent overdue", () => {
    const kept = selectDueEvents(
      [
        event({ id: "a", due_date: "2026-09-20" }),
        event({ id: "b", due_date: "2026-09-27" }),
        event({ id: "c", due_date: "2026-09-01" }),
      ],
      now
    ).map((e) => e.id)
    expect(kept).toEqual(["a", "b", "c"])
  })

  it("drops null dates, inactive rows, ancient history, and the far future", () => {
    const kept = selectDueEvents(
      [
        event({ id: "a", due_date: null }),
        event({ id: "b", status: "dismissed", due_date: "2026-09-21" }),
        event({ id: "c", due_date: "2026-01-01" }),
        event({ id: "d", due_date: "2027-06-01" }),
        event({ id: "e", due_date: "not-a-date" }),
      ],
      now
    )
    expect(kept).toEqual([])
  })
})

describe("runDeadlineReminders", () => {
  function deps(overrides: Record<string, unknown> = {}) {
    return {
      listDueEvents: vi.fn(async () => []),
      getUserEmail: vi.fn(async () => ({ email: "u@t.co", verified: true })),
      hasGmail: vi.fn(async () => true),
      ensureAlert: vi.fn(async () => ({ id: "alert-1", status: "pending" })),
      sendAlert: vi.fn(async () => ({ sent: true })),
      log: vi.fn(async () => undefined),
      ...overrides,
    }
  }

  it("creates and sends alerts for due events", async () => {
    const d = deps()
    const out = await runDeadlineReminders(d, [event()])
    expect(out).toEqual({ checked: 1, alerted: 1, sent: 1, failed: 0, skipped: 0 })
    expect(d.ensureAlert).toHaveBeenCalledTimes(1)
    expect(d.sendAlert).toHaveBeenCalledWith("alert-1", "user-1")
  })

  it("skips unverified or missing emails and already-sent alerts", async () => {
    const d = deps({
      getUserEmail: vi.fn(async () => ({ email: null, verified: false })),
    })
    const out = await runDeadlineReminders(d, [event({ id: "a" }), event({ id: "b" })])
    expect(out.skipped).toBe(2)
    expect(d.ensureAlert).not.toHaveBeenCalled()

    const d2 = deps({ ensureAlert: vi.fn(async () => ({ id: "x", status: "sent" })) })
    const out2 = await runDeadlineReminders(d2, [event()])
    expect(out2).toEqual({ checked: 1, alerted: 0, sent: 0, failed: 0, skipped: 1 })
    expect(d2.sendAlert).not.toHaveBeenCalled()
  })

  it("leaves alerts pending when Gmail is not connected", async () => {
    const d = deps({ hasGmail: vi.fn(async () => false) })
    const out = await runDeadlineReminders(d, [event()])
    expect(out).toEqual({ checked: 1, alerted: 1, sent: 0, failed: 0, skipped: 0 })
    expect(d.sendAlert).not.toHaveBeenCalled()
  })

  it("counts per-event failures without aborting the run", async () => {
    const d = deps({ sendAlert: vi.fn(async () => { throw new Error("boom") }) })
    const out = await runDeadlineReminders(d, [event({ id: "a" }), event({ id: "b" })])
    expect(out.failed).toBe(2)
    expect(out.checked).toBe(2)
  })
})
