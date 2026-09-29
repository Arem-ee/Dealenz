"use client"

import type { ThreadMessage } from "@/lib/chat/types"
import { RiskReportCard } from "./cards/RiskReportCard"
import { DocumentDraftCard } from "./cards/DocumentDraftCard"
import { ContextConfirmCard } from "./cards/ContextConfirmCard"
import { LawyerRecommendationCard } from "./cards/LawyerRecommendationCard"

const RICH_TYPES = new Set(["risk_report", "document_draft", "document_draft_turn", "context_confirm", "lawyer_recommendation"])

/** Latest structured payload in the thread, if any. */
export function latestRichMessage(messages: ThreadMessage[]): ThreadMessage | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (RICH_TYPES.has(messages[i].type)) return messages[i]
  }
  return null
}

function PanelCard({ message, auditId, onContextConfirm, onDocumentGenerate, onAskFinding }: {
  message: ThreadMessage
  auditId?: string | null
  onContextConfirm?: (messageId: string, corrections: Record<string, string>) => void
  onDocumentGenerate?: (messageId: string, vars: Record<string, string>) => void
  onAskFinding?: (question: string) => void
}) {
  const payload = (message.payload as Record<string, unknown>) ?? {}
  switch (message.type) {
    case "risk_report":
      return <RiskReportCard payload={payload} onAskFinding={onAskFinding} auditId={auditId} />
    case "document_draft":
    case "document_draft_turn":
      return <DocumentDraftCard payload={payload} onGenerate={onDocumentGenerate ? async (vars) => onDocumentGenerate(message.id, vars) : undefined} />
    case "context_confirm":
      return <ContextConfirmCard payload={payload} onConfirm={(corrections) => onContextConfirm?.(message.id, corrections)} />
    case "lawyer_recommendation":
      return <LawyerRecommendationCard payload={payload} />
    default:
      return null
  }
}

/**
 * Structured-content panel for the desktop split-pane. Renders the thread's
 * latest rich payload as a real document (serif body), reusing the exact same
 * card components as the mobile inline rendering — one implementation, two
 * placements.
 */
export function ThreadPanel({ messages, auditId, onContextConfirm, onDocumentGenerate, onAskFinding }: {
  messages: ThreadMessage[]
  auditId?: string | null
  onContextConfirm?: (messageId: string, corrections: Record<string, string>) => void
  onDocumentGenerate?: (messageId: string, vars: Record<string, string>) => void
  onAskFinding?: (question: string) => void
}) {
  const latest = latestRichMessage(messages)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
        <div className="mx-auto w-full max-w-2xl ">
          {latest ? (
            <PanelCard message={latest} auditId={auditId} onContextConfirm={onContextConfirm} onDocumentGenerate={onDocumentGenerate} onAskFinding={onAskFinding} />
          ) : (
            <div className="px-4 py-8 text-center">
              <p className="text-sm font-medium">Nothing structured yet.</p>
              <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
                Ask a question below — the analysis, drafts, and documents land here as the work completes.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
