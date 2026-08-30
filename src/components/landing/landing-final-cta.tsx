import Link from "next/link"
import { ChevronRight } from "lucide-react"

export function LandingFinalCTA() {
  return (
    <section
      className="flex items-center justify-center px-6 py-32 sm:py-40"
      style={{
        background:
          "radial-gradient(ellipse 600px 400px at 50% 100%, rgba(139,0,0,0.35) 0%, transparent 70%), linear-gradient(to top, #3a0000 0%, #080808 60%)",
      }}
    >
      <div className="mx-auto max-w-[600px] text-center">
        <p className="text-3xl font-semibold leading-[1.15] tracking-tight text-white sm:text-4xl md:text-5xl">
          Your next brief is already
          <br />
          in your inbox.
        </p>
        <p className="mt-4 text-base text-[#a0a0a0]">Analyze it before you reply.</p>
        <Link
          href="/register"
          className="mt-8 inline-flex items-center gap-1.5 rounded-lg bg-brand-red px-6 py-3 text-sm font-medium text-white hover:bg-brand-red-hover transition-colors"
        >
          Analyze your first deal free
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  )
}
