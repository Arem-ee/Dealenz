"use client"

import { useState } from "react"
import Image from "next/image"
import { ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react"

export function IndustryCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0)

  const industries = [
    {
      title: "Enterprise Tech & Cloud SaaS",
      tag: "IP & MSA GOVERNANCE",
      desc: "Audit vendor master services agreements, warranty disclaimers, and data protection addendums without weeks of back-and-forth.",
      image: "/founder.jpg",
      highlight: "Pushes for mutual liability caps and IP preservation",
    },
    {
      title: "Professional Services & Agencies",
      tag: "SCOPE & BILLING DEFENSE",
      desc: "Cap revision loops, lock in staged payment milestones, and ensure deliverable ownership transfers only after final invoice settlement.",
      image: "/hidden-clause.jpg",
      highlight: "Flags scope creep on fixed-fee engagements",
    },
    {
      title: "Commercial Real Estate & Leases",
      tag: "LEASE & OPERATIONAL AUDIT",
      desc: "Dissect rent escalation formulas, CAM expense allocations, and renewal notice traps across complex commercial leasing agreements.",
      image: "/deal-plan.jpg",
      highlight: "Detects hidden maintenance and early exit penalties",
    },
    {
      title: "Venture & Strategic Partnerships",
      tag: "EQUITY & JURISDICTION COMPLIANCE",
      desc: "Evaluate founder vesting schedules, deadlock resolution mechanisms, and cross-border regulatory frameworks across US, UK, and CAMA.",
      image: "/mutual-terms.jpg",
      highlight: "Protects minority shareholder & voting rights",
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
              {/* Card Photo Header */}
              <div className="relative h-56 w-full overflow-hidden bg-neutral-900">
                <Image
                  src={ind.image}
                  alt={ind.title}
                  fill
                  className="object-cover filter grayscale contrast-125 brightness-95 transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-neutral-950/25" />
                <span className="absolute bottom-3 left-4 rounded-md bg-white/90 px-2.5 py-1 text-[10px] font-bold tracking-wider text-neutral-900 uppercase backdrop-blur-xs">
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
                  <span>Explore rulepack</span>
                  <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
              </div>
            </div>
          )})}
        </div>

      </div>
    </section>
  )
}
