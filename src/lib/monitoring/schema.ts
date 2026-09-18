// Monitoring schema (Phase 3) — deterministic, provenance-aware

export type MonitoringEventType = "renewal" | "expiration" | "notice_period" | "payment_due" | "obligation" | "deadline" | "material_event" | "custom"
export type Provenance = "exact" | "approximate" | "unknown" | "user_confirmed"
export type MonitoringStatus = "active" | "dismissed" | "completed"

export interface MonitoringEventInput {
  auditId: string
  documentVersionId?: string | null
  eventType: MonitoringEventType
  title: string
  description?: string
  provenance: Provenance
  evidence?: Record<string, unknown> // {quote, location, observation_key, method, confidence}
  dueDate?: string | null // YYYY-MM-DD
  dueTimestamp?: string | null // ISO
  source?: "extracted" | "user" | "lawyer" | "system"
}

export interface MonitoringAlertInput {
  monitoringEventId: string
  auditId: string
  destination: string // email
  provider?: "gmail" | "system"
}

export function validateMonitoringEvent(input: MonitoringEventInput): string | null {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.auditId)) return "Invalid auditId"
  if (!["renewal","expiration","notice_period","payment_due","obligation","deadline","material_event","custom"].includes(input.eventType)) return "Invalid eventType"
  if (typeof input.title !== "string" || input.title.length < 5 || input.title.length > 200) return "Invalid title"
  if (input.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)) return "Invalid dueDate"
  return null
}

export function alertIdempotencyKey(eventId: string, destination: string, dueDate?: string | null): string {
  return `alert:${eventId}:${destination}:${dueDate ?? "no-date"}`
}
