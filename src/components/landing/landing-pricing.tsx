import Link from "next/link"

const featureSet = [
  "Five analyses per day.",
  "All four document types.",
  "Client portal and signing.",
  "Activity timeline.",
]

const proFeatures = [
  "Everything in Free, plus:",
  "Higher daily analysis limit.",
  "Custom business profile on documents.",
  "Document version history.",
]

export function LandingPricing() {
  return (
    <section id="pricing" className="bg-[#fdfaf7] px-6 py-24 sm:py-32">
      <div className="mx-auto max-w-4xl">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-brand-red">Pricing</p>
        <p className="mt-3 text-3xl font-semibold tracking-tight text-[#1a0f0f] sm:text-4xl">Simple pricing.</p>
        <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="rounded-2xl border border-black/[0.06] bg-white p-8 shadow-sm">
            <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Free</p>
            <p className="mt-2 text-4xl font-semibold text-[#1a0f0f]">$0</p>
            <p className="mt-1 text-sm text-muted-foreground">For getting started</p>
            <ul className="mt-6 space-y-2">
              {featureSet.map((f) => (
                <li key={f} className="text-sm text-muted-foreground">{f}</li>
              ))}
            </ul>
            <Link
              href="/register"
              className="mt-8 flex w-full items-center justify-center rounded-full border border-black/[0.08] bg-white px-4 py-2.5 text-sm font-medium text-[#1a0f0f] hover:bg-black/[0.02] transition-colors"
            >
              Get started free
            </Link>
          </div>
          <div className="rounded-2xl border border-brand-red/20 bg-white p-8 shadow-[0_8px_32px_rgba(0,0,0,0.06)]">
            <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Pro</p>
            <p className="mt-2 text-4xl font-semibold text-[#1a0f0f]">$[price]</p>
            <p className="mt-1 text-sm text-muted-foreground">For active professionals</p>
            <ul className="mt-6 space-y-2">
              {proFeatures.map((f) => (
                <li key={f} className="text-sm text-muted-foreground">{f}</li>
              ))}
            </ul>
            <Link
              href="/contact"
              className="mt-8 flex w-full items-center justify-center rounded-full bg-brand-red px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-red-hover transition-colors shadow-sm"
            >
              Contact us
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
