"use client"

import { useEffect, useState } from "react"
import { MessageList } from "./MessageList"
import { Composer } from "./Composer"
import { ReviseDealInput } from "./ReviseDealInput"
import { ThreadPanel, latestRichMessage } from "./ThreadPanel"
import { SplitPane, useIsDesktop } from "@/components/split-pane"
import { useToast } from "@/components/ui/toast"
import type { ThreadMessage } from "@/lib/chat/types"
import { getThreadMessages } from "@/lib/chat/actions"
import { createClient } from "@/lib/supabase/client"
import { getOpenItemsFromConversation } from "@/lib/open-items"
import { AlertCircle, ChevronDown, ChevronUp } from "lucide-react"
import { PushbackWords } from "@/components/findings/pushback-words"
import { PlanPreview } from "@/components/work/PlanPreview"
import { ExecutionProgress } from "@/components/work/ExecutionProgress"
import { WorkspaceHeader, type MonitoringSummary } from "./WorkspaceHeader"
import { WorkspaceView } from "@/components/work/workspaces/WorkspaceView"
import type { ChecklistItem, DocVersion, Signer, SigningEvent, MonitoringAlert, MonitoringEvent, WorkspaceFinding } from "@/components/work/workspaces/types"
import { describeWorkspace } from "@/lib/work/workspace"
import { classifyOperation } from "@/lib/conversation/classify"
import type { PlanRow, PlanStepRow, WorkExecutionRow } from "@/lib/work/schema"
import type { FindingDelta } from "@/lib/rules/result"

// Persisted finding deltas are server-written, but validated by shape before
// render — a malformed row must never break the thread.
function isFindingDelta(value: unknown): value is FindingDelta {
  if (typeof value !== "object" || value === null) return false
  const d = value as Record<string, unknown>
  const isEntry = (e: unknown): boolean => {
    if (typeof e !== "object" || e === null) return false
    const r = e as Record<string, unknown>
    return typeof r.ruleKey === "string" && typeof r.summary === "string" && typeof r.severity === "string"
  }
  return (
    Array.isArray(d.resolved) &&
    Array.isArray(d.stillOpen) &&
    Array.isArray(d.newIssues) &&
    [...d.resolved, ...d.stillOpen, ...d.newIssues].every(isEntry)
  )
}

