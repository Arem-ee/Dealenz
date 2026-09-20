// Counterparty memory: what happened last time with this counterparty.
// Keyed on the linked client profile (explicit user linkage, never guessed
// identity). Each past deal contributes what was flagged and what got
// resolved through redline re-checks — patterns to prepare with, not
// promises about this deal. Absent stays absent.

export interface MemoryFlag {
  ruleKey: string
  summary: string
  severity: string
}

export interface MemoryResolved {
  ruleKey: string
  summary: string
}

export interface PastDealMemory {
  id: string
  title: string
  dealType: string
  status: string
  createdAt: string
  flagged: MemoryFlag[]
  resolved: MemoryResolved[]
}

export interface CounterpartyMemory {
  hasIdentity: boolean
  clientName: string | null
  pastDeals: PastDealMemory[]
}

interface PriorAuditRow {
  id?: unknown
  title?: unknown
  deal_type?: unknown
  status?: unknown
  created_at?: unknown
  structured_data?: {
    deterministicFindings?: unknown
    findingDelta?: {
      resolved?: unknown
    } | null
  } | null
}

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback
}

export function assembleCounterpartyMemory(
  currentAuditId: string,
  clientName: string | null,
  priorAudits: PriorAuditRow[]
): CounterpartyMemory {
  if (!clientName) {
    return { hasIdentity: false, clientName: null, pastDeals: [] }
  }
  const deals: PastDealMemory[] = []
  for (const row of priorAudits ?? []) {
    const id = asString(row.id)
    if (!id || id === currentAuditId) continue
    const det = row.structured_data?.deterministicFindings
    const flagged: MemoryFlag[] = []
    if (Array.isArray(det)) {
      for (const r of det) {
        if (typeof r !== "object" || r === null) continue
        const rec = r as { status?: unknown; ruleKey?: unknown; finding?: { severity?: unknown; summary?: unknown } }
        if (rec.status !== "FAIL" || !rec.finding) continue
        const summary = asString(rec.finding.summary)
        if (!summary) continue
        flagged.push({
          ruleKey: asString(rec.ruleKey, "unknown"),
          summary,
          severity: asString(rec.finding.severity, "informational"),
        })
        if (flagged.length >= 10) break
      }
    }
    const resolved: MemoryResolved[] = []
    const deltaResolved = row.structured_data?.findingDelta?.resolved
    if (Array.isArray(deltaResolved)) {
      for (const e of deltaResolved) {
        if (typeof e !== "object" || e === null) continue
        const entry = e as { ruleKey?: unknown; summary?: unknown }
        if (typeof entry.ruleKey !== "string" || !entry.ruleKey) continue
        resolved.push({ ruleKey: entry.ruleKey, summary: asString(entry.summary) })
        if (resolved.length >= 10) break
      }
    }
    deals.push({
      id,
      title: asString(row.title, "Untitled deal"),
      dealType: asString(row.deal_type, "unknown"),
      status: asString(row.status, "unknown"),
      createdAt: asString(row.created_at),
      flagged,
      resolved,
    })
    if (deals.length >= 5) break
  }
  return { hasIdentity: true, clientName, pastDeals: deals }
}
