"use client"

import { useState } from "react"
import Image from "next/image"
import { Play, Star } from "lucide-react"

export function CustomerLoveSection() {
  const [activeTab, setActiveTab] = useState(0)

  const stories = [
    {
      company: "Apex Enterprise Systems",
      sector: "Fintech & Cloud SaaS",
      quote:
        "Dealenz cut our contract turnaround from two weeks to under 48 hours. Most importantly, its deterministic engine caught an uncapped IP indemnity buried in a 40-page vendor agreement that would have cost us millions. The generated counter-words were adopted by the counterparty without friction.",
      author: "Marcus Vance",
      title: "VP of Commercial Operations & Legal Counsel",
      metric: "80% Review Time Saved",
      image: "/founder.jpg",
    },
    {
      company: "Meridian Digital Ventures",
      sector: "Venture Studio & Cross-Border",
      quote:
        "When dealing with multi-jurisdictional contracts across the US, UK, and West Africa, generic AI tools fail completely. Dealenz gives our partners instantaneous clause-by-clause intelligence with verified legal citations. It’s like having an elite in-house deal committee on call 24/7.",
      author: "Amara Okonjo",
      title: "Managing Director & General Partner",
      metric: "100% Citation Grounding",
      image: "/mutual-terms.jpg",
    },
    {
      company: "Starlight Media Group",
      sector: "Creative & Enterprise Services",
      quote:
        "Before Dealenz, our clients constantly crept scope and slipped in unilateral termination clauses. Dealenz automatically flags every one-sided term and drafts professional pushback that protects our cash flow and milestones without alienating our clients.",
      author: "Elena Rostova",
      title: "Chief Operating Officer",
      metric: "Zero Uncapped Liabilities",
      image: "/hidden-clause.jpg",
    },
  ]

  const current = stories[activeTab]

  return (
    <section className="relative overflow-hidden bg-[#F8F8F6] py-20 text-neutral-900 lg:py-28">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        
        {/* Section Heading */}
        <div className="text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-700">
            EXECUTIVE SOCIAL PROOF
          </p>
          <h2 className="mt-3 text-[32px] font-bold tracking-tight text-neutral-900 sm:text-[44px]">
            Trusted by fast-moving leadership & deal teams.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-[15px] text-neutral-600 sm:text-[16px]">
            See how high-growth organizations use Dealenz to enforce governance, eliminate contract risk,
            and close transactions with complete certainty.
          </p>
        </div>

        {/* Company Tabs Bar */}
        <div className="mt-12 flex flex-wrap justify-center gap-3 border-b border-neutral-200 pb-4">
          {stories.map((s, idx) => (
            <button
              key={s.company}
              type="button"
              onClick={() => setActiveTab(idx)}
              className={`rounded-full px-5 py-2 text-[12px] font-bold tracking-wide transition-all ${
                activeTab === idx
                  ? "bg-neutral-900 text-white shadow-md"
                  : "bg-white text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
              }`}
            >
              {s.company}
            </button>
          ))}
        </div>

        {/* Main Testimonial Spotlight Card */}
        <div className="mt-8 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xl">
          <div className="grid lg:grid-cols-12">
            
            {/* Left: Pull Quote & Attribution */}
            <div className="flex flex-col justify-between p-8 sm:p-10 lg:col-span-7">
              <div>
                <div className="flex items-center gap-2">
                  <div className="flex text-amber-500">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                    · {current.sector}
                  </span>
                </div>

                <blockquote className="mt-6 text-[17px] font-medium leading-relaxed text-neutral-900 sm:text-[20px]">
                  &ldquo;{current.quote}&rdquo;
                </blockquote>
              </div>

              <div className="mt-8 flex items-center justify-between border-t border-neutral-100 pt-6">
                <div>
                  <h4 className="text-[15px] font-bold text-neutral-900">{current.author}</h4>
                  <p className="text-[12px] text-neutral-500">{current.title}</p>
                  <p className="mt-0.5 text-[11px] font-semibold text-amber-800">{current.company}</p>
                </div>
                <div className="hidden rounded-lg bg-amber-50 px-3 py-1.5 text-right sm:block">
                  <p className="text-[13px] font-bold text-amber-900">{current.metric}</p>
                  <p className="text-[10px] text-amber-700">Verified Result</p>
                </div>
              </div>
            </div>

            {/* Right: Executive Video Interview Preview Card */}
            <div className="relative min-h-[300px] overflow-hidden bg-neutral-900 lg:col-span-5">
              <Image
                src={current.image}
                alt={current.author}
                fill
                className="object-cover object-center filter grayscale contrast-125 brightness-90 transition-transform duration-700 hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/90 via-neutral-950/30 to-transparent" />

              {/* Video Play Button Overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-neutral-900 shadow-2xl backdrop-blur-sm transition-transform duration-200 hover:scale-110">
                  <Play className="ml-1 h-6 w-6 fill-neutral-900 text-neutral-900" />
                </div>
              </div>

              {/* Video Badge */}
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-white">
                <div>
                  <p className="text-[12px] font-bold">{current.author} on Deal Intelligence</p>
                  <p className="text-[10px] text-white/70">Watch Executive Case Study (2:40)</p>
                </div>
                <span className="rounded bg-black/60 px-2 py-0.5 font-mono text-[10px] text-white">
                  HD
                </span>
              </div>
            </div>

          </div>
        </div>

        {/* High-Impact Stat Callouts (Matching Agiloft Section 4) */}
        <div className="mt-14 grid gap-8 border-t border-neutral-200 pt-12 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-[44px] font-bold tracking-tight text-amber-600 sm:text-[52px]">
              96%<span className="text-[32px] text-amber-500">⁺</span>
            </p>
            <p className="mt-1 text-[13px] font-semibold text-neutral-900">Faster Review Velocity</p>
            <p className="mt-0.5 text-[12px] text-neutral-500">From incoming paper intake to counter-language ready to send.</p>
          </div>

          <div>
            <p className="text-[44px] font-bold tracking-tight text-neutral-900 sm:text-[52px]">93%</p>
            <p className="mt-1 text-[13px] font-semibold text-neutral-900">Reduction in Contract Blindspots</p>
            <p className="mt-0.5 text-[12px] text-neutral-500">Eliminating unmonitored auto-renewals and hidden liability traps.</p>
          </div>

          <div>
            <p className="text-[44px] font-bold tracking-tight text-neutral-900 sm:text-[52px]">98%</p>
            <p className="mt-1 text-[13px] font-semibold text-neutral-900">Executive Confidence Score</p>
            <p className="mt-0.5 text-[12px] text-neutral-500">Across thousands of audited commercial and vendor transactions.</p>
          </div>

          <div className="flex flex-col justify-between rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
            <p className="text-[12px] italic leading-relaxed text-neutral-700">
              &ldquo;Dealenz gives our leadership team the leverage of an elite general counsel without the \$600/hr retainer.&rdquo;
            </p>
            <div className="mt-3 flex items-center gap-2 border-t border-neutral-100 pt-2 text-[11px]">
              <span className="font-bold text-neutral-900">David S.</span>
              <span className="text-neutral-400">· Managing Partner</span>
            </div>
          </div>
        </div>

      </div>
    </section>
  )
}