export function ChatThread({ threadId, auditId, initialMessages }: { threadId: string; auditId?: string | null; initialMessages?: ThreadMessage[] }) {
  const isDesktop = useIsDesktop()
  const { showError } = useToast()
  const [messages, setMessages] = useState<ThreadMessage[]>(initialMessages ?? [])
  const [userId, setUserId] = useState<string | null>(null)
  const [dealMeta, setDealMeta] = useState<{ dealType: string | null; jurisdiction: string | null } | null>(null)
  const [dealTitle, setDealTitle] = useState<string | null>(null)
  const [dealInput, setDealInput] = useState<string | null>(null)
  const [findingDelta, setFindingDelta] = useState<FindingDelta | null>(null)
  const [verdictExpanded, setVerdictExpanded] = useState(false)
  const [documentCount, setDocumentCount] = useState<number>(0)
  const [monitoring, setMonitoring] = useState<MonitoringSummary | null>(null)
  const [prefill, setPrefill] = useState<{ text: string; key: number } | null>(null)
  const [versions, setVersions] = useState<DocVersion[]>([])
  const [signers, setSigners] = useState<Signer[]>([])
  const [signingEvents, setSigningEvents] = useState<SigningEvent[]>([])
  const [checklist, setChecklist] = useState<ChecklistItem[]>([])
  const [monitoringEvents, setMonitoringEvents] = useState<MonitoringEvent[]>([])
  const [monitoringAlerts, setMonitoringAlerts] = useState<MonitoringAlert[]>([])
  const [gmailConnected, setGmailConnected] = useState<boolean>(false)
  const [negotiationPoints, setNegotiationPoints] = useState<string[]>([])
  const [negotiationDegraded, setNegotiationDegraded] = useState<boolean>(false)
  const [riskDegraded, setRiskDegraded] = useState<boolean>(false)
  const [rulesDegraded, setRulesDegraded] = useState<boolean>(false)
  const [deliverables, setDeliverables] = useState<string[]>([])
  const [missingInputs, setMissingInputs] = useState<string[]>([])
  const [workspaceTick, setWorkspaceTick] = useState<number>(0)
  const [openItems, setOpenItems] = useState<{ items: Array<{ id: string; title: string; severity: string; category: string; summary?: string; guidance?: string; pushback?: string }>; counts: { total: number; critical: number; material: number; attention: number; informational: number } }>({ items: [], counts: { total: 0, critical: 0, material: 0, attention: 0, informational: 0 } })
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
      .select("deal_type, context_envelope, structured_data, title, raw_input")
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
        setDealTitle((data as { title?: string | null }).title ?? null)
        const rawInput = (data as { raw_input?: unknown }).raw_input
        setDealInput(typeof rawInput === "string" ? rawInput : null)

        // Compute open items from audit's deterministic findings
        if (data.structured_data) {
          const computed = getOpenItemsFromConversation(data as { structured_data: Record<string, unknown> }, messages)
          setOpenItems(computed)
          const structured = data.structured_data as Record<string, unknown>
          setFindingDelta(isFindingDelta(structured.findingDelta) ? (structured.findingDelta as FindingDelta) : null)
          const points = Array.isArray(structured.negotiationPoints) ? (structured.negotiationPoints as unknown[]).filter((p): p is string => typeof p === "string") : []
          setNegotiationPoints(points)
          setNegotiationDegraded(structured.genericRiskDegraded === true)
          setRiskDegraded(structured.riskDegraded === true)
          setRulesDegraded(structured.rulesDegraded === true)
          const extracted = structured.extractedData as { deliverables?: unknown } | undefined
          setDeliverables(Array.isArray(extracted?.deliverables) ? (extracted.deliverables as unknown[]).filter((d): d is string => typeof d === "string") : [])
        }
        // Unconfirmed context fields are the honest "missing inputs"
        try {
          const env = (data as { context_envelope?: unknown }).context_envelope as { fields?: Record<string, { value?: unknown; source?: string }> } | null
          const fields = env?.fields ?? {}
          const missing = Object.entries(fields)
            .filter(([, f]) => f && f.source !== "user_confirmed" && (f.value === null || f.value === undefined || f.value === ""))
            .map(([k]) => k.replace(/([A-Z])/g, " $1").replace(/_/g, " ").trim())
          setMissingInputs(missing.slice(0, 8))
        } catch {
          setMissingInputs([])
        }
      })
  }, [auditId, messages])

  // Work-surface supporting reads: versions, signers, events, checklist,
  // monitoring. All RLS-scoped like the audit read above; only what the
  // backend actually returns is rendered, never invented.
  useEffect(() => {
    if (!auditId || !userId) return
    let cancelled = false
    const load = async () => {
      const supabase = createClient()
      try {
        const { data: rows } = await supabase
          .from("document_versions")
          .select("id, document_type, version_number, content, generation_method, status, created_at")
          .eq("audit_id", auditId)
          .order("version_number", { ascending: false })
          .limit(30)
        if (!cancelled) {
          const list = ((rows ?? []) as unknown[]).map((r) => {
            const row = r as Record<string, unknown>
            return {
              id: String(row.id ?? ""),
              document_type: String(row.document_type ?? ""),
              version_number: typeof row.version_number === "number" ? row.version_number : 0,
              content: typeof row.content === "string" ? row.content : null,
              generation_method: typeof row.generation_method === "string" ? row.generation_method : null,
              status: typeof row.status === "string" ? row.status : null,
              created_at: typeof row.created_at === "string" ? row.created_at : null,
            } as DocVersion
          })
          setVersions(list)
          setDocumentCount(list.length)
        }
      } catch {
        if (!cancelled) {
          setVersions([])
          setDocumentCount(0)
        }
      }
      try {
        const { data: signerRows } = await supabase.from("document_signers").select("id, name, email, party_label, status, signed_at").eq("audit_id", auditId).limit(30)
        if (!cancelled) {
          setSigners(((signerRows ?? []) as unknown[]).map((r) => {
            const row = r as Record<string, unknown>
            return {
              id: String(row.id ?? ""),
              name: typeof row.name === "string" ? row.name : null,
              email: typeof row.email === "string" ? row.email : null,
              party_label: typeof row.party_label === "string" ? row.party_label : null,
              status: typeof row.status === "string" ? row.status : null,
              signed_at: typeof row.signed_at === "string" ? row.signed_at : null,
            } as Signer
          }))
        }
      } catch {
        if (!cancelled) setSigners([])
      }
      try {
        const { data: eventRows } = await supabase.from("signing_events").select("id, event_type, created_at").eq("audit_id", auditId).order("created_at", { ascending: true }).limit(50)
        if (!cancelled) {
          setSigningEvents(((eventRows ?? []) as unknown[]).map((r) => {
            const row = r as Record<string, unknown>
            return {
              id: String(row.id ?? ""),
              event_type: typeof row.event_type === "string" ? row.event_type : null,
              created_at: typeof row.created_at === "string" ? row.created_at : null,
            } as SigningEvent
          }))
        }
      } catch {
        if (!cancelled) setSigningEvents([])
      }
      try {
        const { data: checkRows } = await supabase.from("checklist_items").select("id, label, status, sort_order").eq("audit_id", auditId).order("sort_order", { ascending: true }).limit(50)
        if (!cancelled) {
          setChecklist(((checkRows ?? []) as unknown[]).map((r) => {
            const row = r as Record<string, unknown>
            return {
              id: String(row.id ?? ""),
              label: String(row.label ?? ""),
              status: typeof row.status === "string" ? row.status : null,
              sort_order: typeof row.sort_order === "number" ? row.sort_order : null,
            } as ChecklistItem
          }))
        }
      } catch {
        if (!cancelled) setChecklist([])
      }
      try {
        const { listMonitoringEvents } = await import("@/lib/monitoring/store")
        const events = await listMonitoringEvents(supabase, userId, auditId)
        if (cancelled) return
        const mapped = events.map((e) => {
          const row = e as Record<string, unknown>
          return {
            id: String(row.id ?? ""),
            event_type: typeof row.event_type === "string" ? row.event_type : null,
            title: typeof row.title === "string" ? row.title : null,
            due_date: typeof row.due_date === "string" ? row.due_date : null,
            provenance: typeof row.provenance === "string" ? row.provenance : null,
            status: typeof row.status === "string" ? row.status : null,
          } as MonitoringEvent
        })
        setMonitoringEvents(mapped)
        if (mapped.length === 0) {
          setMonitoring(null)
        } else {
          const unresolved = mapped.filter((m) => (m.status ?? "active") === "active").length
          setMonitoring({ total: mapped.length, unresolved })
        }
      } catch {
        if (!cancelled) {
          setMonitoringEvents([])
          setMonitoring(null)
        }
      }
      try {
        const { data: alertRows } = await supabase.from("monitoring_alerts").select("id, monitoring_event_id, destination, status, provider, sent_at").eq("audit_id", auditId).eq("user_id", userId).order("created_at", { ascending: false }).limit(50)
        if (!cancelled) {
          setMonitoringAlerts(((alertRows ?? []) as unknown[]).map((r) => {
            const row = r as Record<string, unknown>
            return {
              id: String(row.id ?? ""),
              monitoring_event_id: typeof row.monitoring_event_id === "string" ? row.monitoring_event_id : null,
              destination: typeof row.destination === "string" ? row.destination : null,
              status: typeof row.status === "string" ? row.status : null,
              provider: typeof row.provider === "string" ? row.provider : null,
              sent_at: typeof row.sent_at === "string" ? row.sent_at : null,
            } as MonitoringAlert
          }))
        }
      } catch {
        if (!cancelled) setMonitoringAlerts([])
      }
      try {
        const { getGmailTokens } = await import("@/lib/gmail/tokens")
        const tokens = await getGmailTokens(supabase, userId).catch(() => null)
        if (!cancelled) setGmailConnected(tokens !== null)
      } catch {
        if (!cancelled) setGmailConnected(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [auditId, userId, messages.length, workspaceTick])

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
    // The effect body only initiates the refresh; refreshWorkPlan owns all
    // state updates after its awaits resolve.
    const run = async () => {
      await refreshWorkPlan()
    }
    void run()
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
  const latestRich = latestRichMessage(messages)
  // Classified objective of the latest user message (same client-safe
  // classifier that routes the conversation). Unknown stays unknown.
  const latestUserText = [...messages].reverse().find((m) => m.role === "user" && m.content.trim().length > 0)?.content ?? null
  const operation = latestUserText ? classifyOperation(latestUserText, false) : null
  const activeSigning = signers.length > 0 || versions.some((v) => v.status !== null && v.status !== "draft")
  const workspace = describeWorkspace({
    planStatus: workPlan?.status ?? null,
    planObjectiveKind: (workPlan as { objective_kind?: string | null } | null)?.objective_kind ?? null,
    executionStatus: workExecution?.status ?? null,
    operation,
    latestRichType: latestRich?.type ?? null,
    monitoringCount: monitoring?.total ?? 0,
    documentCount,
    signerCount: signers.length,
    activeSigning,
  })

  // Findings travel inside the latest risk report payload (evidence
  // attached at analysis time). Absent stays absent.
  const latestRiskPayload = [...messages].reverse().find((m) => m.type === "risk_report")?.payload as { findings?: unknown; riskLevel?: string; overallScore?: number } | undefined
  const workspaceFindings = (Array.isArray(latestRiskPayload?.findings) ? (latestRiskPayload?.findings as unknown[]) : []).map((f) => {
    const item = (f ?? {}) as Record<string, unknown>
    return {
      ruleKey: typeof item.ruleKey === "string" ? item.ruleKey : null,
      severity: typeof item.severity === "string" ? item.severity : "informational",
      summary: typeof item.summary === "string" ? item.summary : "",
      whyItMatters: typeof item.whyItMatters === "string" ? item.whyItMatters : undefined,
      guidance: typeof item.guidance === "string" ? item.guidance : undefined,
      pushback: typeof item.pushback === "string" ? item.pushback : undefined,
      evidence: Array.isArray(item.evidence) ? (item.evidence as WorkspaceFinding["evidence"]) : [],
    } as WorkspaceFinding
  })

  const workspaceData = {
    findings: workspaceFindings,
    openItems: openItems.items,
    openCounts: openItems.counts,
    versions,
    signers,
    signingEvents,
    checklist,
    monitoringEvents,
    monitoringAlerts,
    gmailConnected,
    negotiationPoints,
    negotiationDegraded,
    riskDegraded,
    rulesDegraded,
    deliverables,
    missingInputs,
  }

  // Modes with a dedicated surface carry the structured output; the generic
  // latest-card panel stays for approval, execution, confirm, lawyer, idle.
  const coveredMode = ["review", "proposal", "negotiation", "draft", "protection", "signing", "monitoring"].includes(workspace.mode)

  const handleAskFinding = (question: string) => {
    setPrefill({ text: question, key: Date.now() })
  }

  const handleWorkspaceChanged = () => {
    setWorkspaceTick((t) => t + 1)
    void refreshWorkPlan()
    getThreadMessages(threadId).then((res) => {
      if (res.ok) setMessages(res.messages)
    }).catch(() => {})
  }

  const conversation = (
    <>
      {(dealMeta || (auditId && dealInput !== null)) && (
        <div className="mx-auto w-full max-w-3xl px-4 pt-3 flex flex-wrap items-center gap-2">
          {dealMeta?.dealType && (
            <span className="inline-flex items-center gap-1 rounded-full border bg-muted px-2.5 py-1 text-xs">
              Deal type: <span className="font-medium capitalize">{dealMeta.dealType.replace("_", " ")}</span>
            </span>
          )}
          {dealMeta?.jurisdiction && (
            <span className="inline-flex items-center gap-1 rounded-full border bg-muted px-2.5 py-1 text-xs">
              Jurisdiction: <span className="font-medium">{dealMeta.jurisdiction}</span>
            </span>
          )}
          {auditId && dealInput !== null && (
            <ReviseDealInput
              auditId={auditId}
              threadId={threadId}
              initialText={dealInput}
              onPlanReady={() => {
                void refreshWorkPlan()
                handleSent()
              }}
              onError={fail}
            />
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
                  {item.pushback && <PushbackWords words={item.pushback} compact auditId={auditId} ruleKey={item.id} />}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Redline re-check verdict — persisted by analyzeDeal on re-analysis,
          rendered wherever the findings render (both layouts). */}
      {findingDelta &&
        (findingDelta.resolved.length > 0 ||
          findingDelta.stillOpen.length > 0 ||
          findingDelta.newIssues.length > 0) && (
          <div className="mx-auto w-full max-w-3xl px-4 pb-3">
            <button
              onClick={() => setVerdictExpanded(!verdictExpanded)}
              className="flex w-full items-center gap-2 px-3 py-2 rounded-xl border bg-card hover:bg-muted/50 transition-colors"
              aria-expanded={verdictExpanded}
            >
              <span className="text-sm font-medium">
                Re-check: {findingDelta.resolved.length} resolved · {findingDelta.stillOpen.length} still open ·{" "}
                {findingDelta.newIssues.length} new
              </span>
              <span className="ml-auto text-muted-foreground">
                {verdictExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </span>
            </button>
            {verdictExpanded && (
              <div className="mt-2 space-y-2">
                {(
                  [
                    ["Resolved", findingDelta.resolved],
                    ["Still open", findingDelta.stillOpen],
                    ["New", findingDelta.newIssues],
                  ] as const
                ).map(
                  ([label, items]) =>
                    items.length > 0 && (
                      <div key={label} className="rounded-xl bg-muted/30 px-3 py-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {label} ({items.length})
                        </p>
                        <ul className="mt-1 space-y-1">
                          {items.map((f) => (
                            <li key={f.ruleKey} className="text-xs">
                              <span className="font-medium">{f.summary}</span>{" "}
                              <span className="text-muted-foreground">· {f.severity}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )
                )}
              </div>
            )}
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
      {!isDesktop && auditId && (
        <WorkspaceHeader
          compact
          dealTitle={dealTitle}
          dealType={dealMeta?.dealType ?? null}
          jurisdiction={dealMeta?.jurisdiction ?? null}
          workspace={workspace}
          auditId={auditId}
          documentCount={documentCount}
          monitoring={monitoring}
        />
      )}
      {coveredMode && (
        <div className="max-h-[45%] shrink-0 overflow-y-auto border-b border-border/60">
          <WorkspaceView
            mode={workspace.mode}
            data={workspaceData}
            auditId={auditId}
            dealType={dealMeta?.dealType ?? null}
            riskLevel={latestRiskPayload?.riskLevel}
            overallScore={latestRiskPayload?.overallScore}
            onAsk={handleAskFinding}
            onGeneratePackage={() => void handleDocumentGenerate("", {})}
            onChanged={handleWorkspaceChanged}
          />
        </div>
      )}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-3xl">
          <MessageList
            messages={messages}
            richMode={coveredMode || (isDesktop && hasRich) ? "hidden" : "inline"}
            onContextConfirm={handleContextConfirm}
            onDocumentGenerate={handleDocumentGenerate}
            onAskFinding={handleAskFinding}
          />
        </div>
      </div>
      <div className="border-t border-border/60 bg-background p-4">
        <div className="mx-auto max-w-3xl">
          <Composer threadId={threadId} auditId={auditId} onMessageSent={handleSent} prefill={prefill} />
        </div>
      </div>
    </>
  )

  // Mobile base: single scrolling column with inline cards. Desktop layer:
  // resizable split with the conversation driving and the structured
  // document in the panel.
  // Heights fill exactly to the viewport bottom: the shell navbar (3.5rem)
  // sits above everything; mobile loses 4rem more to the tab bar (via the
  // shell's main padding) and thread pages lose 3rem to the shell back bar.
  // The message list scrolls independently, so the composer stays pinned at
  // the true bottom.
  if (!isDesktop) {
    return <div className="flex h-[calc(100dvh-10.5rem)] flex-col">{conversation}</div>
  }

  return (
    <div className="flex h-[calc(100dvh-6.5rem)] flex-col">
      <SplitPane
        userId={userId}
        paneKey={`thread-${threadId}`}
        primary={<div className="flex h-full min-h-0 flex-col">{conversation}</div>}
        panel={
          <div className="flex h-full min-h-0 flex-col">
            <WorkspaceHeader
              dealTitle={dealTitle}
              dealType={dealMeta?.dealType ?? null}
              jurisdiction={dealMeta?.jurisdiction ?? null}
              workspace={workspace}
              auditId={auditId}
              documentCount={documentCount}
              monitoring={monitoring}
            />
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
              {coveredMode ? (
                <WorkspaceView
                  mode={workspace.mode}
                  data={workspaceData}
                  auditId={auditId}
                  dealType={dealMeta?.dealType ?? null}
                  riskLevel={latestRiskPayload?.riskLevel}
                  overallScore={latestRiskPayload?.overallScore}
                  onAsk={handleAskFinding}
                  onGeneratePackage={() => void handleDocumentGenerate("",
{})}
                  onChanged={handleWorkspaceChanged}
                />
              ) : (
                <ThreadPanel
                  messages={messages}
                  auditId={auditId}
                  onContextConfirm={handleContextConfirm}
                  onDocumentGenerate={handleDocumentGenerate}
                  onAskFinding={handleAskFinding}
                />
              )}
            </div>
          </div>
        }
      />
    </div>
  )
}
