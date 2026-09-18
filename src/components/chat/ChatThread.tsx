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
import { PlanPreview } from "@/components/work/PlanPreview"
import { ExecutionProgress } from "@/components/work/ExecutionProgress"
import type { PlanRow, PlanStepRow, WorkExecutionRow } from "@/lib/work/schema"

export function ChatThread({ threadId, auditId, initialMessages }: { threadId: string; auditId?: string | null; initialMessages?: ThreadMessage[] }) {
  const isDesktop = useIsDesktop()
  const { showError } = useToast()
  const [messages, setMessages] = useState<ThreadMessage[]>(initialMessages ?? [])
  const [userId, setUserId] = useState<string | null>(null)
  const [dealMeta, setDealMeta] = useState<{ dealType: string | null; jurisdiction: string | null } | null>(null)
  const [openItems, setOpenItems] = useState<{ items: Array<{ id: string; title: string; severity: string; category: string; summary?: string; guidance?: string }>; counts: { total: number; critical: number; material: number; attention: number; informational: number } }>({ items: [], counts: { total: 0, critical: 0, material: 0, attention: 0, informational: 0 } })
  const [openItemsExpanded, setOpenItemsExpanded] = useState(false)
  const [workPlan, setWorkPlan] = useState<PlanRow | null>(null)
  const [workSteps, setWorkSteps] = useState<PlanStepRow[]>([])
  const [workExecution, setWorkExecution] = useState<WorkExecutionRow | null>(null)
  const [planLoading, setPlanLoading] = useState(false)
  const [analysisUsage, setAnalysisUsage] = useState<{ count: number; limit: number } | null>(null)

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

  // Work plan — fetch latest plan for this thread (work-first)
  const refreshWorkPlan = async () => {
    if (!threadId) return
    setPlanLoading(true)
    try {
      const { getLatestPlanForThread } = await import("@/lib/work/actions")
      const res = await getLatestPlanForThread(threadId)
      if (res.ok && res.plan) {
        setWorkPlan(res.plan)
        setWorkSteps(res.steps)
        setWorkExecution(res.execution)
      } else {
        setWorkPlan(null)
        setWorkSteps([])
        setWorkExecution(null)
      }
      // Live usage awareness — authoritative server-side source, frontend not authoritative
      try {
        const { getAnalysisUsage } = await import("@/lib/work/actions")
        const usageRes = await getAnalysisUsage()
        if (usageRes.ok) setAnalysisUsage({ count: usageRes.count, limit: usageRes.limit })
      } catch {}
    } catch {
      // keep previous
    } finally {
      setPlanLoading(false)
    }
  }

  useEffect(() => {
    void refreshWorkPlan()
  }, [threadId, messages.length])

  const handlePlanApprove = async (planId: string) => {
    try {
      const { approveWorkPlan, executeApprovedPlan } = await import("@/lib/work/actions")
      const idempotencyKey = crypto.randomUUID()
      const appr = await approveWorkPlan(planId, idempotencyKey)
      if (!appr.ok) {
        fail(appr.error)
        return
      }
      // Fetch approval id for execution
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      const { data: approval } = await supabase.from("work_approvals").select("id").eq("plan_id", planId).order("approved_at", { ascending: false }).limit(1).maybeSingle()
      if (!approval) {
        fail("Approval not found after approve")
        return
      }
      const exec = await executeApprovedPlan(planId, (approval as { id: string }).id)
      if (!exec.ok) {
        fail(exec.error)
        await refreshWorkPlan()
        return
      }
      await refreshWorkPlan()
      // Refresh conversation to show risk_report published by executor (one authoritative publication)
      const msgs = await getThreadMessages(threadId)
      if (msgs.ok) setMessages(msgs.messages)
    } catch {
      fail("We couldn't approve and execute that plan. Please try again.")
    }
  }

  const handlePlanReject = async (planId: string) => {
    try {
      const { rejectWorkPlan } = await import("@/lib/work/actions")
      const res = await rejectWorkPlan(planId)
      if (!res.ok) fail(res.error)
      await refreshWorkPlan()
    } catch {
      fail("We couldn't reject that plan. Please try again.")
    }
  }

  const handlePlanResume = async (planId: string) => {
    try {
      const { resumeWorkPlan } = await import("@/lib/work/actions")
      const res = await resumeWorkPlan(planId)
      if (!res.ok) {
        fail(res.error)
        return
      }
      // After resume, re-execute with same approval
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      const { data: approval } = await supabase.from("work_approvals").select("id").eq("plan_id", planId).order("approved_at", { ascending: false }).limit(1).maybeSingle()
      if (approval) {
        const { executeApprovedPlan } = await import("@/lib/work/actions")
        const exec = await executeApprovedPlan(planId, (approval as { id: string }).id)
        if (!exec.ok) fail(exec.error)
      }
      await refreshWorkPlan()
      const msgs = await getThreadMessages(threadId)
      if (msgs.ok) setMessages(msgs.messages)
    } catch {
      fail("We couldn't resume that plan. Please try again.")
    }
  }

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
        // If a work plan is in needs_input, resume it instead of direct analysis (preserves plan identity, hash, audit trail)
        if (workPlan && workPlan.status === "needs_input") {
          const { resumeWorkPlan } = await import("@/lib/work/actions")
          const resumed = await resumeWorkPlan(workPlan.id)
          if (!resumed.ok) {
            fail(resumed.error)
            return
          }
          // After resume, re-execute the approved plan (same approval, same payload_hash)
          const { createClient } = await import("@/lib/supabase/client")
          const supabase = createClient()
          const { data: approval } = await supabase.from("work_approvals").select("id").eq("plan_id", workPlan.id).order("approved_at", { ascending: false }).limit(1).maybeSingle()
          if (approval) {
            const { executeApprovedPlan } = await import("@/lib/work/actions")
            const exec = await executeApprovedPlan(workPlan.id, (approval as { id: string }).id)
            if (!exec.ok) fail(exec.error)
          }
          await refreshWorkPlan()
          const msgs = await getThreadMessages(threadId)
          if (msgs.ok) setMessages(msgs.messages)
          return
        }
        // Fallback: direct analysis for non-plan path (preserves existing callers)
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
      {/* Work plan — approval-gated, 0 credits + 5/day limit (mobile inline; desktop in work surface) */}
      {!isDesktop && workPlan && (
        <div className="mx-auto w-full max-w-3xl px-4 pb-3">
          <PlanPreview plan={workPlan} steps={workSteps} usage={analysisUsage} onApprove={handlePlanApprove} onReject={handlePlanReject} onResume={handlePlanResume} />
          {workExecution && workPlan.status !== "awaiting_approval" && (
            <div className="mt-3">
              <ExecutionProgress execution={workExecution} steps={workSteps} />
            </div>
          )}
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
          <div className="flex h-full min-h-0 flex-col">
            {workPlan && (
              <div className="shrink-0 border-b border-border/60 bg-card p-3">
                <PlanPreview plan={workPlan} steps={workSteps} usage={analysisUsage} onApprove={handlePlanApprove} onReject={handlePlanReject} onResume={handlePlanResume} />
                {workExecution && workPlan.status !== "awaiting_approval" && (
                  <div className="mt-3">
                    <ExecutionProgress execution={workExecution} steps={workSteps} />
                  </div>
                )}
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto">
              <ThreadPanel
                messages={messages}
                auditId={auditId}
                onContextConfirm={handleContextConfirm}
                onDocumentGenerate={handleDocumentGenerate}
              />
            </div>
          </div>
        }
      />
    </div>
  )
}
