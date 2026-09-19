"use client"

import { useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import type { ThreadMessage } from "@/lib/chat/types"
import { RiskReportCard } from "./cards/RiskReportCard"
import { ContextConfirmCard } from "./cards/ContextConfirmCard"
import { DocumentDraftCard } from "./cards/DocumentDraftCard"
import { LawyerRecommendationCard } from "./cards/LawyerRecommendationCard"

export function MessageList({
  messages,
  isLoading,
  onContextConfirm,
  onDocumentGenerate,
  onAskFinding,
  richMode = "inline",
}: {
  messages: ThreadMessage[]
  isLoading?: boolean
  onContextConfirm?: (messageId: string, corrections: Record<string, string>) => void
  onDocumentGenerate?: (messageId: string, vars: Record<string, string>) => void
  onAskFinding?: (question: string) => void
  // "inline" renders rich cards in the scroll (mobile base). "hidden" skips
  // them because the desktop split-pane panel shows the same payload.
  richMode?: "inline" | "hidden"
}) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isLoading])

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm text-muted-foreground">No messages yet. Start by asking a question or pasting a deal.</p>
      </div>
    )
  }

  const showRich = richMode === "inline"

  return (
    <div className="space-y-4">
      {messages.map((m) => {
        if (!showRich && (m.type === "risk_report" || m.type === "context_confirm" || m.type === "document_draft" || m.type === "document_draft_turn" || m.type === "lawyer_recommendation")) {
          return null
        }
        if (m.type === "risk_report") {
          return (
            <div key={m.id} className="flex justify-start">
              <div className="w-full max-w-[95%]">
                <RiskReportCard payload={(m.payload as Record<string, unknown>) ?? {}} onAskFinding={onAskFinding} />
                <p className="mt-1 text-[10px] text-muted-foreground">{new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
              </div>
            </div>
          )
        }
        if (m.type === "context_confirm") {
          return (
            <div key={m.id} className="flex justify-start">
              <div className="w-full max-w-[95%]">
                <ContextConfirmCard payload={(m.payload as Record<string, unknown>) ?? {}} onConfirm={(corrections) => onContextConfirm?.(m.id, corrections)} />
                <p className="mt-1 text-[10px] text-muted-foreground">{new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
              </div>
            </div>
          )
        }
        if (m.type === "document_draft" || m.type === "document_draft_turn") {
          return (
            <div key={m.id} className="flex justify-start">
              <div className="w-full max-w-[95%]">
                <DocumentDraftCard payload={(m.payload as Record<string, unknown>) ?? {}} onGenerate={onDocumentGenerate ? async (vars) => onDocumentGenerate(m.id, vars) : undefined} />
                <p className="mt-1 text-[10px] text-muted-foreground">{new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
              </div>
            </div>
          )
        }
        if (m.type === "lawyer_recommendation") {
          return (
            <div key={m.id} className="flex justify-start">
              <div className="w-full max-w-[95%]">
                <LawyerRecommendationCard payload={(m.payload as Record<string, unknown>) ?? {}} />
                <p className="mt-1 text-[10px] text-muted-foreground">{new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
              </div>
            </div>
          )
        }
        return (
          <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
              )}
            >
              <p className="whitespace-pre-wrap">{m.content}</p>
              <p className="mt-1 text-[10px] opacity-60">{new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
            </div>
          </div>
        )
      })}
      {isLoading && (
        <div className="flex justify-start">
          <div className="rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground">Thinking…</div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  )
}
