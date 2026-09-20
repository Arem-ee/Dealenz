import Link from "next/link"
import { ShieldCheck } from "lucide-react"
import { PushbackWords } from "@/components/findings/pushback-words"
import type { SharedReport } from "@/lib/share/report"

const SEVERITY_LABEL: Record<string, string> = {
  critical: "Fix before signing",
  material: "Should fix",
  attention: "Worth checking",
  informational: "For context",
}

// Public shared finding report: what a tokenized link shows. Branded,
// evidence-honest, and explicit that this is one user's published findings —
// never advice, never the full deal. Ends with the acquisition CTA.
export function ReportView({ report }: { report: SharedReport }) {
  const grouped = report.findings.reduce<Record<string, typeof report.findings>>((acc, f) => {
    const label = SEVERITY_LABEL[f.severity] ?? f.severity
    if (!acc[label]) acc[label] = []
    acc[label].push(f)
    return acc
  }, {})

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#1C1917]">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/40">Dealenz · Shared risk report</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {report.dealType === "unknown" ? "Deal findings" : <><span className="capitalize">{report.dealType.replace("_", " ")}</span> deal findings</>}
        </h1>
        <p className="mt-1 text-sm text-black/55">
          {report.overallScore !== null ? `Overall rating: ${report.overallScore}/100 · ${report.riskLevel}` : report.riskLevel}
          {" · "}{report.findingCount} finding{report.findingCount === 1 ? "" : "s"}
        </p>

        {report.findings.length === 0 ? (
          <div className="mt-6 rounded-xl border bg-white p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <p className="text-sm font-medium">No major risks in this report</p>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">The shared analysis found nothing standing out as needing a fix before signing.</p>
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-xl border bg-white">
            <div className="divide-y">
              {Object.entries(grouped).map(([label, items]) => (
                <div key={label} className="px-4 py-3">
                  <p className="text-sm font-medium">{label} · {items.length}</p>
                  <div className="mt-2 space-y-2">
                    {items.map((f, i) => (
                      <div key={i} className="rounded-lg border p-3">
                        <p className="font-serif text-sm font-medium leading-relaxed">{f.summary}</p>
                        {f.guidance && <p className="mt-1 font-serif text-xs leading-relaxed text-muted-foreground">{f.guidance}</p>}
                        {f.pushback && <PushbackWords words={f.pushback} />}
                        {Array.isArray(f.evidence) && f.evidence.length > 0 && (
                          <div className="mt-2 space-y-1 border-t border-border/40 pt-2">
                            {f.evidence.slice(0, 2).map((ev, j) => (
                              <p key={j} className="font-serif text-xs italic leading-relaxed text-muted-foreground">
                                &ldquo;{ev.quote}&rdquo;
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 rounded-xl bg-[#1C1917] p-6 text-center text-white">
          <p className="text-base font-semibold">Have paper of your own to check?</p>
          <p className="mt-1 text-sm text-white/60">Send us their contract. Get back what to push back on.</p>
          <Link
            href="/register"
            className="mt-4 inline-flex h-11 items-center rounded-full bg-white px-7 text-sm font-semibold text-[#141110] transition-colors hover:bg-white/90"
          >
            Analyze your deal — free to start
          </Link>
          <p className="mx-auto mt-4 max-w-xl text-[11px] leading-relaxed text-white/40">
            Shared by a Dealenz user about their own deal. AI-assisted findings, not legal advice. Review important agreements with a qualified professional.
          </p>
        </div>
      </div>
    </div>
  )
}
