import Link from "next/link"
import { Logo } from "@/components/logo"

export function LandingFooter() {
  return (
    <footer className="bg-[#1a0f0f] px-6 pt-16 pb-8">
      <div className="mx-auto grid max-w-6xl gap-10 sm:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <span className="text-white">
            <Logo />
          </span>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/60">
            Know the risk before you sign.
          </p>
        </div>
        <nav aria-label="Product">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-white/40">Product</p>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li>
              <Link href="/#how-it-works" className="text-white/70 transition-colors hover:text-white">
                How it works
              </Link>
            </li>
            <li>
              <Link href="/#pricing" className="text-white/70 transition-colors hover:text-white">
                Pricing
              </Link>
            </li>
            <li>
              <Link href="/login" className="text-white/70 transition-colors hover:text-white">
                Sign in
              </Link>
            </li>
            <li>
              <Link href="/audit/new" className="text-white/70 transition-colors hover:text-white">
                Analyze your deal
              </Link>
            </li>
          </ul>
        </nav>
        <nav aria-label="Legal">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-white/40">Legal</p>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li>
              <Link href="/privacy" className="text-white/70 transition-colors hover:text-white">
                Privacy
              </Link>
            </li>
            <li>
              <Link href="/terms" className="text-white/70 transition-colors hover:text-white">
                Terms
              </Link>
            </li>
          </ul>
        </nav>
      </div>
      <div className="mx-auto mt-12 max-w-6xl border-t border-white/10 pt-6">
        <p className="text-center text-xs leading-relaxed text-white/50">
          Know the risk before you sign.
          <br />
          Dealenz is not a law firm and does not provide legal advice.
          <br />
          2026 Dealenz.
        </p>
      </div>
    </footer>
  )
}
