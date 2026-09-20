import { describe, it, expect, vi } from "vitest"
import { extractMonitoringEvents } from "./extract"
import { sendMonitoringAlert } from "./store"

function chain(data: unknown, onUpdate?: (arg: unknown) => void, onInsert?: (arg: unknown) => void) {
  const b: Record<string, (...args: unknown[]) => unknown> = {}
  b.select = vi.fn(() => b)
  b.eq = vi.fn(() => b)
  b.order = vi.fn(() => b)
  b.limit = vi.fn(() => b)
  b.maybeSingle = vi.fn(() => Promise.resolve({ data, error: null }))
  b.single = vi.fn(() => Promise.resolve({ data, error: null }))
  b.insert = vi.fn((arg: unknown) => {
    onInsert?.(arg)
    return b
  })
  b.update = vi.fn((arg: unknown) => {
    onUpdate?.(arg)
    return b
  })
  b.then = ((resolve: (v: unknown) => unknown) => resolve({ data, error: null })) as unknown as (...args: unknown[]) => unknown
  return b
}

describe("monitoring", () => {
  const auditId = "123e4567-e89b-12d3-a456-426614174000"
  it("extracts exact renewal date", () => {
    const evs = extractMonitoringEvents({ rawInput: "The renewal date: 2027-06-15 please note", auditId })
    expect(evs.some((e) => e.eventType === "renewal" && e.provenance === "exact" && e.dueDate === "2027-06-15")).toBe(true)
  })
  it("extracts expiration and deadline as exact", () => {
    const evs = extractMonitoringEvents({ rawInput: "expiration date: 2028-01-01 and deadline: 2028-02-01", auditId })
    expect(evs.find((e) => e.eventType === "expiration")?.dueDate).toBe("2028-01-01")
    expect(evs.find((e) => e.eventType === "deadline")?.dueDate).toBe("2028-02-01")
  })
  it("does not invent unknown dates (unknown stays unknown)", () => {
    const evs = extractMonitoringEvents({ rawInput: "We will renew sometime next year maybe", auditId })
    expect(evs.length).toBe(0)
  })
  it("creates approximate material event from findings", () => {
    const evs = extractMonitoringEvents({
      rawInput: "Some contract text without dates",
      auditId,
      findings: [{ ruleKey: "k", severity: "critical", summary: "Payment renewal is risky due to missing notice", evidence: [] }],
    })
    expect(evs.some((e) => e.eventType === "material_event" && e.provenance === "approximate")).toBe(true)
  })
  it("distinguishes exact vs approximate vs unknown", () => {
    const exact = extractMonitoringEvents({ rawInput: "renewal date: 2027-01-01", auditId })[0]
    const approx = extractMonitoringEvents({ rawInput: "something", auditId, findings: [{ ruleKey: "k", severity: "critical", summary: "Renewal ambiguous", evidence: [] }] })[0]
    expect(exact.provenance).toBe("exact")
    expect(approx.provenance).toBe("approximate")
  })
  it("alert idempotency prevents duplicates", () => {
    const eventId = "evt-123"
    const dest = "a@b.com"
    const k1 = `alert:${eventId}:${dest}:2027-01-01`
    const k2 = `alert:${eventId}:${dest}:2027-01-01`
    expect(k1).toBe(k2)
    const k3 = `alert:${eventId}:${dest}:2028-01-01`
    expect(k1).not.toBe(k3)
  })

  it("fails closed without Gmail instead of recording a simulated send", async () => {
    const updates: unknown[] = []
    const client = {
      from: vi.fn((table: string) => {
        if (table === "monitoring_alerts") {
          return chain({ id: "alert-1", monitoring_event_id: "evt-1", destination: "a@b.co", audit_id: "audit-1", status: "pending", provider: "gmail" }, (arg) => updates.push(arg))
        }
        if (table === "monitoring_events") {
          return chain({ title: "Renewal", description: null, due_date: "2027-03-01", provenance: "exact" })
        }
        if (table === "gmail_tokens") return chain(null)
        return chain(null)
      }),
    }
    await expect(sendMonitoringAlert(client as never, "user-1", "alert-1")).rejects.toThrow(/Gmail not connected/)
    // The failure is recorded as failed, never as sent.
    const failed = updates.find((u) => (u as { status?: string }).status === "failed")
    expect(failed).toBeDefined()
    expect(updates.some((u) => (u as { status?: string }).status === "sent")).toBe(false)
  })
})
