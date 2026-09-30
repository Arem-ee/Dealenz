"use client"

import { useLayoutEffect, useRef } from "react"
import Link from "next/link"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { ArrowRight } from "lucide-react"

gsap.registerPlugin(ScrollTrigger)

export function ViewPricing() {
  const bandRef = useRef<HTMLElement | null>(null)

  useLayoutEffect(() => {
    const el = bandRef.current
    if (!el) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const ctx = gsap.context(() => {
      gsap.from("[data-reveal]", {
        y: 28,
        opacity: 0,
        duration: 0.7,
        ease: "power3.out",
        stagger: 0.12,
        scrollTrigger: { trigger: el, start: "top 80%" },
      })
      gsap.fromTo(
        "[data-rule]",
        { scaleX: 0 },
        {
          scaleX: 1,
          ease: "none",
          scrollTrigger: { trigger: el, start: "top 85%", end: "top 35%", scrub: true },
        }
      )
    }, el)
    return () => ctx.revert()
  }, [])

  return (
    <section ref={bandRef} className="bg-ink py-28 text-white lg:py-40">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 data-reveal className="display-h mt-0 text-[30px] text-white sm:text-[40px]">
            Pay per deal outcome. No subscription lock-in.
          </h2>
          <p data-reveal className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-white/70">
            10 free credits to start. Top up with credit packs only when your deal flow demands it.
          </p>
          <div data-reveal data-rule className="mx-auto mt-8 h-0.5 w-full max-w-md origin-left bg-pine-500" />
          <div data-reveal className="mt-8">
            <Link href="/pricing" className="btn-paper group">
              <span>View pricing</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
