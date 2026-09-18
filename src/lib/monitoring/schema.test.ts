import { describe, it, expect } from "vitest"
import { validateMonitoringEvent, alertIdempotencyKey } from "./schema"

describe("monitoring schema", () => {
  const auditId = "123e4567-e89b-12d3-a456-426614174000"
  it("validates exact event", () => {
    expect(validateMonitoringEvent({ auditId, eventType: "renewal", title: "Renewal on 2027-01-01", provenance: "exact", dueDate: "2027-01-01" })).toBeNull()
  })
  it("rejects invalid auditId", () => {
    expect(validateMonitoringEvent({ auditId: "bad", eventType: "renewal", title: "Renewal", provenance: "exact" })).toBe("Invalid auditId")
  })
  it("rejects short title", () => {
    expect(validateMonitoringEvent({ auditId, eventType: "renewal", title: "Hi", provenance: "exact" })).toBe("Invalid title")
  })
  it("distinguishes provenance", () => {
    expect(validateMonitoringEvent({ auditId, eventType: "renewal", title: "Renewal notice", provenance: "approximate" })).toBeNull()
    expect(validateMonitoringEvent({ auditId, eventType: "renewal", title: "Renewal notice", provenance: "unknown" })).toBeNull()
    expect(validateMonitoringEvent({ auditId, eventType: "renewal", title: "Renewal notice", provenance: "user_confirmed" })).toBeNull()
  })
  it("creates deterministic alert idempotency key", () => {
    const k1 = alertIdempotencyKey("evt-1", "a@b.com", "2027-01-01")
    const k2 = alertIdempotencyKey("evt-1", "a@b.com", "2027-01-01")
    expect(k1).toBe(k2)
    expect(k1).toBe("alert:evt-1:a@b.com:2027-01-01")
  })
  it("does not convert unknown to exact", () => {
    const keyExact = alertIdempotencyKey("evt-1", "a@b.com", "2027-01-01")
    const keyUnknown = alertIdempotencyKey("evt-1", "a@b.com", null)
    expect(keyExact).not.toBe(keyUnknown)
  })
})
