"use client"

import { useState, useEffect, useCallback, useRef, useMemo, type ReactNode } from "react"
import {
  ArrowLeft, Calendar, Sparkles, Loader2, AlertCircle,
  ChevronDown, ChevronRight, ShieldCheck, Save, Check, Pencil,
} from "lucide-react"
import Link from "next/link"
import { InputTypeSelector, type InputType } from "@/components/audit/input-type-selector"
import { PasteInput } from "@/components/audit/paste-input"
import { FileUpload } from "@/components/audit/file-upload"
import { GuidedForm } from "@/components/audit/guided-form"
import { ExtractionResults } from "@/components/audit/extraction-results"
import { RiskReportView } from "@/components/audit/risk-report"
import { GenericRiskReportView } from "@/components/audit/generic-risk-report"
import { NegotiationPointsView } from "@/components/audit/negotiation-points"
import { ProtectionPackage } from "@/components/audit/protection-package"
import { StageStepper, type StageId } from "@/components/audit/stage-stepper"
import { ContextualPanel } from "@/components/audit/contextual-panel"
import { ErrorBoundary } from "@/components/error-boundary"
import { Button } from "@/components/ui/button"
import { AiWorking } from "@/components/ui/ai-working"
import { ErrorPanel } from "@/components/ui/error-panel"
import { StageBanner, DealStateBadge } from "@/components/audit/stage-banner"
import { dealStage } from "@/lib/deal/stage"
import { cn } from "@/lib/utils"

import { Timeline, type TimelineEvent } from "@/components/audit/timeline"
import { canGenerateDocuments, documentGenerationUnavailableMessage } from "@/lib/protection"
import { ProtectionIntentsView } from "@/components/audit/protection-intents"
import { BusinessOwnerDocumentSection } from "@/components/audit/business-owner-document"
import { analyzeDeal, generateProtectionPackage, updateAudit, getClientProfiles } from "@/app/audit/[id]/actions"
import { publicErrorMessage } from "@/lib/safe-error"
import { createConsultationRequest, getVerifiedLawyersCount } from "@/app/audit/[id]/consultation-actions"
import { LawyerEscalationCard } from "@/components/audit/lawyer-escalation"
import { LawyerHandoffReview } from "@/components/audit/lawyer-handoff-review"
import { ReviewPanel } from "@/components/audit/review-panel"
import { FinalDocumentsPanel } from "@/components/audit/final-documents"
import { ContextPanel } from "@/components/audit/context-panel"
import { FindingsPanel, parsePersistedFindings } from "@/components/audit/findings-panel"
import { getAllDocumentsForAudit } from "@/lib/documents/vault"
import type { RuleResult } from "@/lib/rules/result"
import { protectionIntentsFromFindings } from "@/lib/protection/intents"
import { clausesForDealType } from "@/lib/protection/clauses"
import { buildHandoffPackage } from "@/lib/consultation/handoff"
import { parseContextEnvelope, type ContextEnvelope } from "@/lib/context/schema"
import type { ExtractedData } from "@/lib/ai/extract"
import type { RiskReport } from "@/lib/risk/engine"
import type { GenericRiskReport } from "@/lib/ai/risk-analysis"
import type { GeneratedDocument } from "@/lib/generate"

interface ClientProfile {
  id: string
  name: string
  company: string | null
  email: string | null
}

type DealType = "freelance" | "generic" | "lease" | "purchase_sale" | "employment" | "founder" | "partnership"

interface AuditData {
  id: string
  title: string
  status: string
  created_at: string
  raw_input: string | null
  source_type: string | null
  structured_data: Record<string, unknown> | null
  risk_report: unknown
  overall_score: number | null
  ai_consent: boolean
  client_id: string | null
  deal_type: DealType | null
  context_envelope: unknown
}

interface UploadedFile {
  name: string
  size: number
  type: string
  path: string
  uploaded_at: string
}

interface ActivityEventRow {
  id: string
  event_type: string
  payload: Record<string, unknown>
  created_at: string
}

interface WorkspaceClientProps {
  audit: AuditData
  userId: string
  activityEvents?: ActivityEventRow[]
  hasVersions?: boolean
}

const MOBILE_STAGES: StageId[] = ["intake", "risk-analysis", "proposal", "sow", "contract", "checklist"]

const MOBILE_STAGES_BY_DEAL_TYPE: Record<string, StageId[]> = {
  freelance: MOBILE_STAGES,
  founder: ["intake", "risk-analysis", "documents"],
  partnership: ["intake", "risk-analysis", "documents"],
  purchase_sale: ["intake", "risk-analysis", "documents"],
  lease: ["intake", "risk-analysis", "documents"],
  employment: ["intake", "risk-analysis", "documents"],
  generic: ["intake", "risk-analysis"],
}

