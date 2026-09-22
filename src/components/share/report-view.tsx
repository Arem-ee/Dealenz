import Link from "next/link"
import { ShieldCheck } from "lucide-react"
import type { SharedReport } from "@/lib/share/report"

// Public shared finding report: what a tokenized link shows. Numbered
// findings in the product's visual grammar — DOCUMENT (quoted evidence),
// DEALENZ (interpretation), ACTION (counter-words) — branded and explicit
// that this is one user's published findings. Ends with the acquisition
// CTA: built to be forwarded.
export function ReportView({ report }: { report: SharedReport }) {
  const numbered = report.findings.map((f, i) => ({ finding: f, num: String(i + 1).padStart(2, "0") }))

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground/40">Dealenz</p>
        <h1 className="mt-2 text-[26px] font-semibold tracking-tight sm:text-3xl">
          What we found
        </h1>
        <p className="mt-1 text-sm text-foreground/55">
          {report.dealType === "unknown" ? "A shared deal" : <><span className="capitalize">{report.dealType.replace("_", " ")}</span> deal</>} ·{" "}
          {report.findingCount} thing{report.findingCount === 1 ? "" : "s"} worth reviewing
          {report.overallScore !== null ? ` · rated ${report.overallScore}/100` : ""}
        </p>

        {report.findings.length === 0 ? (
          <div className="mt-6 rounded-xl border bg-card p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <p className="text-sm font-medium">No major risks in this report</p>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">The shared analysis found nothing standing out as needing a fix before signing.</p>
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            {numbered.map(({ finding: f, num }) => {
              return (
              <section key={num} aria-label={`Finding ${num}`} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                <div className="px-5 pt-4">
                  <p className=" text-[26px] font-semibold tracking-tight">{num}</p>
                  <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground/40">
                    {f.severity}
                  </p>
                  <p className="mt-2  text-[17px] font-medium leading-snug">{f.summary}</p>
                </div>
                {Array.isArray(f.evidence) && f.evidence.length > 0 && (
                  <div className="mx-5 mt-3 border-t border-border pt-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground/40">Evidence</p>
                    {f.evidence.slice(0, 2).map((ev, j) => (
                      <p key={j} className="mt-1  text-[13px] italic leading-relaxed text-foreground/70">
                        &ldquo;{ev.quote}&rdquo;
                      </p>
                    ))}
                  </div>
                )}
                {f.guidance && (
                  <div className="mx-5 mt-3 border-t border-border pt-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground/40">Why it matters</p>
                    <p className="mt-1 text-[13px] leading-relaxed text-foreground/70">{f.guidance}</p>
                  </div>
                )}
                {f.pushback && (
                  <div className="mx-5 mt-3 border-t border-border pt-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground/40">What you could ask for</p>
                    <p className="mt-1  text-[14px] leading-relaxed">&ldquo;{f.pushback}&rdquo;</p>
                  </div>
                )}
                <div className="h-4" />
              </section>
              )
            })}
          </div>
        )}

        <div className="mt-8 rounded-xl border border-white/10 bg-[#1C1917] p-6 text-center text-white">
          <p className="text-base font-semibold">Reviewed with Dealenz</p>
          <p className="mt-1 text-sm text-white/60">Have paper of your own to check? Send us their contract.</p>
          <Link
            href="/register"
            className="mt-4 inline-flex h-11 items-center rounded-full bg-white px-7 text-sm font-semibold text-[#141110] transition-colors hover:bg-white/90"
          >
            Review your own deal
          </Link>
          <p className="mx-auto mt-4 max-w-xl text-[11px] leading-relaxed text-white/40">
            Shared by a Dealenz user about their own deal. AI-assisted findings, not legal advice. Review important agreements with a qualified professional.
          </p>
        </div>
      </div>
    </div>
  )
}
