"use client"

import { useState, useEffect, useCallback, useRef } from "react"
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
import { cn } from "@/lib/utils"

import { Timeline, type TimelineEvent } from "@/components/audit/timeline"
import { analyzeDeal, generateProtectionPackage, updateAudit, getClientProfiles } from "@/app/audit/[id]/actions"
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

type DealType = "freelance" | "generic"

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
}

const PROCESSING_STEPS = [
  "Analyzing project details...",
  "Extracting deliverables...",
  "Identifying signals...",
  "Structuring information...",
  "Evaluating scope risk...",
  "Analyzing payment safety...",
  "Reviewing timeline...",
  "Assessing client behavior...",
]





const MOBILE_STAGES: StageId[] = ["intake", "risk-analysis", "proposal", "sow", "contract", "checklist"]

export function WorkspaceClient({ audit, userId, activityEvents }: WorkspaceClientProps) {
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
  const [processingStep, setProcessingStep] = useState(0)
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
  const [generating, setGenerating] = useState(false)
  const [showExtraction, setShowExtraction] = useState(false)
  const [consented, setConsented] = useState(audit.ai_consent)
  const [consenting, setConsenting] = useState(false)
  const [clientProfiles, setClientProfiles] = useState<ClientProfile[]>([])
  const [clientId, setClientId] = useState<string | null>(audit.client_id)
  const [workspaceTab, setWorkspaceTab] = useState<"report" | "timeline">("report")
  const [titleEditing, setTitleEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(audit.title)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const defaultTitles = ["New Audit", "New Deal"]

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
  const dealType: DealType = (audit.deal_type as DealType) === "generic" ? "generic" : "freelance"
  const isGeneric = dealType === "generic"
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

  const currentStage: StageId = analyzing
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

  const [, setActiveDocTab] = useState<StageId>("proposal")

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
    setEditTitle(audit.title); setTitleEditing(false); setInputType((audit.source_type as InputType) ?? "paste"); setRawInput(audit.raw_input ?? ""); setSaveState("saved"); setConsented(audit.ai_consent); setWorkspaceTab("report"); setActiveDocTab("proposal"); setShowExtraction(false); setClientId(audit.client_id)
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
    setProcessingStep(0)

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

    const stepInterval = setInterval(() => {
      setProcessingStep((prev) => Math.min(prev + 1, PROCESSING_STEPS.length - 1))
    }, 2500)

    try {
      const result = await analyzeDeal(audit.id)
      if (result.success && result.data) {
        setExtractedData(result.data)
        if (result.riskReport) {
          setRiskReport(result.riskReport)
        }
        const newTitle = makeTitleFromExtracted(result.data)
        if (defaultTitles.includes(audit.title) || defaultTitles.includes(editTitle)) {
          await updateAudit(audit.id, { title: newTitle })
          setEditTitle(newTitle)
        }
      } else {
        setError(result.error ?? "Analysis failed")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed")
    } finally {
      clearInterval(stepInterval)
      setAnalyzing(false)
    }
  }

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const result = await generateProtectionPackage(audit.id)
      if (result.success && result.documents) {
        setDocuments(result.documents)
      } else {
        setError(result.error ?? "Generation failed")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed")
    } finally {
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
            documentsExist={hasDocuments}
            onStageClick={handleStageClick}
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
          <span className={cn(
            "ml-auto inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium capitalize",
            audit.status === "draft" && "bg-secondary text-secondary-foreground",
            audit.status === "processing" && "bg-blue-50 text-blue-700",
            audit.status === "analyzed" && "bg-green-50 text-green-700",
            audit.status === "failed" && "bg-red-50 text-red-700",
          )}>
            {audit.status.replace("_", " ")}
          </span>
        </div>
        <div className="flex gap-1 px-3 py-2 overflow-x-auto border-b border-border/60 scrollbar-none">
          {MOBILE_STAGES.map((sid) => {
            const stage = { id: sid, label: sid.charAt(0).toUpperCase() + sid.slice(1).replace("-", " "), description: "" }
            const isCurrent = sid === currentStage
            const isDone = (sid === "intake" && intakeComplete) ||
              (sid === "risk-analysis" && isAnalyzed) ||
              (["proposal", "sow", "contract", "checklist"].includes(sid) && hasDocuments)
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
        <div className="flex-1 overflow-y-auto p-4 pb-20">
          {renderMainContent()}
        </div>
      </div>

      {/* Desktop main content (center panel) */}
      <main className="hidden lg:flex lg:flex-col flex-1 overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-3 border-b border-border/60">
          <div className="flex items-center gap-2">
            <span className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize",
              audit.status === "draft" && "bg-secondary text-secondary-foreground",
              audit.status === "processing" && "bg-blue-50 text-blue-700",
              audit.status === "analyzed" && "bg-green-50 text-green-700",
              audit.status === "failed" && "bg-red-50 text-red-700",
            )}>
              {audit.status.replace("_", " ")}
            </span>
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
              <Button onClick={handleAnalyze} disabled={analyzing}>
                {analyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyzing...
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
          <div className="flex-1 overflow-y-auto p-6">
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
    </div>
  )

  function renderMainContent() {
    if (!consented) {
      return (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="max-w-lg space-y-4">
            <h2 className="text-lg font-semibold">AI Analysis Consent Required</h2>
            <p className="text-sm text-muted-foreground">
              Before analyzing your deal, please note that your project information
              (text and uploaded file contents) will be sent to Google Gemini AI
              for processing. No data is stored or used beyond this analysis.
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
        <div className="flex flex-col items-center justify-center gap-3 py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium">{PROCESSING_STEPS[processingStep]}</p>
          <p className="text-xs text-muted-foreground">
            Processing your project information...
          </p>
        </div>
      )
    }

    if (isFailed) {
      return (
        <div className="flex flex-col items-center gap-3 py-16">
          <AlertCircle className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">We couldn&apos;t complete a full audit.</p>
          <p className="text-xs text-muted-foreground">
            Your inputs were saved. Please try again.
          </p>
          {error && (
            <details className="text-xs text-muted-foreground/60">
              <summary className="cursor-pointer hover:text-foreground">Error details</summary>
              <p className="mt-1">{error}</p>
            </details>
          )}
          <Button variant="outline" size="sm" onClick={handleAnalyze}>
            Retry Analysis
          </Button>
        </div>
      )
    }

    if (isAnalyzed && riskReport) {
      if (isGeneric) {
        return (
          <div className="space-y-6">
            <div className="flex gap-1 border-b">
              <button
                onClick={() => setWorkspaceTab("report")}
                className={cn(
                  "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px",
                  workspaceTab === "report" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                Risk Report
              </button>
              <button
                onClick={() => setWorkspaceTab("timeline")}
                className={cn(
                  "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px",
                  workspaceTab === "timeline" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                Activity Timeline
              </button>
            </div>
            {workspaceTab === "report" ? (
              <div className="space-y-8">
                <GenericRiskReportView report={riskReport as GenericRiskReport} degraded={genericDegraded} />
                <NegotiationPointsView points={negotiationPoints} />
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
            ) : (
              <Timeline events={timelineEvents} />
            )}
          </div>
        )
      }
      return (
        <div className="space-y-6">
          <div className="flex gap-1 border-b">
            <button
              onClick={() => setWorkspaceTab("report")}
              className={cn(
                "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px",
                workspaceTab === "report"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              Risk Report
            </button>
            <button
              onClick={() => setWorkspaceTab("timeline")}
              className={cn(
                "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px",
                workspaceTab === "timeline"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              Activity Timeline
            </button>
          </div>

          {workspaceTab === "report" ? (
            <div className="space-y-8">
              <RiskReportView report={riskReport as RiskReport} />

              {generating && !hasDocuments && (
                <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <p className="text-sm font-medium">Generating protection package...</p>
                  </div>
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
        <>
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
        </>
      )
    }

    return null
  }
}
