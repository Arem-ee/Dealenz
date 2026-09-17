"use client"

import { useEffect, useState } from "react"
import { MessageList } from "./MessageList"
import { Composer } from "./Composer"
import type { ThreadMessage } from "@/lib/chat/types"
import { getThreadMessages } from "@/lib/chat/actions"
import { createClient } from "@/lib/supabase/client"

export function ChatThread({ threadId, auditId, initialMessages }: { threadId: string; auditId?: string | null; initialMessages?: ThreadMessage[] }) {
  const [messages, setMessages] = useState<ThreadMessage[]>(initialMessages ?? [])
  const [threadError, setThreadError] = useState<string | null>(null)
  const [dealMeta, setDealMeta] = useState<{ dealType: string | null; jurisdiction: string | null } | null>(null)

  useEffect(() => {
    if (!auditId) return
    const supabase = createClient()
    supabase
      .from("audits")
      .select("deal_type, context_envelope")
      .eq("id", auditId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return
        let jurisdiction: string | null = null
        try {
          const env = (data as { context_envelope?: unknown }).context_envelope as { fields?: { jurisdiction?: { value?: string | null } } } | null
          jurisdiction = env?.fields?.jurisdiction?.value ?? null
        } catch {}
        setDealMeta({ dealType: (data as { deal_type?: string | null }).deal_type ?? null, jurisdiction })
      })
  }, [auditId])

  const handleSent = () => {
    setThreadError(null)
    getThreadMessages(threadId).then((res) => {
      if (res.ok) setMessages(res.messages)
      else setThreadError(res.error)
    }).catch(() => setThreadError("We couldn't refresh these messages. Please try again."))
  }

  async function handleContextConfirm(messageId: string, corrections: Record<string, string>) {
    setThreadError(null)
    try {
      const { confirmContext } = await import("@/app/audit/[id]/context-actions")
      // Use auditId if available
      if (auditId) {
        const updates: Record<string, { value: string }> = {}
        for (const [k, v] of Object.entries(corrections)) {
          if (v.trim()) updates[k] = { value: v.trim() }
        }
        if (Object.keys(updates).length > 0) {
          const confirmed = await confirmContext(auditId, updates as never)
          if (!confirmed.success) {
            setThreadError(confirmed.error ?? "We couldn't confirm that context. Please try again.")
            return
          }
        }
        // Re-run analysis after confirmation
        const { analyzeAndPostRisk } = await import("@/lib/chat/actions")
        const result = await analyzeAndPostRisk(threadId, auditId)
        if (!result.ok) {
          setThreadError(result.error)
          return
        }
        const msgs = await getThreadMessages(threadId)
        if (msgs.ok) setMessages(msgs.messages)
        else setThreadError(msgs.error)
      }
    } catch {
      setThreadError("We couldn't confirm that context. Please try again.")
    }
  }

  async function handleDocumentGenerate(messageId: string, vars: Record<string, string>) {
    if (!auditId) return
    setThreadError(null)
    try {
      const { generateDocumentAndPost } = await import("@/lib/chat/actions")
      const generated = await generateDocumentAndPost(threadId, auditId, vars)
      if (!generated.ok) {
        setThreadError(generated.error)
        return
      }
      const msgs = await getThreadMessages(threadId)
      if (msgs.ok) setMessages(msgs.messages)
      else setThreadError(msgs.error)
    } catch {
      setThreadError("We couldn't generate that document. Please try again.")
    }
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {dealMeta && (dealMeta.dealType || dealMeta.jurisdiction) && (
        <div className="mx-auto w-full max-w-3xl px-4 pt-3 flex flex-wrap gap-2">
          {dealMeta.dealType && (
            <span className="inline-flex items-center gap-1 rounded-full border bg-muted px-2.5 py-1 text-xs">
              Deal type: <span className="font-medium capitalize">{dealMeta.dealType.replace("_", " ")}</span>
            </span>
          )}
          {dealMeta.jurisdiction && (
            <span className="inline-flex items-center gap-1 rounded-full border bg-muted px-2.5 py-1 text-xs">
              Jurisdiction: <span className="font-medium">{dealMeta.jurisdiction}</span>
            </span>
          )}
        </div>
      )}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-3xl">
          {threadError && (
            <div role="alert" className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive">
              {threadError}
            </div>
          )}
          <MessageList messages={messages} onContextConfirm={handleContextConfirm} onDocumentGenerate={handleDocumentGenerate} />
        </div>
      </div>
      <div className="border-t border-border/60 bg-background p-4">
        <div className="mx-auto max-w-3xl">
          <Composer threadId={threadId} auditId={auditId} onMessageSent={handleSent} />
        </div>
      </div>
    </div>
  )
}
