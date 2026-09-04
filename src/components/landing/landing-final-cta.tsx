import Link from "next/link"
import { ChevronRight } from "lucide-react"

export function LandingFinalCTA() {
  return (
    <section className="relative overflow-hidden bg-[#1a0f0f] px-6 py-32 sm:py-40">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-t from-brand-red/20 via-transparent to-transparent" />
        <div className="absolute bottom-0 left-1/2 h-[400px] w-[800px] -translate-x-1/2 rounded-full bg-brand-red/[0.12] blur-[60px]" />
      </div>
      <div className="relative mx-auto max-w-[600px] text-center">
        <p className="text-3xl font-semibold leading-[1.15] tracking-tight text-white sm:text-4xl md:text-5xl">
          Your next deal is already
          <br />
          waiting.
        </p>
        <p className="mt-4 text-base text-white/60">Know the risk before you sign.</p>
        <Link
          href="/register"
          className="mt-8 inline-flex items-center gap-1.5 rounded-full bg-brand-red px-6 py-3 text-sm font-medium text-white hover:bg-brand-red-hover transition-colors shadow-lg"
        >
          Analyze your deal free
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  )
}
