// Shared workspace data shapes (presentational layer).
//
// Every field comes from an authoritative read assembled in ChatThread
// (RLS-scoped selects, Server Actions). Sections render what exists and
// render honest empty states otherwise. Nothing here fetches or mutates.

import type { Evidence } from "@/lib/evidence/schema"

export interface WorkspaceFinding {
  ruleKey?: string | null
  severity: string
  summary: string
  whyItMatters?: string
  guidance?: string
  pushback?: string
  evidence?: Evidence[]
}

export interface OpenItem {
  id: string
  title: string
  severity: string
  category: string
  summary?: string
  guidance?: string
  pushback?: string
}

export interface DocVersion {
  id: string
  document_type: string
  version_number: number
  content: string | null
  generation_method: string | null
  status: string | null
  created_at: string | null
}

export interface Signer {
  id: string
  name: string | null
  email: string | null
  party_label: string | null
  status: string | null
  signed_at: string | null
}

export interface SigningEvent {
  id: string
  event_type: string | null
  created_at: string | null
}

export interface ChecklistItem {
  id: string
  label: string
  status: string | null
  sort_order: number | null
}

export interface MonitoringEvent {
  id: string
  event_type: string | null
  title: string | null
  due_date: string | null
  provenance: string | null
  status: string | null
}

export interface MonitoringAlert {
  id: string
  monitoring_event_id: string | null
  destination: string | null
  status: string | null
  provider: string | null
  sent_at: string | null
}

export interface WorkspaceData {
  findings: WorkspaceFinding[]
  openItems: OpenItem[]
  openCounts: { total: number; critical: number; material: number; attention: number; informational: number }
  versions: DocVersion[]
  signers: Signer[]
  signingEvents: SigningEvent[]
  checklist: ChecklistItem[]
  monitoringEvents: MonitoringEvent[]
  monitoringAlerts: MonitoringAlert[]
  gmailConnected: boolean
  negotiationPoints: string[]
  negotiationDegraded: boolean
  deliverables: string[]
  missingInputs: string[]
}
