import { describe, it, expect } from "vitest"
import { extractMonitoringEvents } from "./extract"

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
})