export function WorkspaceClient({ audit, userId, activityEvents, hasVersions = false }: WorkspaceClientProps) {
  const [inputType, setInputType] = useState<InputType>(
    (audit.source_type as InputType) ?? "paste"
  )
  const [rawInput, setRawInput] = useState(audit.raw_input ?? "")
  const [saveState, setSaveState] = useState<"saved" | "unsaved" | "saving" | "error">("saved")
  const [lastSaved, setLastSaved] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    project_type: ((audit.structured_data as Record<string, string>)?.project_type ?? "") as string,
    budget: ((audit.structured_data as Record<string, string>)?.budget ?? "") as string,
    timeline: ((audit.structured_data as Record<string, string>)?.timeline ?? "") as string,
    deliverables: ((audit.structured_data as Record<string, string>)?.deliverables ?? "") as string,
    notes: ((audit.structured_data as Record<string, string>)?.notes ?? "") as string,
  })
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(
    ((audit.structured_data as Record<string, unknown>)?.extractedData as ExtractedData | undefined) ?? null
  )
  const [riskReport, setRiskReport] = useState<RiskReport | GenericRiskReport | null>(
    audit.risk_report as RiskReport | GenericRiskReport | null
  )
  const [documents, setDocuments] = useState<GeneratedDocument[]>(
    ((audit.structured_data as Record<string, unknown>)?.generatedDocuments as GeneratedDocument[] | undefined) ?? []
  )
  const [ruleResults, setRuleResults] = useState<RuleResult[]>(() =>
    parsePersistedFindings((audit.structured_data as Record<string, unknown>)?.deterministicFindings)
  )
  const [generating, setGenerating] = useState(false)
  const [showExtraction, setShowExtraction] = useState(false)
  const [consented, setConsented] = useState(audit.ai_consent)
  const [consenting, setConsenting] = useState(false)
  const [clientProfiles, setClientProfiles] = useState<ClientProfile[]>([])
  const [clientId, setClientId] = useState<string | null>(audit.client_id)
  const [workspaceTab, setWorkspaceTab] = useState<"overview" | "vault" | "activity">("overview")
  const [titleEditing, setTitleEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(audit.title)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const defaultTitles = ["New Audit", "New Deal"]
  const [showHandoff, setShowHandoff] = useState(false)
  const [handoffPackage, setHandoffPackage] = useState<ReturnType<typeof buildHandoffPackage> | null>(null)
  const [handoffSubmitted, setHandoffSubmitted] = useState<string | null>(null)

  function makeTitleFromInput(text: string): string {
    return text.trim().slice(0, 60).replace(/\s+\S*$/, "").replace(/[,;:.!?]+$/, "").trim() || "Untitled"
  }

  function makeTitleFromExtracted(data: ExtractedData): string {
    const parts = [data.projectType, data.deliverables[0]].filter(Boolean) as string[]
    return parts.length > 0 ? parts.join(": ").slice(0, 60) : "Untitled Deal"
  }

  const structured = audit.structured_data as Record<string, unknown> | null
  const uploadedFiles = (structured?.files as UploadedFile[] | undefined) ?? []
  const riskLevel = riskReport?.riskLevel ?? null
  const hasContent = Boolean(rawInput) || uploadedFiles.length > 0
  const isAnalyzed = audit.status === "analyzed" && (extractedData !== null || riskReport !== null)
  const isFailed = audit.status === "failed" && !isAnalyzed
  const hasDocuments = documents.length > 0
  const dealTypeRaw = audit.deal_type as DealType
  const dealType: DealType =
    dealTypeRaw === "generic" || dealTypeRaw === "lease" || dealTypeRaw === "purchase_sale" || dealTypeRaw === "employment" || dealTypeRaw === "founder" || dealTypeRaw === "partnership"
      ? dealTypeRaw
      : "freelance"
  // Lease, purchase/sale, and employment analyses produce the adaptive
  // generic-shaped report, so they share the generic report view; only
  // freelance uses the 8-category view.
  const isGeneric = dealType !== "freelance"
  const canGenerate = canGenerateDocuments(dealType)
  // Stored envelope validated defensively: malformed data renders as
  // "no context yet" and is reseeded by ensureContextForAnalysis on analyze.
  let initialContext: ContextEnvelope | null = null
  try {
    initialContext =
      audit.context_envelope === null || audit.context_envelope === undefined
        ? null
        : parseContextEnvelope(audit.context_envelope)
  } catch {
    initialContext = null
  }
  const jurisdictionForProtection = useMemo(() => {
    const f = initialContext?.fields.jurisdiction
    if (f && f.source !== "unknown" && typeof f.value === "string" && (f.value as string).trim().length > 0) {
      return { scope: "country" as const, country: f.value as string, region: null as string | null }
    }
    return null
  }, [initialContext]) // eslint-disable-line react-hooks/preserve-manual-memoization -- jurisdiction stable per audit load
  const negotiationPoints = (structured?.negotiationPoints as string[] | undefined) ?? []
  const genericDegraded = (structured?.genericRiskDegraded as boolean | undefined) ?? false
  const isDirty = saveState === "unsaved" || saveState === "saving"
  const intakeComplete = hasContent

  const timelineEvents: TimelineEvent[] = activityEvents && activityEvents.length > 0
    ? activityEvents.map((e) => {
        const typeMap: Record<string, TimelineEvent["type"]> = {
          deal_created: "deal_created",
          input_added: "input_added",
          analysis_started: "risk_analyzed",
          analysis_completed: "risk_analyzed",
          analysis_failed: "risk_analyzed",
          documents_generated: "document_generated",
          status_changed: "deal_created",
          title_changed: "deal_created",
          file_attached: "input_added",
          document_viewed: "document_generated",
          document_reviewed: "document_generated",
          risk_flag_raised: "risk_analyzed",
          checklist_item_updated: "document_generated",
        }
        const labelMap: Record<string, string> = {
          deal_created: "Deal created",
          input_added: "Client brief added",
          analysis_started: "Risk analysis started",
          analysis_completed: "Risk analysis completed",
          analysis_failed: "Risk analysis failed",
          documents_generated: "Protection package generated",
          status_changed: "Status changed",
          title_changed: "Title changed",
          file_attached: "File attached",
          risk_flag_raised: "Risk flag raised",
          checklist_item_updated: "Checklist item updated",
        }
        return {
          id: e.id,
          type: typeMap[e.event_type] ?? "deal_created",
          label: labelMap[e.event_type] ?? e.event_type,
          description: e.payload.score ? `Score ${e.payload.score}/100 — ${e.payload.riskLevel}` : undefined,
          timestamp: e.created_at,
        }
      })
    : [
      {
        id: `${audit.id}-created`,
        type: "deal_created",
        label: "Deal created",
        timestamp: audit.created_at,
      },
      ...(audit.raw_input
        ? [{
            id: `${audit.id}-input`,
            type: "input_added" as const,
            label: "Client brief added",
            timestamp: audit.created_at,
            description: audit.source_type === "upload" ? "via file upload" : "via paste or form",
          }]
        : []),
      ...(isAnalyzed
        ? [{
            id: `${audit.id}-analyzed`,
            type: "risk_analyzed" as const,
            label: "Risk analysis completed",
            timestamp: audit.created_at,
            description: riskReport ? `Score ${riskReport.overallScore}/100 — ${riskReport.riskLevel} Risk` : undefined,
          }]
        : []),
      ...(documents.map((d) => ({
        id: `${audit.id}-doc-${d.type}`,
        type: "document_generated" as const,
        label: `${d.type.charAt(0).toUpperCase() + d.type.slice(1)} generated`,
        timestamp: d.createdAt,
      }))),
    ]

  const hasAnyDocuments = hasDocuments || hasVersions
  // Freelance keeps the proposal/sow/contract/checklist pipeline; every other
  // deal type uses the neutral Intake → Analysis → Documents model so the UI
  // never implies pipeline stages the backend does not have.
  const currentStage: StageId =
    dealType === "freelance"
      ? analyzing
        ? "risk-analysis"
        : isFailed
        ? (!hasContent ? "intake" : "risk-analysis")
        : hasDocuments
        ? "checklist"
        : riskReport
        ? "risk-analysis"
        : consented
        ? "intake"
        : "intake"
      : analyzing
      ? "risk-analysis"
      : isFailed
      ? (!hasContent ? "intake" : "risk-analysis")
      : hasAnyDocuments
      ? "documents"
      : riskReport
      ? "risk-analysis"
      : "intake"

  const [, setActiveDocTab] = useState<StageId>("proposal")

  // Deal-level stage for the banner: derived from the same server state as
  // the stepper, plus real outputs. Hidden during consent/analyzing/failed,
  // which already own the full view.
  const stage = useMemo(
    () =>
      dealStage({
        status: audit.status,
        hasContent,
        hasRisk: riskReport !== null,
        docsGenerated: documents.length > 0,
        hasVersions,
      }),
    [audit.status, hasContent, riskReport, documents.length, hasVersions]
  )
  const showBanner = consented && !analyzing && !isFailed

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault()
      }
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [isDirty])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEditTitle(audit.title); setTitleEditing(false); setInputType((audit.source_type as InputType) ?? "paste"); setRawInput(audit.raw_input ?? ""); setSaveState("saved"); setConsented(audit.ai_consent); setWorkspaceTab("overview"); setActiveDocTab("proposal"); setShowExtraction(false); setClientId(audit.client_id)
  }, [audit.id])

  useEffect(() => {
    getClientProfiles().then((res) => {
      if (res.success && res.profiles) {
        setClientProfiles(res.profiles)
      }
    })
  }, [])

  const handleChangeClientId = useCallback(async (id: string | null) => {
    setClientId(id)
    try {
      await updateAudit(audit.id, { client_id: id })
    } catch {
      // restore on failure
      setClientId(audit.client_id)
    }
  }, [audit.id, audit.client_id])

  const handleSave = useCallback(async () => {
    setSaveState("saving")
    try {
      const updates: Record<string, unknown> = {}
      if (inputType === "paste") {
        updates.raw_input = rawInput || null
        updates.source_type = rawInput ? "paste" : null
        if (rawInput && defaultTitles.includes(editTitle)) {
          updates.title = makeTitleFromInput(rawInput)
          setEditTitle(updates.title as string)
        }
      } else if (inputType === "form") {
        updates.source_type = "form"
        updates.structured_data = formData as unknown as Record<string, unknown>
        if (formData.project_type && defaultTitles.includes(editTitle)) {
          updates.title = formData.project_type.slice(0, 60)
          setEditTitle(updates.title as string)
        }
      }
      await updateAudit(audit.id, updates)
      setSaveState("saved")
      setLastSaved(new Date().toISOString())
    } catch {
      setSaveState("error")
    }
  }, [audit.id, inputType, rawInput, formData, editTitle])

  const handleRawInputChange = useCallback((text: string) => {
    setRawInput(text)
    setSaveState("unsaved")
  }, [])

  const handleFormChange = useCallback((fields: typeof formData) => {
    setFormData(fields)
    setSaveState("unsaved")
  }, [])

  const handleAnalyze = async () => {
    setAnalyzing(true)
    setError(null)
    // Intentional minimum presentation: the working state stays visible
    // briefly even for fast runs so completion never flashes. Small,
    // fixed, and unrelated to actual model time.
    const startedAt = Date.now()

    if (rawInput.trim() && saveState !== "saved") {
      try {
        setSaveState("saving")
        const updates: Record<string, unknown> = { raw_input: rawInput, source_type: "paste" }
        if (defaultTitles.includes(editTitle)) {
          updates.title = makeTitleFromInput(rawInput)
          setEditTitle(updates.title as string)
        }
        await updateAudit(audit.id, updates)
        setSaveState("saved")
        setLastSaved(new Date().toISOString())
      } catch {
        setSaveState("error")
        setError("Failed to save content. Please try again.")
        setAnalyzing(false)
        return
      }
    }

    try {
      const result = await analyzeDeal(audit.id)
      if (result.success && result.data) {
        setExtractedData(result.data)
        if (result.riskReport) {
          setRiskReport(result.riskReport)
        }
        if (Array.isArray(result.deterministicFindings)) {
          setRuleResults(parsePersistedFindings(result.deterministicFindings))
        }
        const newTitle = makeTitleFromExtracted(result.data)
        if (defaultTitles.includes(audit.title) || defaultTitles.includes(editTitle)) {
          await updateAudit(audit.id, { title: newTitle })
          setEditTitle(newTitle)
        }
      } else {
        setError(publicErrorMessage(result.error ?? "Analysis failed", "We couldn't analyze that right now. Please try again."))
      }
    } catch (err) {
      setError(publicErrorMessage(err, "We couldn't analyze that right now. Please try again."))
    } finally {
      const elapsed = Date.now() - startedAt
      if (elapsed < 900) await new Promise((r) => setTimeout(r, 900 - elapsed))
      setAnalyzing(false)
    }
  }

  const handleGenerate = async () => {
    setGenerating(true)
    const startedAt = Date.now()
    try {
      const result = await generateProtectionPackage(audit.id)
      if (result.success && result.documents) {
        setDocuments(result.documents)
      } else {
        setError(publicErrorMessage(result.error ?? "Generation failed", "We couldn't generate those documents. Please try again."))
      }
    } catch (err) {
      setError(publicErrorMessage(err, "We couldn't generate those documents. Please try again."))
    } finally {
      const elapsed = Date.now() - startedAt
      if (elapsed < 900) await new Promise((r) => setTimeout(r, 900 - elapsed))
      setGenerating(false)
    }
  }

  const handleRegenerate = async () => {
    await handleGenerate()
  }

  const handleConsent = async () => {
    setConsenting(true)
    try {
      await updateAudit(audit.id, { ai_consent: true })
      setConsented(true)
    } catch {
      setError("Failed to save consent. Please try again.")
    } finally {
      setConsenting(false)
    }
  }

  function handleOpenHandoff() {
    // Build from already-authoritative outputs — no re-analysis; jurisdiction is explicit, never silently Nigeria
    const jurisdictionForHandoff = jurisdictionForProtection ?? ({ scope: "custom" as const, country: "UNKNOWN", region: null as string | null } as const)
    const intents = protectionIntentsFromFindings(dealType, ruleResults, jurisdictionForHandoff as never)
    const clauses = clausesForDealType(dealType)
    const jurisdiction = jurisdictionForHandoff
    // Legal citations: jurisdiction-aware intent legalContext only (never another
    // jurisdiction's law); for UNKNOWN jurisdiction, honestly no verified citations
    const legalCitations = intents.map((i) => i.legalContext).filter((c): c is NonNullable<typeof c> => c !== null)
    // Also include any document draft provenance if available (not yet persisted in this phase — nullable)
    const pkg = buildHandoffPackage(
      {
        audit: { id: audit.id, deal_type: dealType, title: editTitle, raw_input: audit.raw_input },
        jurisdiction,
        facts: (structured?.extractedData as Record<string, unknown> | null) ?? null,
        findings: ruleResults,
        riskReport: riskReport as unknown as { overallScore?: number | null; riskLevel?: string | null } | null,
        protectionIntents: intents,
        clauses,
        draft: null, // draft is generated separately via BusinessOwnerDocumentSection; handoff remains usable without it
        legalCitations,
      },
      new Date()
    )
    // Preserve honest jurisdiction handling: if UNKNOWN, do not invent Nigeria
    setHandoffPackage(pkg)
    setShowHandoff(true)
  }

  const handleStageClick = (stage: StageId) => {
    if (stage === "intake" || stage === "risk-analysis") {
      // Allowed to navigate to these
    }
  }

  const saveButtonLabel = saveState === "saving" ? "Saving..." :
    saveState === "unsaved" ? "Save" :
    saveState === "saved" ? "Saved" :
    "Save"

  const saveButtonIcon = saveState === "saving" ? (
    <Loader2 className="h-4 w-4 animate-spin" />
  ) : saveState === "saved" ? (
    <Check className="h-4 w-4" />
  ) : (
    <Save className="h-4 w-4" />
  )

  return (
    <div className="flex h-screen">
      {/* Desktop stage stepper (left panel) */}
      <aside className="hidden lg:flex lg:flex-col w-56 shrink-0 border-r border-border/60 bg-background overflow-y-auto">
        <div className="p-4 border-b border-border/60">
          <Link
            href="/dashboard"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Dashboard
          </Link>
          {titleEditing ? (
            <input
              ref={titleInputRef}
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={async () => {
                setTitleEditing(false)
                if (editTitle.trim()) {
                  await updateAudit(audit.id, { title: editTitle.trim() })
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur()
                if (e.key === "Escape") { setTitleEditing(false) }
              }}
              className="text-sm font-semibold w-full bg-muted rounded px-1 py-0.5 outline-none ring-1 ring-border"
              autoFocus
            />
          ) : (
            <h2 className="text-sm font-semibold truncate group cursor-pointer" onClick={() => setTitleEditing(true)}>
              {editTitle}
              <Pencil className="h-3 w-3 inline ml-1.5 text-muted-foreground/40 group-hover:text-muted-foreground/80 transition-colors" />
            </h2>
          )}
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {new Date(audit.created_at).toLocaleDateString()}
          </div>
        </div>
        <div className="p-3">
          <StageStepper
            currentStage={currentStage}
            intakeComplete={intakeComplete}
            riskComplete={isAnalyzed}
            documentsExist={hasAnyDocuments}
            onStageClick={handleStageClick}
            dealType={dealType}
          />
        </div>
      </aside>

      {/* Mobile top bar + stage strip */}
      <div className="flex flex-1 flex-col min-w-0 lg:hidden">
        <div className="flex items-center gap-2 px-4 h-10 border-b border-border/60">
          <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <span className="text-sm font-medium truncate">{editTitle}</span>
          <span className="ml-auto">
            <DealStateBadge status={audit.status} />
          </span>
        </div>
        <div className="flex gap-1 px-3 py-2 overflow-x-auto border-b border-border/60 scrollbar-none">
          {(MOBILE_STAGES_BY_DEAL_TYPE[dealType] ?? MOBILE_STAGES).map((sid) => {
            const stage = { id: sid, label: sid.charAt(0).toUpperCase() + sid.slice(1).replace("-", " "), description: "" }
            const isCurrent = sid === currentStage
            const isDone = (sid === "intake" && intakeComplete) ||
              (sid === "risk-analysis" && isAnalyzed) ||
              (["proposal", "sow", "contract", "checklist"].includes(sid) && hasDocuments) ||
              (sid === "documents" && hasAnyDocuments)
            return (
              <button
                key={sid}
                onClick={() => handleStageClick(sid)}
                className={cn(
                  "shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors",
                  isCurrent && "bg-primary text-primary-foreground",
                  isDone && !isCurrent && "bg-primary/10 text-primary",
                  !isCurrent && !isDone && "text-muted-foreground bg-muted/50"
                )}
              >
                {stage.label}
              </button>
            )
          })}
        </div>

        {/* Mobile main content */}
        <div className="flex-1 overflow-y-auto p-4 pb-20" aria-busy={analyzing || generating}>
          {showBanner && (
            <div className="mb-4">
              <StageBanner stage={stage} />
            </div>
          )}
          {renderMainContent()}
        </div>
      </div>

      {/* Desktop main content (center panel) */}
      <main className="hidden lg:flex lg:flex-col flex-1 overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-3 border-b border-border/60">
          <div className="flex items-center gap-2">
            <DealStateBadge status={audit.status} />
            {lastSaved && saveState === "saved" && (
              <span className="text-xs text-muted-foreground">
                Saved {new Date(lastSaved).toLocaleTimeString()}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {saveState !== "saved" && !isAnalyzed && !isFailed && consented && (
              <Button
                variant={saveState === "unsaved" ? "default" : "outline"}
                size="sm"
                onClick={handleSave}
                disabled={saveState === "saving"}
              >
                {saveButtonIcon}
                {saveButtonLabel}
              </Button>
            )}
            {hasContent && !isAnalyzed && (
              <Button onClick={handleAnalyze} disabled={analyzing} aria-busy={analyzing}>
                {analyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyze Deal
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Analyze Deal
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6" aria-busy={analyzing || generating}>
            {showBanner && (
              <div className="mb-5">
                <StageBanner stage={stage} />
              </div>
            )}
            {renderMainContent()}
          </div>

          {/* Contextual panel (right panel) */}
          <aside className="w-64 shrink-0 border-l border-border/60 overflow-y-auto p-4">
            <ContextualPanel
              riskReport={riskReport}
              overallScore={audit.overall_score}
              riskLevel={riskLevel}
            />
          </aside>
        </div>
      </main>
      {showHandoff && handoffPackage && (
        <LawyerHandoffReview handoff={handoffPackage} auditId={audit.id} onClose={() => setShowHandoff(false)} onSubmitted={(status) => { setHandoffSubmitted(status); setShowHandoff(false) }} />
      )}
    </div>
  )

  function renderTabBar() {
    const tabs = [
      { id: "overview" as const, label: "Overview" },
      { id: "vault" as const, label: "Vault" },
      { id: "activity" as const, label: "Activity" },
    ]
    return (
      <div className="flex gap-1 border-b">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setWorkspaceTab(t.id)}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px",
              workspaceTab === t.id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
    )
  }

  function renderVaultTab(docUI: ReactNode) {
    const listing = getAllDocumentsForAudit({
      rawInput: audit.raw_input,
      files: uploadedFiles,
      documents,
      hasVersions,
      hasRiskSnapshot: riskReport !== null,
      hasHandoff: handoffSubmitted !== null || handoffPackage !== null,
    })
    return (
      <div className="space-y-8">
        {listing.sections.includes("source") && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Source</h2>
            {listing.hasSourceText && (
              <div className="rounded-xl border border-border/60 bg-card p-5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Deal input — read only</p>
                <p className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed">{audit.raw_input}</p>
              </div>
            )}
            {listing.fileCount > 0 && (
              <ul className="space-y-1.5">
                {uploadedFiles.map((f) => (
                  <li key={f.path} className="flex items-center gap-2 rounded-lg border border-border/60 bg-card px-3 py-2 text-sm">
                    <span className="truncate">{f.name}</span>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">{(f.size / 1024).toFixed(0)} KB</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
        {listing.sections.includes("drafts") && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Generated drafts</h2>
            {listing.draftCount > 0 && (
              <ul className="space-y-1.5">
                {documents.map((d) => (
                  <li key={d.id} className="flex items-center gap-2 rounded-lg border border-border/60 bg-card px-3 py-2 text-sm">
                    <span className="font-medium capitalize">{d.type.replace(/_/g, " ")}</span>
                    <span className="truncate text-muted-foreground">{d.title}</span>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">{new Date(d.createdAt).toLocaleDateString()}</span>
                  </li>
                ))}
              </ul>
            )}
            {hasVersions && listing.draftCount === 0 && (
              <p className="text-xs text-muted-foreground">Versioned drafts exist for this deal and are shown below.</p>
            )}
          </section>
        )}
        <section className="space-y-4 scroll-mt-20" id="deal-documents">
          {docUI}
          <FinalDocumentsPanel auditId={audit.id} auditStatus={audit.status ?? "draft"} />
        </section>
        {listing.sections.includes("risk") && riskReport && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Risk report snapshot</h2>
            <div className="rounded-xl border border-border/60 bg-card p-5">
              <p className="text-sm">
                Score <span className="font-semibold tabular-nums" data-numeric>{riskReport.overallScore}</span>/100 — {riskReport.riskLevel} Risk
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{riskReport.summary}</p>
            </div>
          </section>
        )}
        {listing.sections.includes("handoff") && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Lawyer handoff snapshot</h2>
            <div className="rounded-xl border border-border/60 bg-card p-5">
              <p className="text-xs text-muted-foreground">
                {handoffSubmitted ? `Request submitted — ${handoffSubmitted}.` : "Handoff package prepared for lawyer review."} Findings, protection plan, evidence, and legal context travel with the request.
              </p>
            </div>
          </section>
        )}
        <div className="scroll-mt-20" id="deal-review">
          <ReviewPanel auditId={audit.id} />
        </div>
      </div>
    )
  }

  function renderMainContent() {
    if (!consented) {
      return (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="max-w-lg space-y-4">
            <h2 className="text-lg font-semibold">AI Analysis Consent Required</h2>
            <p className="text-sm text-muted-foreground">
              Before analyzing your deal, please note that your project information
              (text and uploaded file contents) will be processed by Dealenz AI
              for this analysis. No data is stored or used beyond this analysis.
            </p>
            <Button onClick={handleConsent} disabled={consenting} size="lg">
              {consenting && <Loader2 className="h-4 w-4 animate-spin" />}
              I Understand &amp; Consent
            </Button>
          </div>
        </div>
      )
    }

    if (analyzing) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 py-20">
          <AiWorking label="Analyzing your deal" />
          <p className="text-xs text-muted-foreground">
            Reading your project information and checking it for risk.
          </p>
        </div>
      )
    }

    if (isFailed) {
      return (
        <div className="py-10">
          <ErrorPanel
            title="We couldn't finish the analysis."
            body="Your deal is safe and your inputs were saved. This sometimes happens when the AI provider is unavailable."
            chargeNote="Nothing was charged for this attempt."
            retryLabel="Try again"
            onRetry={() => void handleAnalyze()}
          />
          {error && (
            <details className="mt-3 text-xs text-muted-foreground/60">
              <summary className="cursor-pointer hover:text-foreground">Error details</summary>
              <p className="mt-1">{error}</p>
            </details>
          )}
        </div>
      )
    }

    if (isAnalyzed && riskReport) {
      if (isGeneric) {
        const docUI = (dealType === "founder" || dealType === "partnership" || dealType === "purchase_sale" || dealType === "lease" || dealType === "employment") ? (
          <BusinessOwnerDocumentSection auditId={audit.id} dealType={dealType} />
        ) : (
          <div className="rounded-xl border border-border/60 bg-card p-5">
            <h3 className="text-sm font-semibold">Protection package</h3>
            <p className="mt-1 text-xs text-muted-foreground">{documentGenerationUnavailableMessage(dealType)}</p>
            <Link href={`/ask?deal=${encodeURIComponent(audit.id)}`} className="mt-3 inline-flex text-xs font-medium text-primary hover:underline">Ask about this deal →</Link>
          </div>
        )
        return (
          <div className="space-y-6">
            {renderTabBar()}
            {workspaceTab === "overview" ? (
              <div className="space-y-8">
                <GenericRiskReportView report={riskReport as GenericRiskReport} degraded={genericDegraded} />
                <section className="space-y-4 scroll-mt-20" id="deal-protection">
                  <h2 className="text-sm font-semibold">Protection</h2>
                  <div>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">What to negotiate</h3>
                    <div className="mt-3 space-y-4">
                      <FindingsPanel auditId={audit.id} results={ruleResults} />
                      <NegotiationPointsView points={negotiationPoints} />
                      {(dealType === "founder" || dealType === "partnership" || dealType === "purchase_sale" || dealType === "lease" || dealType === "employment") && (
                        <ProtectionIntentsView dealType={dealType} findings={ruleResults} auditId={audit.id} jurisdiction={jurisdictionForProtection} />
                      )}
                    </div>
                  </div>
                </section>
                {(dealType === "founder" || dealType === "partnership" || dealType === "purchase_sale" || dealType === "lease" || dealType === "employment") && (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
                    <h3 className="text-sm font-semibold">Have a lawyer review this deal</h3>
                    <p className="mt-1 text-xs text-muted-foreground">Dealenz has organized the deal, identified material issues, and prepared the relevant protection and document context for review.</p>
                    {handoffSubmitted ? (
                      <p className="mt-3 text-xs font-medium text-success">Request submitted — {handoffSubmitted}. We will notify you when a lawyer is available.</p>
                    ) : (
                      <Button onClick={handleOpenHandoff} className="mt-3" size="sm">
                        <ShieldCheck className="mr-2 h-4 w-4" />
                        Review with lawyer
                      </Button>
                    )}
                  </div>
                )}
                {extractedData && (
                  <ErrorBoundary>
                    <div>
                      <button onClick={() => setShowExtraction(!showExtraction)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
                        {showExtraction ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        Extraction details
                      </button>
                      {showExtraction && (
                        <div className="mt-3">
                          <ExtractionResults data={extractedData} />
                        </div>
                      )}
                    </div>
                  </ErrorBoundary>
                )}
              </div>
            ) : workspaceTab === "vault" ? (
              renderVaultTab(docUI)
            ) : (
              <Timeline events={timelineEvents} />
            )}
          </div>
        )
      }
      const freelanceDocUI = canGenerate ? (
        <>
          {generating && !hasDocuments && (
            <div className="rounded-xl border border-border bg-card p-5 shadow-surface">
              <AiWorking label="Generating your protection package" />
            </div>
          )}

          {!hasDocuments && !generating && (
            <div className="flex justify-center">
              <Button onClick={handleGenerate} size="lg">
                <ShieldCheck className="h-4 w-4" />
                Generate Protection Package
              </Button>
            </div>
          )}

          {hasDocuments && (
            <ErrorBoundary>
              <ProtectionPackage
                documents={documents}
                onRegenerate={handleRegenerate}
                regenerating={generating}
                riskScore={riskReport?.overallScore}
                riskLevel={riskLevel}
                auditId={audit.id}
              />
            </ErrorBoundary>
          )}
        </>
      ) : (
        <div className="rounded-xl border border-border/60 bg-card p-5">
          <p className="text-xs text-muted-foreground">{documentGenerationUnavailableMessage(dealType)}</p>
        </div>
      )
      return (
        <div className="space-y-6">
          {renderTabBar()}

          {workspaceTab === "overview" ? (
            <div className="space-y-8">
              <RiskReportView report={riskReport as RiskReport} />

              <section className="space-y-4 scroll-mt-20" id="deal-protection">
                <h2 className="text-sm font-semibold">Protection</h2>
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">What to negotiate</h3>
                  <div className="mt-3">
                    <FindingsPanel auditId={audit.id} results={ruleResults} />
                  </div>
                </div>
              </section>

              <div className="scroll-mt-20" id="deal-review">
                <LawyerEscalationCard
                  auditId={audit.id}
                  dealType={dealType}
                  riskLevel={riskLevel}
                />
              </div>

              {extractedData && (
                <ErrorBoundary>
                  <div>
                    <button
                      onClick={() => setShowExtraction(!showExtraction)}
                      className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showExtraction ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      Extraction details
                    </button>
                    {showExtraction && (
                      <div className="mt-3">
                        <ExtractionResults data={extractedData} />
                      </div>
                    )}
                  </div>
                </ErrorBoundary>
              )}
            </div>
          ) : workspaceTab === "vault" ? (
            renderVaultTab(freelanceDocUI)
          ) : (
            <Timeline events={timelineEvents} />
          )}
        </div>
      )
    }

    if (isAnalyzed && !riskReport && extractedData) {
      return <ExtractionResults data={extractedData} />
    }

    if (consented) {
      return (
        <div id="deal-intake" className="scroll-mt-20">
          {!hasContent && (
            <div className="mb-6">
              <InputTypeSelector value={inputType} onChange={setInputType} />
            </div>
          )}

          {inputType === "paste" && (
            <PasteInput
              value={rawInput}
              onChange={handleRawInputChange}
              saveState={saveState}
            />
          )}

          {inputType === "upload" && (
            <FileUpload
              auditId={audit.id}
              userId={userId}
              initialFiles={uploadedFiles}
            />
          )}

          {inputType === "form" && (
            <GuidedForm
              value={formData}
              onChange={handleFormChange}
              clientProfiles={clientProfiles}
              clientId={clientId}
              onChangeClientId={handleChangeClientId}
            />
          )}

          {error && (
            <div className="mt-4 flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
              <button className="ml-auto font-medium hover:underline" onClick={() => setError(null)}>
                Dismiss
              </button>
            </div>
          )}

          <div className="mt-6">
            <ContextPanel auditId={audit.id} dealType={dealType} initialEnvelope={initialContext} />
          </div>
        </div>
      )
    }

    return null
  }
}
