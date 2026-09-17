"use client"

import { useEffect, useState } from "react"
import { MessageList } from "./MessageList"
import { Composer } from "./Composer"
import type { ThreadMessage } from "@/lib/chat/types"
import { getThreadMessages, postRichMessage } from "@/lib/chat/actions"
import { createClient } from "@/lib/supabase/client"

export function ChatThread({ threadId, auditId, initialMessages }: { threadId: string; auditId?: string | null; initialMessages?: ThreadMessage[] }) {
  const [messages, setMessages] = useState<ThreadMessage[]>(initialMessages ?? [])
  const [loading, setLoading] = useState(!initialMessages)
  const [dealMeta, setDealMeta] = useState<{ dealType: string | null; jurisdiction: string | null } | null>(null)

  useEffect(() => {
    if (initialMessages) return
    let cancelled = false
    setLoading(true)
    getThreadMessages(threadId)
      .then((msgs) => {
        if (!cancelled) setMessages(msgs)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [threadId, initialMessages])

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
    getThreadMessages(threadId).then(setMessages).catch(() => {})
  }

  async function handleContextConfirm(messageId: string, corrections: Record<string, string>) {
    try {
      const { confirmContext } = await import("@/app/audit/[id]/context-actions")
      // Use auditId if available
      if (auditId) {
        const updates: Record<string, { value: string }> = {}
        for (const [k, v] of Object.entries(corrections)) {
          if (v.trim()) updates[k] = { value: v.trim() }
        }
        if (Object.keys(updates).length > 0) {
          await confirmContext(auditId, updates as never)
        }
        // Re-run analysis after confirmation
        const { analyzeAndPostRisk } = await import("@/lib/chat/actions")
        await analyzeAndPostRisk(threadId, auditId)
        const msgs = await getThreadMessages(threadId)
        setMessages(msgs)
      }
    } catch {}
  }

  async function handleDocumentGenerate(messageId: string, vars: Record<string, string>) {
    if (!auditId) return
    const { generateDocumentAndPost } = await import("@/lib/chat/actions")
    await generateDocumentAndPost(threadId, auditId, vars)
    const msgs = await getThreadMessages(threadId)
    setMessages(msgs)
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
          <MessageList messages={messages} isLoading={loading} onContextConfirm={handleContextConfirm} onDocumentGenerate={handleDocumentGenerate} />
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
