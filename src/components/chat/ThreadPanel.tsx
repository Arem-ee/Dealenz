"use client"

import type { ThreadMessage } from "@/lib/chat/types"
import { RiskReportCard } from "./cards/RiskReportCard"
import { DocumentDraftCard } from "./cards/DocumentDraftCard"
import { ContextConfirmCard } from "./cards/ContextConfirmCard"
import { LawyerRecommendationCard } from "./cards/LawyerRecommendationCard"
import { FileText } from "lucide-react"

const RICH_TYPES = new Set(["risk_report", "document_draft", "document_draft_turn", "context_confirm", "lawyer_recommendation"])

/** Latest structured payload in the thread, if any. */
export function latestRichMessage(messages: ThreadMessage[]): ThreadMessage | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (RICH_TYPES.has(messages[i].type)) return messages[i]
  }
  return null
}

function PanelCard({ message, onContextConfirm, onDocumentGenerate }: {
  message: ThreadMessage
  onContextConfirm?: (messageId: string, corrections: Record<string, string>) => void
  onDocumentGenerate?: (messageId: string, vars: Record<string, string>) => void
}) {
  const payload = (message.payload as Record<string, unknown>) ?? {}
  switch (message.type) {
    case "risk_report":
      return <RiskReportCard payload={payload} />
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
export function ThreadPanel({ messages, auditId, onContextConfirm, onDocumentGenerate }: {
  messages: ThreadMessage[]
  auditId?: string | null
  onContextConfirm?: (messageId: string, corrections: Record<string, string>) => void
  onDocumentGenerate?: (messageId: string, vars: Record<string, string>) => void
}) {
  const latest = latestRichMessage(messages)
  void auditId

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-border/60 px-4 py-3 sm:px-5">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <FileText className="h-4 w-4 text-muted-foreground" />
          Deal document
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {latest ? "Latest structured output from this conversation." : "Structured output from this conversation appears here."}
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
        <div className="mx-auto w-full max-w-2xl font-serif">
          {latest ? (
            <PanelCard message={latest} onContextConfirm={onContextConfirm} onDocumentGenerate={onDocumentGenerate} />
          ) : (
            <p className="rounded-xl border border-dashed px-4 py-8 text-center text-xs text-muted-foreground">
              Nothing structured yet. Paste a deal or ask a question and the risk report or draft lands here.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
