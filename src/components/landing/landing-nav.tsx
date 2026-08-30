import Link from "next/link"
import { Logo } from "@/components/logo"

const linkClass = "text-sm text-[#a0a0a0] hover:text-white transition-colors"

export function LandingNav() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-md border-b border-[#1f1f1f]">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link href="/">
          <Logo />
        </Link>
        <div className="flex items-center gap-6">
          <a href="#how-it-works" className={linkClass}>How it works</a>
          <a href="#pricing" className={linkClass}>Pricing</a>
          <Link href="/login" className={linkClass}>Sign in</Link>
          <Link
            href="/register"
            className="rounded-lg bg-brand-red px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-red-hover transition-colors"
          >
            Analyze your first deal
          </Link>
        </div>
      </div>
    </nav>
  )
}
