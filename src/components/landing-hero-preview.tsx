"use client"

import { useState } from "react"
import { CircleAlert, FileText, Scale, ShieldCheck } from "lucide-react"
import { cn } from "@/lib/utils"

// Interactive product preview for the hero: three tabs walking the loop —
// findings, counter-words, guarded signing. Crafted mockups with honest
// labels, real product language, and real transitions. Tab state only;
// nothing here fetches or fabricates user data.
const TABS = [
  { key: "findings", label: "Findings" },
  { key: "words", label: "Counter-words" },
  { key: "guarded", label: "Sign & guard" },
] as const

type TabKey = (typeof TABS)[number]["key"]

export function LandingHeroPreview() {
  const [tab, setTab] = useState<TabKey>("findings")

  return (
    <div className="overflow-hidden rounded-[24px] border border-black/[0.07] bg-white shadow-[0_24px_64px_-24px_rgba(0,0,0,0.22),0_1px_2px_rgba(0,0,0,0.06)]">
      <div className="flex gap-1 border-b border-black/[0.06] bg-[#FAFAF8] p-2" role="tablist" aria-label="Product preview">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex-1 rounded-xl px-3 py-2 text-[12px] font-semibold transition-all duration-300",
              tab === t.key
                ? "bg-white text-[#1C1917] shadow-sm"
                : "text-black/45 hover:text-black/70"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="p-4 sm:p-5">
        {tab === "findings" && (
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <div className="relative h-[110px] w-[110px] shrink-0">
              <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden>
                <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(28,25,23,0.08)" strokeWidth="12" />
                <circle cx="60" cy="60" r="50" fill="none" stroke="var(--burgundy)" strokeWidth="12" strokeLinecap="round" strokeDasharray="314" strokeDashoffset="88" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[24px] font-semibold tracking-tight" data-numeric>72</span>
                <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-black/40">Risk score</span>
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold text-amber-900">
                <CircleAlert className="h-3 w-3" />
                Needs attention
              </span>
              <p className="mt-2 text-[14px] font-medium leading-snug">Payment is due before you have leverage to enforce it.</p>
              <p className="mt-1 text-[12px] leading-relaxed text-black/55">Clause 4.2: full payment on signing, delivery within 60 days.</p>
            </div>
          </div>
        )}
        {tab === "words" && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-black/40">Words to send</p>
            <p className="mt-2  text-[16px] leading-relaxed">&ldquo;Please cap revisions at two rounds. Extra rounds will be billed at my standard rate.&rdquo;</p>
            <div className="mt-3 flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-[#1C1917] px-3 py-1.5 text-[11px] font-semibold text-white">
                <FileText className="h-3 w-3" /> Copy
              </span>
              <span className="text-[11px] text-black/45">Written from the finding. Yours to send.</span>
            </div>
          </div>
        )}
        {tab === "guarded" && (
          <div className="space-y-2.5">
            <div className="flex items-center gap-3 rounded-xl border border-black/[0.06] bg-[#FAFAF8] px-3.5 py-2.5">
              <Scale className="h-4 w-4 shrink-0 text-[var(--burgundy)]" />
              <p className="text-[12px] font-medium">Both sides signed here — document locked, no silent edits.</p>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-black/[0.06] bg-[#FAFAF8] px-3.5 py-2.5">
              <ShieldCheck className="h-4 w-4 shrink-0 text-[var(--burgundy)]" />
              <p className="text-[12px] font-medium">Renewal in 21 days — email alert scheduled.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
