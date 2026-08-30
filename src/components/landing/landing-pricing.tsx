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
    <section id="pricing" className="bg-[#0f0f0f] px-6 py-24 sm:py-32">
      <div className="mx-auto max-w-4xl">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-brand-red">Pricing</p>
        <p className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Simple pricing.</p>
        <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a] p-8 shadow-sm">
            <p className="text-sm font-medium uppercase tracking-wider text-[#606060]">Free</p>
            <p className="mt-2 text-4xl font-semibold text-white">$0</p>
            <p className="mt-1 text-sm text-[#a0a0a0]">For getting started</p>
            <ul className="mt-6 space-y-2">
              {featureSet.map((f) => (
                <li key={f} className="text-sm text-[#a0a0a0]">{f}</li>
              ))}
            </ul>
            <Link
              href="/register"
              className="mt-8 flex w-full items-center justify-center rounded-lg border border-[#2a2a2a] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#2a2a2a] transition-colors"
            >
              Get started free
            </Link>
          </div>
          <div className="rounded-2xl border border-[#2a2a2a] border-t-brand-red bg-[#1a1a1a] p-8 shadow-sm">
            <p className="text-sm font-medium uppercase tracking-wider text-[#606060]">Pro</p>
            <p className="mt-2 text-4xl font-semibold text-white">$[price]</p>
            <p className="mt-1 text-sm text-[#a0a0a0]">For active professionals</p>
            <ul className="mt-6 space-y-2">
              {proFeatures.map((f) => (
                <li key={f} className="text-sm text-[#a0a0a0]">{f}</li>
              ))}
            </ul>
            <Link
              href="/contact"
              className="mt-8 flex w-full items-center justify-center rounded-lg bg-brand-red px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-red-hover transition-colors"
            >
              Contact us
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
