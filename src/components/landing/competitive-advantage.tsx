"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowRight, CheckCircle2, ShieldAlert } from "lucide-react"

export function CompetitiveAdvantageSection() {
  const [activeTab, setActiveTab] = useState(0)

  const tabs = [
    {
      id: "ingestion",
      label: "INTAKE & INGESTION",
      title: "Drop in any agreement: PDF, Word, or plain text",
      desc: "Our document intake reads PDFs, Word files, and pasted text, preserving the structure and cross-referenced definitions the review engine reasons over.",
      incoming: "Section 3.1: Contractor shall perform unlimited revisions at no additional charge until Client confirms full satisfaction in its sole discretion.",
      analysis: "High Risk · Unbounded Scope: Client retains subjective right to demand infinite cycles, converting fixed-fee contracts into perpetual unpaid obligations.",
      pushback: "Contractor shall provide up to two (2) rounds of revisions included in the fixed fee. Additional iterations shall be billed at the standard hourly rate of $150/hr.",
    },
    {
      id: "audit",
      label: "DEEP RISK AUDIT",
      title: "Deterministic Rulepacks Overrule Generative Guesswork",
      desc: "Every clause is audited against specialized rulepacks (Commercial MSAs, Leases, IP Assignment, Employment). If evidence is lacking, findings are reported as unknown rather than fabricated.",
      incoming: "Section 7.4: All Intellectual Property, trade secrets, and background inventions developed prior to or during this Agreement belong exclusively to Customer upon creation.",
      analysis: "Critical Risk · IP Expropriation: Customer takes ownership of pre-existing background code and reusable tooling, risking forfeiture of company proprietary assets.",
      pushback: "Vendor retains exclusive ownership of all Pre-Existing Materials and general know-how, granting Customer a non-exclusive, perpetual license solely for internal use of the Deliverables.",
    },
    {
      id: "redline",
      label: "ASSISTED REDLINE",
      title: "Suggested counter-language, ready to send",
      desc: "Dealenz drafts pushback in your preferred tone: conservative, standard commercial, or assertive. You review every word before it goes out.",
      incoming: "Section 12.2: Payment is due ninety (90) days following receipt of final uncontested invoice. Customer may withhold up to 30% retention.",
      analysis: "Severe Cash-Flow Risk: Extended Net-90 timeline coupled with discretionary retention severely damages vendor liquidity and operating capital.",
      pushback: "Invoices are payable within thirty (30) days of receipt. Work shall pause if any undisputed invoice remains unpaid past forty-five (45) days.",
    },
    {
      id: "governance",
      label: "EXECUTION & GOVERNANCE",
      title: "Sign here, then watch every deadline",
      desc: "You sign first, then counterparties sign through a link with no account required. After signing, renewals and notice deadlines stay tracked with email alerts.",
      incoming: "Section 15.1: This Agreement auto-renews for consecutive 1-year terms unless written notice is received exactly 60 days prior to the calendar anniversary.",
      analysis: "Auto-Renewal Trap: Strict 60-day notice window creates exposure to inadvertent multi-year lock-in with ongoing annual financial commitments.",
      pushback: "Tracked: Dealenz records the renewal window for October 12, with email alerts as the deadline approaches.",
    },
  ]

  const current = tabs[activeTab]

  return (
    <section className="relative overflow-hidden bg-[#FAFAF8] py-20 text-neutral-900 lg:py-28">
      {/* Descending connector line from hero */}
      <div className="absolute left-1/2 top-0 h-16 w-px -translate-x-1/2 bg-amber-500/40" aria-hidden="true" />
      <div className="absolute left-1/2 top-16 h-2 w-2 -translate-x-1/2 rounded-full border border-amber-500 bg-amber-400" aria-hidden="true" />

      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        {/* Header */}
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-700">
            DEAL INTELLIGENCE & GOVERNANCE
          </p>
          <h2 className="mt-3 text-[32px] font-bold tracking-tight text-neutral-900 sm:text-[44px]">
            Turn contracts into competitive advantage.
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-neutral-600 sm:text-[16px]">
            Uncover hidden liabilities, enforce institutional playbooks, and negotiate with asymmetric leverage.
            Grounded in verifiable source evidence, not unvetted generative hallucinations.
          </p>
          <div className="mt-6 flex justify-center">
            <Link
              href="/register"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-neutral-900 px-6 text-[13px] font-semibold text-white transition-transform duration-150 hover:bg-neutral-800 active:scale-95"
            >
              Explore Platform
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Interactive Tabs Bar */}
        <div className="mt-14 flex flex-wrap justify-center gap-2 border-b border-neutral-200 pb-3">
          {tabs.map((tab, idx) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(idx)}
              className={`rounded-full px-4 py-2 text-[12px] font-bold tracking-wider transition-all ${
                activeTab === idx
                  ? "bg-neutral-900 text-white shadow-md"
                  : "bg-white text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content Display Console */}
        <div className="mt-8 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xl">
          <div className="border-b border-neutral-200 bg-[#F4F2EC] px-6 py-4">
            <h3 className="text-[18px] font-bold text-neutral-900">{current.title}</h3>
            <p className="mt-1 text-[13px] text-neutral-600">{current.desc}</p>
          </div>

          <div className="grid gap-6 p-6 lg:grid-cols-2 lg:gap-8 lg:p-8">
            {/* Left: Quoted Incoming Risk */}
            <div className="flex flex-col justify-between rounded-xl border border-red-200 bg-red-50/50 p-5">
              <div>
                <div className="flex items-center gap-2 text-red-700">
                  <ShieldAlert className="h-4 w-4" />
                  <span className="text-[11px] font-bold uppercase tracking-wider">Incoming Contract Flag</span>
                </div>
                <div className="mt-3 rounded-lg border border-red-200 bg-white p-4 font-mono text-[12px] leading-relaxed text-neutral-800">
                  &ldquo;{current.incoming}&rdquo;
                </div>
                <p className="mt-3 text-[12px] leading-relaxed text-red-900">
                  <strong>Assessment:</strong> {current.analysis}
                </p>
              </div>
              <div className="mt-4 flex items-center gap-1.5 text-[11px] font-medium text-neutral-500">
                <span>Deterministic Severity: High Risk</span>
              </div>
            </div>

            {/* Right: Dealenz Counter-Pushback */}
            <div className="flex flex-col justify-between rounded-xl border border-emerald-200 bg-emerald-50/50 p-5">
              <div>
                <div className="flex items-center gap-2 text-emerald-800">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-[11px] font-bold uppercase tracking-wider">Suggested Counter-Language</span>
                </div>
                <div className="mt-3 rounded-lg border border-emerald-200 bg-white p-4 font-mono text-[12px] leading-relaxed text-neutral-800">
                  &ldquo;{current.pushback}&rdquo;
                </div>
                <p className="mt-3 text-[12px] leading-relaxed text-emerald-950">
                  <strong>Strategic Benefit:</strong> Replaces unilateral liability with reciprocal commercial terms. Ready to copy into email or a Word redline.
                </p>
              </div>
              <div className="mt-4 flex items-center justify-between text-[11px]">
                <span className="font-semibold text-emerald-800">Checked against Dealenz rulepacks</span>
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 font-bold text-emerald-900">Illustrative example</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
