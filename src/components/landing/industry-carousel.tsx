"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, ArrowRight, ArrowUpRight, Building2, Briefcase, Landmark, Handshake } from "lucide-react"

export function IndustryCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0)

  const industries = [
    {
      title: "Enterprise Tech & Cloud SaaS",
      tag: "IP & MSA GOVERNANCE",
      desc: "Review vendor master services agreements, warranty disclaimers, and data protection addendums with every risk traced to its clause.",
      icon: <Building2 className="h-7 w-7" />,
      highlight: "Flags one-sided liability and IP grabs",
    },
    {
      title: "Professional Services & Agencies",
      tag: "SCOPE & BILLING DEFENSE",
      desc: "Review revision caps, staged payment milestones, and deliverable ownership terms before they cost margin.",
      icon: <Briefcase className="h-7 w-7" />,
      highlight: "Flags scope creep on fixed-fee engagements",
    },
    {
      title: "Commercial Real Estate & Leases",
      tag: "LEASE & OPERATIONAL AUDIT",
      desc: "Review rent escalation formulas, CAM expense allocations, and renewal notice traps in commercial leases.",
      icon: <Landmark className="h-7 w-7" />,
      highlight: "Surfaces maintenance and exit penalties",
    },
    {
      title: "Venture & Strategic Partnerships",
      tag: "EQUITY & JURISDICTION COMPLIANCE",
      desc: "Review founder vesting schedules, deadlock provisions, and cross-border terms across US, UK, and CAMA frameworks.",
      icon: <Handshake className="h-7 w-7" />,
      highlight: "Surfaces voting and exit-term risks",
    },
  ]

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev === 0 ? industries.length - 1 : prev - 1))
  }

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === industries.length - 1 ? 0 : prev + 1))
  }

  return (
    <section className="relative overflow-hidden bg-[#FAFAF8] py-20 text-neutral-900 lg:py-28">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        
        {/* Header with Title and Nav Arrows */}
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-neutral-200 pb-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-700">
              SPECIALIZED PLAYBOOKS
            </p>
            <h2 className="mt-2 text-[30px] font-bold tracking-tight text-neutral-900 sm:text-[40px]">
              Explore by industry
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Previous slide"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-300 bg-white text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              aria-label="Next slide"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-300 bg-white text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Carousel Cards Grid */}
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((offset) => {
            const ind = industries[(currentIndex + offset) % industries.length]
            return (
              <div
                key={ind.title}
                className="group overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
              >
              {/* Card Icon Header */}
              <div className="relative flex h-36 w-full items-center justify-between overflow-hidden bg-neutral-900 px-6">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/15 bg-white/[0.05] text-amber-400">
                  {ind.icon}
                </span>
                <span className="rounded-md bg-white/90 px-2.5 py-1 text-[10px] font-bold tracking-wider text-neutral-900 uppercase">
                  {ind.tag}
                </span>
              </div>

              {/* Card Body */}
              <div className="p-6">
                <h3 className="text-[17px] font-bold text-neutral-900 transition-colors group-hover:text-amber-700">
                  {ind.title}
                </h3>
                <p className="mt-2 text-[13px] leading-relaxed text-neutral-600">
                  {ind.desc}
                </p>

                <div className="mt-4 border-t border-neutral-100 pt-3">
                  <p className="text-[11px] font-semibold text-emerald-700">
                    ✓ {ind.highlight}
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between text-[12px] font-bold text-neutral-900">
                  <Link href="/methodology" className="flex items-center gap-1 transition-colors group-hover:text-amber-700">
                    <span>Explore rulepack</span>
                    <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </Link>
                </div>
              </div>
            </div>
          )})}
        </div>

      </div>
    </section>
  )
}
