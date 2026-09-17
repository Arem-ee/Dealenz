// Chat-per-deal thread model — Phase 1 foundation
// Each deal is one persistent thread. The thread is the audit row + its
// conversation. Messages are stored in conversation_messages; rich cards for
// later phases are stored as typed payloads in metadata, not as separate tables.
// Plain text turns are type "text" with content in the content column.
// Future rich types (risk_report, document_draft, context_confirm, etc.) will be
// { type: "risk_report", payload: {...} } inside metadata, keeping the same
// table and ordering guarantees. This shape is forward-compatible without a
// migration for each new card type.

export type ThreadMessageType = "text" | "risk_report" | "document_draft" | "context_confirm" | "lawyer_recommendation" | string

export interface ThreadMessage {
  id: string
  role: "user" | "assistant"
  content: string
  type: ThreadMessageType
  payload?: Record<string, unknown> | null
  operation?: string | null
  intent?: string | null
  createdAt: string
}

export interface Thread {
  id: string // conversation id, also used as thread id
  auditId: string | null
  title: string
  lastActivity: string
  status: string // derived from audit.status or conversation updated_at
  messages: ThreadMessage[]
}

// Helper to convert DB rows to ThreadMessage — handles both current plain rows
// and future rich payloads stored in metadata.
export function toThreadMessage(row: {
  id: string
  role: string
  content: string
  message_type?: string
  metadata?: Record<string, unknown> | null
  operation?: string | null
  intent?: string | null
  created_at: string
}): ThreadMessage {
  const meta = (row.metadata ?? {}) as Record<string, unknown>
  const type = (meta.type as string) ?? "text"
  const payload = (meta.payload as Record<string, unknown> | undefined) ?? null
  return {
    id: row.id,
    role: row.role as "user" | "assistant",
    content: row.content,
    type,
    payload,
    operation: row.operation ?? null,
    intent: row.intent ?? null,
    createdAt: row.created_at,
  }
}
