import React from "react"
import Link from "next/link"
import { ArrowRight, FileUp, ShieldCheck, Scale, PenTool, CheckCircle, BellRing } from "lucide-react"

export function ConnectedWorkflowsSection() {
  const steps = [
    {
      num: "01",
      icon: <FileUp className="h-5 w-5 text-amber-600" />,
      title: "Contract Ingestion & OCR",
      desc: "Instantly process PDFs, Word documents, and scanned agreements with full layout preservation.",
    },
    {
      num: "02",
      icon: <ShieldCheck className="h-5 w-5 text-amber-600" />,
      title: "Deterministic Rule Verification",
      desc: "Run deterministic checks against legal rulepacks to eliminate generative AI hallucinations.",
    },
    {
      num: "03",
      icon: <Scale className="h-5 w-5 text-amber-600" />,
      title: "Clause-Level Risk Scoring",
      desc: "Every clause is scored for severity and backed by exact source quotations and exposure rationale.",
    },
    {
      num: "04",
      icon: <PenTool className="h-5 w-5 text-amber-600" />,
      title: "Autonomous Redline Drafting",
      desc: "Generate balanced, lawyer-grade counter-language pre-approved for your commercial interests.",
    },
    {
      num: "05",
      icon: <CheckCircle className="h-5 w-5 text-amber-600" />,
      title: "Frictionless Counterparty E-Sign",
      desc: "Secure cryptographic signing links allow counterparties to sign without requiring an account.",
    },
    {
      num: "06",
      icon: <BellRing className="h-5 w-5 text-amber-600" />,
      title: "24/7 Obligation Watchdog",
      desc: "Automated alerts for notice windows, renewals, milestone commitments, and liability expirations.",
    },
  ]

  return (
    <section className="relative overflow-hidden bg-white py-20 text-neutral-900 lg:py-28">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        
        {/* Header */}
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-700">
            AUTONOMOUS DEAL EXECUTION
          </p>
          <h2 className="mt-3 text-[32px] font-bold tracking-tight text-neutral-900 sm:text-[44px]">
            A full suite of connected workflows, built on AI.
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-neutral-600 sm:text-[16px]">
            From initial intake and clause extraction to autonomous counter-proposals and post-signature monitoring—all unified on a single cryptographic intelligence ledger.
          </p>
          <div className="mt-6 flex justify-center">
            <Link
              href="/register"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-neutral-900 px-6 text-[13px] font-semibold text-white transition-transform duration-150 hover:bg-neutral-800 active:scale-95"
            >
              Explore AI Workflows
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Workflow Diagram & Steps Grid */}
        <div className="relative mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {steps.map((s) => (
            <div
              key={s.num}
              className="group relative flex flex-col justify-between rounded-2xl border border-neutral-200/90 bg-[#FAFAF8] p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-amber-400 hover:bg-white hover:shadow-lg"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 transition-colors group-hover:bg-amber-500/20">
                    {s.icon}
                  </span>
                  <span className="font-mono text-[13px] font-bold text-neutral-400 group-hover:text-amber-600">
                    {s.num}
                  </span>
                </div>
                <h3 className="mt-4 text-[16px] font-bold text-neutral-900">{s.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-neutral-600">{s.desc}</p>
              </div>

              <div className="mt-6 flex items-center gap-1 text-[11px] font-bold text-amber-700 opacity-0 transition-opacity group-hover:opacity-100">
                <span>View workflow step</span>
                <ArrowRight className="h-3 w-3" />
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  )
}
