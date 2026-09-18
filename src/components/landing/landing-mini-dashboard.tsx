"use client"

import { useState, useCallback, useEffect } from "react"
import { Upload, FileText, Sparkles, Loader2, CheckCircle2, Shield, ShieldAlert, ShieldMinus, Lightbulb, Scale, Gavel, Timer, DollarSign, MessageSquare, RefreshCw, UserX, ChevronRight, X, Send } from "lucide-react"

const rotatingPlaceholders = [
  "Paste your deal, upload a file, or just tell us what is going on...",
  "Try: 8 week website build, no deposit, unlimited revisions promised...",
  "Example: Client wants all IP before final payment. Is that normal...",
]
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AiWorking } from "@/components/ui/ai-working"
import { publicErrorMessage } from "@/lib/safe-error"
import Link from "next/link"

type InputMode = "paste" | "upload" | "describe"

interface RiskCategory {
  score: number
  severity: "low" | "medium" | "high"
  findings: Array<{ title: string; description: string; evidence: string }>
  mitigations: string
}

interface RiskReport {
  overallScore: number
  riskLevel: "Low" | "Medium" | "High"
  categories: {
    scopeRisk: RiskCategory
    paymentRisk: RiskCategory
    timelineRisk: RiskCategory
    communicationRisk: RiskCategory
    revisionRisk: RiskCategory
    legalRisk: RiskCategory
    ipRisk: RiskCategory
    clientBehaviorRisk: RiskCategory
  }
  summary: string
  recommendations: string[]
}

interface ExtractedData {
  goals: string[]
  deliverables: string[]
  timeline: string | null
  budget: string | null
  projectType: string | null
  clientSignals: string[]
  missingInformation: string[]
  confidence: number
}

interface AnalyzeResponse {
  success: boolean
  data: ExtractedData
  riskReport: RiskReport
  usedFallback: boolean
  error?: string
}

const categoryConfig: Record<string, { icon: React.ElementType; label: string }> = {
  scopeRisk: { icon: Shield, label: "Scope Risk" },
  paymentRisk: { icon: DollarSign, label: "Payment Risk" },
  timelineRisk: { icon: Timer, label: "Timeline Risk" },
  communicationRisk: { icon: MessageSquare, label: "Communication Risk" },
  revisionRisk: { icon: RefreshCw, label: "Revision Risk" },
  legalRisk: { icon: Gavel, label: "Legal Risk" },
  ipRisk: { icon: Scale, label: "IP Risk" },
  clientBehaviorRisk: { icon: UserX, label: "Client Behavior Risk" },
}

function ScoreGauge({ score, size = "lg" }: { score: number; size?: "sm" | "lg" }) {
  const color =
    score >= 80 ? "stroke-green-500" : score >= 50 ? "stroke-amber-500" : "stroke-red-500"
  const r = size === "lg" ? 54 : 36
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ

  return (
    <div className={cn("relative inline-flex items-center justify-center", size === "lg" ? "h-32 w-32" : "h-20 w-20")}>
      <svg className="absolute inset-0 -rotate-90" width="100%" height="100%" viewBox={`0 0 ${(r + 10) * 2} ${(r + 10) * 2}`}>
        <circle cx={r + 10} cy={r + 10} r={r} fill="none" stroke="currentColor" strokeWidth="6" className="text-muted-foreground/20" />
        <circle
          cx={r + 10}
          cy={r + 10}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          className={color + " transition-all duration-700"}
        />
      </svg>
      <span className={cn("font-bold", size === "lg" ? "text-3xl" : "text-lg")}>{score}</span>
    </div>
  )
}

function RiskBadge({ level }: { level: "Low" | "Medium" | "High" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium",
        level === "Low" && "bg-green-100 text-green-700",
        level === "Medium" && "bg-amber-100 text-amber-700",
        level === "High" && "bg-red-100 text-red-700"
      )}
    >
      {level === "Low" && <CheckCircle2 className="h-4 w-4" />}
      {level === "Medium" && <ShieldMinus className="h-4 w-4" />}
      {level === "High" && <ShieldAlert className="h-4 w-4" />}
      {level} Risk
    </span>
  )
}

