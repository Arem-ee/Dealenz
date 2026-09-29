"use client"

import { useState } from "react"
import {
  AlertTriangle,
  Copy,
  Check,
  FileText,
  ShieldCheck,
  ChevronDown,
  Sparkles,
  ArrowRight,
  SlidersHorizontal,
} from "lucide-react"

export function HeroContractCard() {
  const [activeTab, setActiveTab] = useState<"analysis" | "redline" | "audit">("analysis")
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative mx-auto w-full max-w-4xl pt-6">
      {/* Warm Parchment / Canvas Wrapper Frame matching Agiloft hero preview */}
      <div className="relative rounded-2xl border border-amber-900/30 bg-[#161412] p-2.5 shadow-[0_32px_90px_-20px_rgba(0,0,0,0.85)] sm:p-4">
        
        {/* Subtle glowing amber backdrop edge */}
        <div className="pointer-events-none absolute -inset-0.5 rounded-2xl bg-gradient-to-b from-amber-500/20 via-transparent to-amber-500/10 opacity-60 blur-sm" />

        {/* Inner Canvas Container */}
        <div className="relative overflow-hidden rounded-xl border border-neutral-200/20 bg-[#F9F7F2] text-neutral-900 shadow-inner">
          
          {/* Top Window / Document Header Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200/80 bg-[#F2EFE8] px-4 py-3 sm:px-6">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-900 text-amber-400 shadow-sm">
                <FileText className="h-4 w-4" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-bold tracking-tight text-neutral-900 sm:text-[14px]">
                    Enterprise_MSA_Tier1_Vendor.pdf
                  </span>
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                    Audit Complete
                  </span>
                </div>
                <p className="text-[11px] text-neutral-500">
                  Counterparty: Global Systems Inc. · Governed by Delaware & CAMA Rulepack v4.2
                </p>
              </div>
            </div>

            {/* Jurisdiction / Language Selector */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white/80 px-2.5 py-1 text-[11px] font-medium text-neutral-700 shadow-xs">
                <span>Jurisdiction: US / Multi-Corridor</span>
                <ChevronDown className="h-3 w-3 text-neutral-400" />
              </div>
              <div className="hidden items-center gap-1 rounded-md bg-neutral-900 px-2.5 py-1 text-[11px] font-semibold text-white sm:flex">
                <ShieldCheck className="h-3.5 w-3.5 text-amber-400" />
                <span>Deterministic Pass</span>
              </div>
            </div>
          </div>

          {/* Subheader Navigation Tabs */}
          <div className="flex border-b border-neutral-200 bg-white px-4 sm:px-6">
            <button
              type="button"
              onClick={() => setActiveTab("analysis")}
              className={`flex items-center gap-2 border-b-2 py-2.5 text-[12px] font-semibold transition-colors ${
                activeTab === "analysis"
                  ? "border-amber-600 text-neutral-900"
                  : "border-transparent text-neutral-500 hover:text-neutral-800"
              }`}
            >
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
              Clause Intelligence (4 Flags)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("redline")}
              className={`ml-6 flex items-center gap-2 border-b-2 py-2.5 text-[12px] font-semibold transition-colors ${
                activeTab === "redline"
                  ? "border-amber-600 text-neutral-900"
                  : "border-transparent text-neutral-500 hover:text-neutral-800"
              }`}
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-600" />
              Counter-Redline Draft
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("audit")}
              className={`ml-6 hidden items-center gap-2 border-b-2 py-2.5 text-[12px] font-semibold transition-colors sm:flex ${
                activeTab === "audit"
                  ? "border-amber-600 text-neutral-900"
                  : "border-transparent text-neutral-500 hover:text-neutral-800"
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-neutral-400" />
              Rule Verification Log
            </button>
          </div>

          {/* Main Inspection View Body */}
          <div className="p-4 sm:p-6">
            {activeTab === "analysis" && (
              <div className="space-y-4">
                {/* Critical Finding Card */}
                <div className="rounded-xl border border-red-200/90 bg-red-50/60 p-4 transition-all">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 items-center rounded-md bg-red-600 px-2 text-[10px] font-bold uppercase tracking-wider text-white">
                        Critical Risk
                      </span>
                      <span className="text-[12px] font-bold text-neutral-800">
                        Section 8.4 — Uncapped Third-Party Indemnity
                      </span>
                    </div>
                    <span className="text-[11px] font-medium text-neutral-500">
                      Rulepack Match: Liability & Exposure §14
                    </span>
                  </div>

                  {/* Quoted Clause Redline */}
                  <div className="mt-3 rounded-lg border border-red-200/80 bg-white p-3 font-mono text-[12px] leading-relaxed text-neutral-800">
                    <span className="font-sans text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                      Incoming Contract Language:
                    </span>
                    <p className="mt-1">
                      &ldquo;Vendor shall defend, indemnify, and hold harmless Customer against{" "}
                      <span className="bg-red-100 font-semibold text-red-900 underline decoration-red-400">
                        any and all third-party claims, liabilities, or losses without limitation or cap
                      </span>
                      , arising from or related to any breach of this Agreement.&rdquo;
                    </p>
                  </div>

                  {/* Grounded Explanation */}
                  <div className="mt-3 flex items-start gap-2 text-[12px] text-neutral-700">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600" />
                    <p>
                      <strong>Exposure Assessment:</strong> This clause creates one-sided uncapped liability that
                      exceeds standard commercial norms. If signed as written, your organization assumes unlimited financial exposure.
                    </p>
                  </div>
                </div>

                {/* Drafted Pushback Preview */}
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 items-center rounded-md bg-emerald-600 px-2 text-[10px] font-bold uppercase tracking-wider text-white">
                        Recommended Counter-Words
                      </span>
                      <span className="text-[12px] font-semibold text-emerald-900">
                        Lawyer-grade mutual redline ready to copy
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="inline-flex items-center gap-1 rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-medium text-neutral-700 shadow-xs transition-colors hover:bg-neutral-50"
                    >
                      {copied ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-600" />
                          <span className="text-emerald-700">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3 text-neutral-500" />
                          <span>Copy Counter-Clause</span>
                        </>
                      )}
                    </button>
                  </div>

                  <p className="mt-2.5 rounded-lg border border-emerald-200/80 bg-white p-3 font-mono text-[12px] leading-relaxed text-neutral-800">
                    &ldquo;Each party shall mutually defend and indemnify the other against third-party claims arising
                    from gross negligence or willful misconduct,{" "}
                    <span className="bg-emerald-100 font-semibold text-emerald-900">
                      subject to the aggregate liability limitation set forth in Section 9 (capped at 12 months fees paid)
                    </span>
                    .&rdquo;
                  </p>
                </div>
              </div>
            )}

            {activeTab === "redline" && (
              <div className="space-y-3 font-mono text-[12px]">
                <div className="rounded-lg border border-neutral-200 bg-white p-4 leading-relaxed">
                  <p className="text-neutral-500 font-sans text-[11px] font-semibold uppercase tracking-wider">
                    Automated Dealenz Redline Output — Ready for Word &amp; Google Docs
                  </p>
                  <p className="mt-2 text-red-700 line-through">
                    - Vendor shall unconditionally indemnify Customer without financial cap.
                  </p>
                  <p className="mt-1 text-emerald-700">
                    + The parties mutually agree to indemnify each other subject to an aggregate cap of 2x total contract value.
                  </p>
                  <p className="mt-2 text-red-700 line-through">
                    - Customer may terminate for convenience with zero days written notice.
                  </p>
                  <p className="mt-1 text-emerald-700">
                    + Either party may terminate for convenience with thirty (30) days prior written notice.
                  </p>
                </div>
              </div>
            )}

            {activeTab === "audit" && (
              <div className="space-y-2 text-[12px]">
                <div className="rounded-lg border border-neutral-200 bg-white p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-neutral-800">Deterministic Engine Verification</span>
                    <span className="text-[11px] font-mono text-emerald-600">PASS (0 Hallucinations)</span>
                  </div>
                  <p className="mt-1 text-neutral-500">
                    Validated against US Delaware Commercial Code & International Cross-Border Deal Rulepack.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Card Footer Bar */}
          <div className="flex items-center justify-between border-t border-neutral-200 bg-[#F4F1EA] px-4 py-2.5 sm:px-6">
            <span className="text-[11px] font-medium text-neutral-500">
              Audit status: <strong className="text-neutral-800">4 risks detected · 4 counter-clauses generated</strong>
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 hover:text-amber-800">
              Review full report <ArrowRight className="h-3 w-3" />
            </span>
          </div>

        </div>
      </div>
    </div>
  )
}
