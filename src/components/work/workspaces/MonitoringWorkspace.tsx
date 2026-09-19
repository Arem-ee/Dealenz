"use client"

import { useState, type ReactNode } from "react"
import { ClientTime } from "@/components/datetime"
import { Section } from "./Section"
import type { MonitoringAlert, MonitoringEvent } from "./types"
import {
  createMonitoringAlertAction,
  createMonitoringEventAction,
  sendMonitoringAlertAction,
} from "@/lib/monitoring/actions"

const EVENT_TYPES = ["renewal", "expiration", "notice_period", "payment_due", "obligation", "deadline", "material_event", "custom"]

// Full monitoring surface over real backend state. Events and alerts are
// created through Server Actions (auth + validation server-side); the Gmail
// connection state is authoritative, and a "sent" alert without an email
// provider is labeled recorded, not emailed.
export function MonitoringWorkspace({ auditId, events, alerts, gmailConnected, onChanged }: {
  auditId: string
  events: MonitoringEvent[]
  alerts: MonitoringAlert[]
  gmailConnected: boolean
  onChanged: () => void
}) {
  const [creating, setCreating] = useState(false)
  const [eventType, setEventType] = useState("deadline")
  const [title, setTitle] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [formError, setFormError] = useState<string | null>(null)
  const [busyAlert, setBusyAlert] = useState<string | null>(null)
  const [alertError, setAlertError] = useState<string | null>(null)
  const [emails, setEmails] = useState<Record<string, string>>({})

  const unresolved = events.filter((e) => (e.status ?? "active") === "active")

  const createEvent = async () => {
    setFormError(null)
    if (title.trim().length < 5) {
      setFormError("Give the event a title of at least 5 characters.")
      return
    }
    setCreating(true)
    try {
      const res = await createMonitoringEventAction(auditId, {
        eventType: eventType as never,
        title: title.trim(),
        dueDate: dueDate || undefined,
        provenance: "user_confirmed",
        evidence: {},
        source: "user",
      } as never)
      if (!res.ok) {
        setFormError(res.error)
        return
      }
      setTitle("")
      setDueDate("")
      onChanged()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Could not create event.")
    } finally {
      setCreating(false)
    }
  }

  const createAndSendAlert = async (eventId: string) => {
    const destination = (emails[eventId] ?? "").trim()
    setAlertError(null)
    if (!destination.includes("@")) {
      setAlertError("Enter a valid email address for the alert.")
      return
    }
    setBusyAlert(eventId)
    try {
      const created = await createMonitoringAlertAction({ monitoringEventId: eventId, auditId, destination } as never)
      if (!created.ok) {
        setAlertError(created.error)
        return
      }
      const sent = await sendMonitoringAlertAction(created.id)
      if (!sent.ok) {
        setAlertError(sent.error)
        return
      }
      onChanged()
    } catch (e) {
      setAlertError(e instanceof Error ? e.message : "Could not send alert.")
    } finally {
      setBusyAlert(null)
    }
  }

  const alertStatusLabel = (a: MonitoringAlert): ReactNode => {
    if (a.status === "sent")
      return a.provider === "gmail" ? (
        <>
          Sent{a.sent_at ? (
            <>
              {" · "}
              <ClientTime iso={a.sent_at} kind="day" />
            </>
          ) : (
            ""
          )}
        </>
      ) : (
        "Recorded (no email sent)"
      )
    return (a.status ?? "pending").replaceAll("_", " ")
  }

  return (
    <div>
      <Section
        title={`Watched events${events.length > 0 ? ` (${unresolved.length} active)` : ""}`}
        hint={gmailConnected ? "Alerts send through your connected Gmail." : "Connect Gmail in Settings to email alerts; events still track without it."}
      >
        {events.length === 0 ? (
          <p className="text-xs text-muted-foreground">This deal is not being monitored yet. Add the first watched event below.</p>
        ) : (
          <div className="space-y-2">
            {events.map((e) => {
              const eventAlerts = alerts.filter((a) => a.monitoring_event_id === e.id)
              return (
                <div key={e.id} className="rounded-xl border bg-card p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium">{e.title ?? "Event"}</span>
                    <span className="rounded-full border px-2 py-0.5 text-[10px] uppercase text-muted-foreground">{(e.event_type ?? "").replaceAll("_", " ")}</span>
                    <span className="ml-auto text-[11px] text-muted-foreground">{e.due_date ?? "No due date"}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Status: {(e.status ?? "active").replaceAll("_", " ")}
                    {e.provenance ? ` · provenance: ${e.provenance}` : ""}
                  </p>
                  {eventAlerts.length > 0 && (
                    <div className="mt-1 space-y-0.5">
                      {eventAlerts.map((a) => (
                        <p key={a.id} className="text-[11px] text-muted-foreground">
                          Alert to {a.destination ?? "—"} · {alertStatusLabel(a)}
                        </p>
                      ))}
                    </div>
                  )}
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="email"
                      value={emails[e.id] ?? ""}
                      onChange={(ev) => setEmails((s) => ({ ...s, [e.id]: ev.target.value }))}
                      placeholder="Alert email"
                      aria-label={`Alert email for ${e.title ?? "event"}`}
                      className="min-w-0 flex-1 rounded-lg border bg-background px-2 py-1 text-xs outline-none placeholder:text-muted-foreground/60"
                    />
                    <button
                      type="button"
                      disabled={busyAlert === e.id}
                      onClick={() => void createAndSendAlert(e.id)}
                      className="rounded-full border px-3 py-1 text-xs font-medium hover:bg-muted/60 disabled:opacity-50"
                    >
                      {busyAlert === e.id ? "Sending…" : "Alert me"}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        {alertError && <p className="mt-2 text-xs text-destructive">{alertError}</p>}
      </Section>
      <Section title="Watch something new" hint="Only you see these until an alert sends.">
        <div className="space-y-2">
          <div className="flex gap-2">
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              aria-label="Event type"
              className="rounded-lg border bg-background px-2 py-1.5 text-xs outline-none"
            >
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>{t.replaceAll("_", " ")}</option>
              ))}
            </select>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              aria-label="Due date"
              className="rounded-lg border bg-background px-2 py-1.5 text-xs outline-none"
            />
          </div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What should we watch for?"
            aria-label="Event title"
            maxLength={200}
            className="w-full rounded-lg border bg-background px-3 py-1.5 text-xs outline-none placeholder:text-muted-foreground/60"
          />
          {formError && <p className="text-xs text-destructive">{formError}</p>}
          <button
            type="button"
            disabled={creating}
            onClick={() => void createEvent()}
            className="rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {creating ? "Adding…" : "Watch this"}
          </button>
        </div>
      </Section>
    </div>
  )
}
