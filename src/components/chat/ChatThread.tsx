"use client"

import { useEffect, useState } from "react"
import { MessageList } from "./MessageList"
import { Composer } from "./Composer"
import { ThreadPanel, latestRichMessage } from "./ThreadPanel"
import { SplitPane, useIsDesktop } from "@/components/split-pane"
import { useToast } from "@/components/ui/toast"
import type { ThreadMessage } from "@/lib/chat/types"
import { getThreadMessages } from "@/lib/chat/actions"
import { createClient } from "@/lib/supabase/client"
import { getOpenItemsFromConversation } from "@/lib/open-items"
import { AlertCircle, ChevronDown, ChevronUp } from "lucide-react"

export function ChatThread({ threadId, auditId, initialMessages }: { threadId: string; auditId?: string | null; initialMessages?: ThreadMessage[] }) {
  const isDesktop = useIsDesktop()
  const { showError } = useToast()
  const [messages, setMessages] = useState<ThreadMessage[]>(initialMessages ?? [])
  const [userId, setUserId] = useState<string | null>(null)
  const [dealMeta, setDealMeta] = useState<{ dealType: string | null; jurisdiction: string | null } | null>(null)
  const [openItems, setOpenItems] = useState<{ items: Array<{ id: string; title: string; severity: string; category: string; summary?: string; guidance?: string }>; counts: { total: number; critical: number; material: number; attention: number; informational: number } }>({ items: [], counts: { total: 0, critical: 0, material: 0, attention: 0, informational: 0 } })
  const [openItemsExpanded, setOpenItemsExpanded] = useState(false)

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null)
    }).catch(() => setUserId(null))
  }, [])

  useEffect(() => {
    if (!auditId) return
    const supabase = createClient()
    supabase
      .from("audits")
      .select("deal_type, context_envelope, structured_data")
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

        // Compute open items from audit's deterministic findings
        if (data.structured_data) {
          const computed = getOpenItemsFromConversation(data as { structured_data: Record<string, unknown> }, messages)
          setOpenItems(computed)
        }
      })
  }, [auditId, messages])

  function fail(message: string) {
    showError(message)
  }

  const handleSent = () => {
    getThreadMessages(threadId).then((res) => {
      if (res.ok) setMessages(res.messages)
      else fail(res.error)
    }).catch(() => fail("We couldn't refresh these messages. Please try again."))
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
          const confirmed = await confirmContext(auditId, updates as never)
          if (!confirmed.success) {
            fail(confirmed.error ?? "We couldn't confirm that context. Please try again.")
            return
          }
        }
        // Re-run analysis after confirmation
        const { analyzeAndPostRisk } = await import("@/lib/chat/actions")
        const result = await analyzeAndPostRisk(threadId, auditId)
        if (!result.ok) {
          fail(result.error)
          return
        }
        const msgs = await getThreadMessages(threadId)
        if (msgs.ok) setMessages(msgs.messages)
        else fail(msgs.error)
      }
    } catch {
      fail("We couldn't confirm that context. Please try again.")
    }
  }

  async function handleDocumentGenerate(messageId: string, vars: Record<string, string>) {
    if (!auditId) return
    try {
      const { generateDocumentAndPost } = await import("@/lib/chat/actions")
      const generated = await generateDocumentAndPost(threadId, auditId, vars)
      if (!generated.ok) {
        fail(generated.error)
        return
      }
      const msgs = await getThreadMessages(threadId)
      if (msgs.ok) setMessages(msgs.messages)
      else fail(msgs.error)
    } catch {
      fail("We couldn't generate that document. Please try again.")
    }
  }

  const hasRich = latestRichMessage(messages) !== null

  const conversation = (
    <>
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

      {/* Open Items */}
      {openItems.counts.total > 0 && (
        <div className="mx-auto w-full max-w-3xl px-4 flex flex-wrap gap-2 border-t border-border/40">
          <button
            onClick={() => setOpenItemsExpanded(!openItemsExpanded)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border bg-card hover:bg-muted/50 transition-colors"
            aria-expanded={openItemsExpanded}
          >
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <span className="text-sm font-medium">
              {openItems.counts.total} open item{openItems.counts.total !== 1 ? "s" : ""}
            </span>
            <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
              {openItems.counts.critical > 0 && <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700">{openItems.counts.critical}</span>}
              {openItems.counts.material > 0 && <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">{openItems.counts.material}</span>}
              {openItems.counts.attention > 0 && <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">{openItems.counts.attention}</span>}
              {openItems.counts.informational > 0 && <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700">{openItems.counts.informational}</span>}
            </span>
            {openItemsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      )}

      {openItemsExpanded && openItems.items.length > 0 && (
        <div className="mx-auto w-full max-w-3xl px-4 pb-3 border-b border-border/40">
          <div className="space-y-2">
            {openItems.items.map((item) => (
              <div key={item.id} className="flex items-start gap-3 px-3 py-2 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{item.title}</span>
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded uppercase"
                          style={{
                            backgroundColor: item.severity === "critical" ? "rgb(254 226 226)" :
                                       item.severity === "material" ? "rgb(254 243 199)" :
                                       item.severity === "attention" ? "rgb(219 234 254)" : "rgb(243 244 246)",
                            color: item.severity === "critical" ? "rgb(185 28 28)" :
                                     item.severity === "material" ? "rgb(146 64 14)" :
                                     item.severity === "attention" ? "rgb(30 64 175)" : "rgb(75 85 99)"
                          }}>
                      {item.severity}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{item.category}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{item.summary}</p>
                  {item.guidance && <p className="mt-1 text-xs text-blue-600">{item.guidance}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-3xl">
          <MessageList
            messages={messages}
            richMode={isDesktop && hasRich ? "hidden" : "inline"}
            onContextConfirm={handleContextConfirm}
            onDocumentGenerate={handleDocumentGenerate}
          />
        </div>
      </div>
      <div className="border-t border-border/60 bg-background p-4">
        <div className="mx-auto max-w-3xl">
          <Composer threadId={threadId} auditId={auditId} onMessageSent={handleSent} />
        </div>
      </div>
    </>
  )

  // Mobile base: single scrolling column with inline cards. Desktop layer:
  // resizable split with the conversation driving and the structured
  // document in the panel.
  if (!isDesktop) {
    return <div className="flex h-[calc(100vh-3.5rem)] flex-col">{conversation}</div>
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <SplitPane
        userId={userId}
        paneKey={`thread-${threadId}`}
        primary={<div className="flex h-full min-h-0 flex-col">{conversation}</div>}
        panel={
          <ThreadPanel
            messages={messages}
            auditId={auditId}
            onContextConfirm={handleContextConfirm}
            onDocumentGenerate={handleDocumentGenerate}
          />
        }
      />
    </div>
  )
}
