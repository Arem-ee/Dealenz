import Link from "next/link"
import { Logo } from "@/components/logo"

export function LandingFooter() {
  return (
    <footer className="border-t border-black/[0.06] bg-white px-6 py-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 sm:flex-row sm:justify-between">
        <Logo />
        <div className="flex items-center gap-5">
          <Link href="/privacy" className="text-sm text-muted-foreground hover:text-[#1a0f0f] transition-colors">
            Privacy
          </Link>
          <Link href="/terms" className="text-sm text-muted-foreground hover:text-[#1a0f0f] transition-colors">
            Terms
          </Link>
          <Link href="/login" className="text-sm text-muted-foreground hover:text-[#1a0f0f] transition-colors">
            Sign in
          </Link>
        </div>
      </div>
      <p className="mt-6 text-center text-xs text-muted-foreground">
        Know the risk before you sign.
        <br />
        Dealenz is not a law firm and does not provide legal advice.
        <br />
        2026 Dealenz.
      </p>
    </footer>
  )
}
