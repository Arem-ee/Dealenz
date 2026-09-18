// Monitoring event extraction (Phase 3) — deterministic, evidence-aware
// Extracts renewal/expiration/notice/payment/obligation/deadline/material events from deal text + structured data.
// Uses existing evidence and context, does not invent obligations.

import type { MonitoringEventInput } from "./schema"

interface ExtractedFact {
  key: string
  value: string | null
  source: string
  evidence?: { quote: string; location: unknown }
}

export function extractMonitoringEvents(input: {
  rawInput: string
  auditId: string
  documentVersionId?: string | null
  facts?: Record<string, unknown>
  findings?: Array<{ ruleKey: string; severity: string; summary: string; evidence?: Array<{ quote: string | null; location: unknown }> }>
  contextEnvelope?: Record<string, unknown>
}): MonitoringEventInput[] {
  const events: MonitoringEventInput[] = []
  const raw = input.rawInput ?? ""

  // Simple deterministic patterns (no AI invention)
  const patterns: Array<{ type: MonitoringEventInput["eventType"]; regex: RegExp; title: string; provenance: MonitoringEventInput["provenance"] }> = [
    { type: "renewal", regex: /renew(?:al)?\s*(?:date|on)?\s*:?\s*(\d{4}-\d{2}-\d{2})/i, title: "Renewal date", provenance: "exact" },
    { type: "expiration", regex: /expir(?:y|ation)\s*(?:date)?\s*:?\s*(\d{4}-\d{2}-\d{2})/i, title: "Expiration date", provenance: "exact" },
    { type: "notice_period", regex: /notice\s*(?:period)?\s*:?\s*(\d+)\s*(days?)/i, title: "Notice period", provenance: "exact" },
    { type: "payment_due", regex: /payment\s*due\s*:?\s*(\d{4}-\d{2}-\d{2})/i, title: "Payment due", provenance: "exact" },
    { type: "deadline", regex: /deadline\s*:?\s*(\d{4}-\d{2}-\d{2})/i, title: "Deadline", provenance: "exact" },
  ]

  for (const p of patterns) {
    const m = raw.match(p.regex)
    if (m) {
      const dateStr = m[1]?.match(/^\d{4}-\d{2}-\d{2}$/) ? m[1] : null
      events.push({
        auditId: input.auditId,
        documentVersionId: input.documentVersionId ?? null,
        eventType: p.type,
        title: p.title + (dateStr ? ` — ${dateStr}` : ""),
        description: m[0].slice(0, 200),
        provenance: p.provenance,
        evidence: { quote: m[0], location: { rawOffset: raw.indexOf(m[0]) } },
        dueDate: dateStr,
        source: "extracted",
      })
    }
  }

  // Material events from findings: high-severity FAILs that mention dates/obligations
  for (const f of input.findings ?? []) {
    if (f.severity === "critical" || f.severity === "material") {
      if (/renew|expir|deadline|notice|payment/i.test(f.summary)) {
        // Avoid duplicate if already extracted
        const already = events.some((e) => e.title === f.summary.slice(0, 50))
        if (!already) {
          events.push({
            auditId: input.auditId,
            documentVersionId: input.documentVersionId ?? null,
            eventType: "material_event",
            title: f.summary.slice(0, 100),
            description: f.summary,
            provenance: "approximate",
            evidence: f.evidence?.[0] ? { quote: f.evidence[0].quote ?? "", location: f.evidence[0].location } : {},
            source: "extracted",
          })
        }
      }
    }
  }

  // If no exact date found but context has due info, create unknown/approximate
  if (events.length === 0 && raw.length > 50) {
    // No event invented; return empty — do not silently convert uncertainty into hard reminder
  }

  return events
}
