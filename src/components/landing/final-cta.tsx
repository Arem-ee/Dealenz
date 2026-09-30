import Link from "next/link"
import { ArrowRight } from "lucide-react"

export function FinalCta() {
  return (
    <section className="bg-ink py-28 text-center text-white lg:py-40">
      <div className="mx-auto max-w-4xl px-6 lg:px-8">
        <h2 className="display-h mx-auto max-w-2xl text-[34px] leading-[1.1] text-white sm:text-[48px]">
          Stop managing contracts. Start leveraging them.
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-white/70 sm:text-[17px]">
          Upload their paper and see what your deal really says.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/register" className="btn-paper">
            <span>Get Started Free</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/login" className="btn-ghost-dark">
            <span>Sign In to Console</span>
          </Link>
        </div>
        <p className="mt-4 text-[12px] text-white/50">
          10 free credits granted on registration · No credit card required
        </p>
      </div>
    </section>
  )
}
