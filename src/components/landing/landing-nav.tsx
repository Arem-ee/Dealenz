import Link from "next/link"
import { Logo } from "@/components/logo"

export function LandingNav() {
  return (
    <nav className="sticky top-0 z-30 flex items-center justify-between px-6 sm:px-10 py-4 glass-extreme border-b border-white/60">
      <Logo />
      <div className="hidden md:flex items-center gap-6 text-sm text-[#141110]/70">
        <a href="#how-it-works">How it works</a>
        <a href="#pricing">Pricing</a>
      </div>
      <div className="flex items-center gap-4">
        <Link href="/login" className="text-sm">Sign in</Link>
        <Link
          href="/audit/new"
          className="rounded-full bg-[var(--primary)] text-white px-5 py-2.5 text-sm font-medium"
        >
          Analyze your deal free
        </Link>
      </div>
    </nav>
  )
}