function CategoryCard({ category, config }: { category: RiskCategory; config: { icon: React.ElementType; label: string } }) {
  const Icon = config.icon
  const borderColor =
    category.severity === "low"
      ? "border-l-green-500"
      : category.severity === "medium"
      ? "border-l-amber-500"
      : "border-l-red-500"

  return (
    <Card className={cn("border-l-4", borderColor)}>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm">{config.label}</CardTitle>
        </div>
        <div className="flex items-center gap-2">
          <ScoreGauge score={category.score} size="sm" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {category.findings.length > 0 ? (
          category.findings.map((finding, i) => (
            <FindingItem key={i} finding={finding} />
          ))
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
            No significant risks detected
          </div>
        )}
        {category.mitigations && (
          <div className="flex items-start gap-2 rounded-md bg-primary/5 p-3 text-xs">
            <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <span>{category.mitigations}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function FindingItem({ finding }: { finding: { title: string; description: string; evidence: string } }) {
  return (
    <div className="space-y-1 rounded-md border bg-muted/30 p-2.5">
      <p className="text-xs font-medium">{finding.title}</p>
      <p className="text-xs text-muted-foreground">{finding.description}</p>
      {finding.evidence && (
        <p className="text-xs italic text-muted-foreground/70">
          Evidence: &ldquo;{finding.evidence}&rdquo;
        </p>
      )}
    </div>
  )
}

function RiskReportView({ report }: { report: RiskReport }) {
  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex flex-col items-center gap-4 rounded-xl border bg-card p-8 text-center">
        <div className="flex items-center gap-4">
          <ScoreGauge score={report.overallScore} size="lg" />
          <div className="text-left">
            <p className="text-sm text-muted-foreground">How this deal looks</p>
            <RiskBadge level={report.riskLevel} />
          </div>
        </div>
        <p className="max-w-lg text-sm text-muted-foreground">{report.summary}</p>
        {report.recommendations.length > 0 && (
          <div className="w-full text-left mt-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Recommendations</p>
            <ul className="space-y-1">
              {report.recommendations.map((r, i) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  {r}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {(Object.entries(categoryConfig) as [string, { icon: React.ElementType; label: string }][]).map(
          ([key, config]) => (
            <CategoryCard
              key={key}
              category={report.categories[key as keyof typeof report.categories]}
              config={config}
            />
          )
        )}
      </div>

      <div className="text-xs text-muted-foreground text-center">
        This is a preview. Create a free account to save this analysis, get negotiation points, and generate protection documents.
      </div>
    </div>
  )
}

export function LandingMiniDashboard() {
  const [mode, setMode] = useState<InputMode>("paste")
  const [pasteValue, setPasteValue] = useState("")
  const [dragOver, setDragOver] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [describeType, setDescribeType] = useState("")
  const [describeTerms, setDescribeTerms] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AnalyzeResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [placeholderIndex, setPlaceholderIndex] = useState(0)

  useEffect(() => {
    if (pasteValue) return
    const id = window.setInterval(() => {
      setPlaceholderIndex((i) => (i + 1) % rotatingPlaceholders.length)
    }, 3400)
    return () => window.clearInterval(id)
  }, [pasteValue])

  const handleAnalyze = useCallback(async () => {
    setLoading(true)
    setError(null)

    let input = ""
    const formData = new FormData()

    if (mode === "paste") {
      input = pasteValue
      formData.append("prompt", pasteValue)
    } else if (mode === "upload" && selectedFile) {
      formData.append("files", selectedFile)
    } else if (mode === "describe") {
      const combined = `Deal type: ${describeType}\n\nTerms: ${describeTerms}`
      input = combined
      formData.append("prompt", combined)
    }

    formData.append("dealType", mode === "describe" ? "generic" : "freelance")

    if (!input.trim()) {
      setError("Please provide some content to analyze")
      setLoading(false)
      return
    }

    try {
      const response = await fetch("/api/analyze-anonymous", {
        method: "POST",
        body: formData,
      })

      const contentType = response.headers.get("content-type") ?? ""
      if (!contentType.includes("application/json")) {
        throw new Error("Analysis failed. Please try again.")
      }
      const data: AnalyzeResponse = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Analysis failed. Please try again.")
      }

      setResult(data)
    } catch (err) {
      setError(publicErrorMessage(err, "Analysis failed. Please try again."))
    } finally {
      setLoading(false)
    }
  }, [mode, pasteValue, selectedFile, describeType, describeTerms])

  const resetAnalysis = () => {
    setResult(null)
    setError(null)
  }

  const canAnalyze = mode === "paste"
    ? pasteValue.trim().length > 0
    : mode === "upload"
    ? selectedFile !== null
    : describeType.trim().length > 0 && describeTerms.trim().length > 0

  if (result) {
    return (
      <section className="relative w-full py-24 lg:py-32 overflow-hidden bg-[#F2F0ED]">
        <div className="absolute -top-32 -left-24 w-[520px] h-[520px] rounded-full bg-[var(--primary)]/28 blur-[120px]" />
        <div className="absolute -bottom-40 -right-10 w-[600px] h-[600px] rounded-full bg-brand-red/[0.12] blur-[130px]" />
        <div className="absolute inset-0 pointer-events-none overflow-hidden select-none">
          <div className="absolute inset-x-0 top-10 flex justify-center">
            <span className="text-[clamp(3.5rem,9vw,8.5rem)] font-extrabold tracking-tight text-[#141110]/[0.045] whitespace-nowrap">
              See the risk
            </span>
          </div>
          <div className="absolute inset-0 opacity-[0.025]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, #1C1917 1px, transparent 0)", backgroundSize: "26px 26px" }} />
        </div>
        <div className="relative max-w-2xl mx-auto px-6">
          <div className="rounded-[28px] glass-extreme-panel p-6 sm:p-8 shadow-[0_26px_72px_-20px_rgba(20,17,16,0.30)] ring-1 ring-black/5 border-white/70">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-[#141110]">Analysis Complete</h3>
              <Button variant="ghost" size="sm" onClick={resetAnalysis} aria-label="Start a new analysis">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <RiskReportView report={result.riskReport} />
            <div className="mt-6 pt-6 border-t border-white/30">
              <Link href="/register">
                <Button
                  className="inline-flex items-center gap-1.5 rounded-full bg-[var(--primary)] text-white px-6 py-2.5 text-sm font-medium hover:bg-[var(--primary)]/90 transition-colors shadow-sm w-full sm:w-auto"
                >
                  <Sparkles className="h-4 w-4" />
                  Save & Get Full Report
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="relative w-full py-24 lg:py-32 overflow-hidden bg-[#F2F0ED]">
      <div className="absolute -top-32 -left-24 w-[520px] h-[520px] rounded-full bg-[var(--primary)]/28 blur-[120px]" />
      <div className="absolute -bottom-40 -right-10 w-[600px] h-[600px] rounded-full bg-brand-red/[0.12] blur-[130px]" />
      <div className="absolute inset-0 pointer-events-none overflow-hidden select-none">
        <div className="absolute inset-x-0 top-10 flex justify-center">
          <span className="text-[clamp(3.5rem,9vw,8.5rem)] font-extrabold tracking-tight text-[#141110]/[0.045] whitespace-nowrap">
            See the risk
          </span>
        </div>
        <div className="absolute inset-0 opacity-[0.025]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, #1C1917 1px, transparent 0)", backgroundSize: "26px 26px" }} />
      </div>
      <div className="relative max-w-2xl mx-auto px-6">
        <div className="rounded-[28px] glass-extreme-panel p-6 sm:p-8 shadow-[0_26px_72px_-20px_rgba(20,17,16,0.30)] ring-1 ring-black/5 border-white/70 transition-shadow focus-within:shadow-[0_32px_88px_-22px_rgba(20,17,16,0.36)]">
          <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent" />
          <textarea
            key={placeholderIndex}
            placeholder={rotatingPlaceholders[placeholderIndex]}
            rows={4}
            className="w-full bg-transparent resize-none outline-none text-base sm:text-lg placeholder:text-[#141110]/40 animate-fade-in"
            value={pasteValue}
            onChange={(e) => { setPasteValue(e.target.value); resetAnalysis(); }}
          />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full glass-extreme bg-white/30 border border-white/60 p-3"
              onClick={() => { setMode("upload"); resetAnalysis(); }}
              disabled={loading}
              aria-label="Upload a file"
            >
              <Upload className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              className="rounded-full glass-extreme bg-white/30 border border-white/60 px-4 py-2.5 text-sm flex items-center gap-2"
              onClick={() => { setMode("paste"); resetAnalysis(); }}
              disabled={loading}
            >
              <FileText className="h-4 w-4" />
              Paste
            </Button>
            <Button
              variant="ghost"
              className="rounded-full glass-extreme bg-white/30 border border-white/60 px-4 py-2.5 text-sm flex items-center gap-2"
              onClick={() => { setMode("describe"); resetAnalysis(); }}
              disabled={loading}
            >
              <MessageSquare className="h-4 w-4" />
              Describe
            </Button>
            <Button
              className="ml-auto rounded-full bg-[var(--primary)] text-white p-3"
              onClick={handleAnalyze}
              disabled={!canAnalyze || loading}
              aria-label={loading ? "Analyzing your deal" : "Analyze deal"}
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </Button>
          </div>
          {fileName && (
            <div className="mt-3 flex items-center gap-2 text-xs text-[#141110]/50">
              <FileText className="h-3.5 w-3.5" />
              <span>{fileName}</span>
              <button
                type="button"
                onClick={() => { setFileName(null); setSelectedFile(null); resetAnalysis(); }}
                className="ml-1 text-[#141110]/50 hover:text-[#141110]/70"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
        <p className="mt-4 text-center text-xs text-[#141110]/50">
          No signup needed to try it. Your deal stays private and isn&apos;t used to train any model.
        </p>
        {error && !loading && (
          <p role="alert" className="mt-3 text-center text-sm font-medium text-destructive">{error}</p>
        )}
        {loading && (
          <div className="mt-4 flex justify-center">
            <AiWorking label="Analyzing your deal" />
          </div>
        )}
      </div>

      <input
        type="file"
        id="file-upload"
        className="hidden"
        accept=".pdf,.docx,.txt"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) {
            setFileName(f.name)
            setSelectedFile(f)
            resetAnalysis()
          }
        }}
      />
    </section>
  )
}