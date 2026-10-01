"use client"

import { useState } from "react"
import { FileUp, FileText, Check, ShieldCheck, PenLine, PenTool } from "lucide-react"
import { Reveal } from "@/components/landing/reveal"

const TABS = [
  { label: "Intake", icon: <FileUp className="h-3.5 w-3.5" /> },
  { label: "Risk audit", icon: <ShieldCheck className="h-3.5 w-3.5" /> },
  { label: "Redline", icon: <PenLine className="h-3.5 w-3.5" /> },
  { label: "Sign & track", icon: <PenTool className="h-3.5 w-3.5" /> },
] as const

function IntakeMockup() {
  return (
    <div className="rounded-none border border-neutral-200 bg-white p-8 lg:p-10">
      <div className="flex items-center gap-2 text-pine-700">
        <FileUp className="h-4 w-4" />
        <p className="text-[11px] font-bold uppercase tracking-wider">Intake</p>
      </div>
      <ul className="mt-5 space-y-3">
        {["Vendor-MSA.pdf", "Office-Lease.docx"].map((file) => (
          <li
            key={file}
            className="flex items-center justify-between gap-3 rounded-none border border-neutral-200 px-5 py-4"
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <FileText className="h-4 w-4 shrink-0 text-neutral-400" />
              <span className="truncate font-mono text-[13px] text-neutral-800">{file}</span>
            </span>
            <span className="flex shrink-0 items-center gap-1 rounded-none bg-pine-700/10 px-2.5 py-0.5 text-[10px] font-semibold text-pine-700">
              <Check className="h-3 w-3" />
              Parsed
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-5 border-l-2 border-pine-500 pl-3 text-[12px] leading-relaxed text-neutral-600">
        Structure and definitions preserved for review.
      </p>
    </div>
  )
}

function RiskAuditMockup() {
  return (
    <div className="rounded-none border border-neutral-200 bg-white p-8 lg:p-10">
      <div className="flex items-center gap-2 text-pine-700">
        <ShieldCheck className="h-4 w-4" />
        <p className="text-[11px] font-bold uppercase tracking-wider">Risk audit</p>
      </div>
      <div className="mt-5 rounded-none border border-red-200 bg-red-50/50 p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-none bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
            Critical
          </span>
          <p className="text-[13px] font-semibold text-neutral-800">
            Section 8.4 — Uncapped indemnity
          </p>
        </div>
        <p className="mt-3 border-l-2 border-pine-500 bg-white p-4 font-mono text-[12px] leading-relaxed text-neutral-700">
          &ldquo;…without limitation or cap, arising from any breach of this Agreement.&rdquo;
        </p>
      </div>
      <p className="mt-5 border-l-2 border-pine-500 pl-3 text-[12px] leading-relaxed text-neutral-600">
        Rulepack match: liability & exposure. Evidence attached, nothing inferred.
      </p>
    </div>
  )
}

function RedlineMockup() {
  return (
    <div className="rounded-none border border-neutral-200 bg-white p-8 lg:p-10">
      <div className="flex items-center gap-2 text-pine-700">
        <PenLine className="h-4 w-4" />
        <p className="text-[11px] font-bold uppercase tracking-wider">Redline</p>
      </div>
      <div className="mt-5 space-y-3 font-mono text-[13px] leading-relaxed">
        <p className="rounded-none bg-red-50 px-4 py-3 text-red-700 line-through">
          Vendor indemnifies Customer without cap.
        </p>
        <p className="rounded-none bg-pine-700/10 px-4 py-3 text-pine-900">
          Mutual indemnity, capped at 12 months fees.
        </p>
      </div>
      <p className="mt-5 border-l-2 border-pine-500 pl-3 text-[12px] leading-relaxed text-neutral-600">
        Copy into email or a Word redline. Nothing sends itself.
      </p>
    </div>
  )
}

function SignTrackMockup() {
  return (
    <div className="rounded-none border border-neutral-200 bg-white p-8 lg:p-10">
      <div className="flex items-center gap-2 text-pine-700">
        <PenTool className="h-4 w-4" />
        <p className="text-[11px] font-bold uppercase tracking-wider">Sign & track</p>
      </div>
      <ul className="mt-5 space-y-3">
        <li className="flex items-center justify-between gap-3 rounded-none border border-neutral-200 px-5 py-4">
          <span className="text-[13px] font-medium text-neutral-800">You — owner</span>
          <span className="flex shrink-0 items-center gap-1 rounded-none bg-pine-700/10 px-2.5 py-0.5 text-[10px] font-semibold text-pine-700">
            <Check className="h-3 w-3" />
            Signed
          </span>
        </li>
        <li className="flex items-center justify-between gap-3 rounded-none border border-neutral-200 px-5 py-4">
          <span className="text-[13px] font-medium text-neutral-800">Counterparty</span>
          <span className="shrink-0 rounded-none bg-neutral-100 px-2.5 py-0.5 text-[10px] font-semibold text-neutral-600">
            Waiting
          </span>
        </li>
      </ul>
      <p className="mt-5 border-l-2 border-pine-500 pl-3 text-[12px] leading-relaxed text-neutral-600">
        Next: renewal notice due Oct 12 — digest by email.
      </p>
    </div>
  )
}

const PANELS = [
  {
    headline: "Drop in any agreement: PDF, Word, or plain text",
    sub: "Our document intake reads PDFs, Word files, and pasted text, preserving the structure and cross-referenced definitions the review engine reasons over.",
    mockup: <IntakeMockup />,
  },
  {
    headline: "Deterministic rulepacks overrule generative guesswork",
    sub: "Every clause is audited against specialized rulepacks. If evidence is lacking, findings are reported as unknown rather than fabricated.",
    mockup: <RiskAuditMockup />,
  },
  {
    headline: "Suggested counter-language, ready to send",
    sub: "Dealenz drafts pushback in your preferred tone. You review every word before it goes out.",
    mockup: <RedlineMockup />,
  },
  {
    headline: "Sign here, then watch every deadline",
    sub: "You sign first, then counterparties sign through a link with no account required. After signing, renewals and notice deadlines stay tracked.",
    mockup: <SignTrackMockup />,
  },
]

export function Advantage() {
  const [activeTab, setActiveTab] = useState(0)

  return (
    <section id="workflows" className="bg-paper py-28 text-neutral-900 lg:py-40">
      <Reveal className="mx-auto max-w-6xl px-6 lg:px-8">
        <div className="flex flex-nowrap justify-start gap-2 overflow-x-auto pb-3">
          {TABS.map((tab, idx) => (
            <button
              key={tab.label}
              type="button"
              onClick={() => setActiveTab(idx)}
              aria-current={activeTab === idx ? "true" : undefined}
              className={`flex shrink-0 items-center gap-1.5 rounded-none px-4 py-2 text-[12px] font-bold tracking-wider transition-all ${
                activeTab === idx
                  ? "bg-neutral-900 text-white"
                  : "bg-white text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
              }`}
            >
              {tab.icon}
              {tab.label.toUpperCase()}
            </button>
          ))}
        </div>

        <div key={activeTab} className="animate-slide-in-right mt-10 max-w-2xl">
          <h2 className="display-h text-[30px] leading-[1.12] text-neutral-900 sm:text-[40px]">
            {PANELS[activeTab]!.headline}
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-neutral-600">
            {PANELS[activeTab]!.sub}
          </p>
        </div>

        <div key={`panel-${activeTab}`} className="animate-slide-in-right mx-auto mt-10 max-w-5xl">
          {PANELS[activeTab]!.mockup}
          <p className="mt-3 text-center text-[11px] text-neutral-400">Illustrated example</p>
        </div>
      </Reveal>
    </section>
  )
}
