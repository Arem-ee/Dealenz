import Link from "next/link"
import { Check } from "lucide-react"
import { CREDIT_PACKAGES, formatPrice, packageValueLines, type Currency } from "@/lib/billing/catalog"

const DISPLAY_CURRENCY: Currency = "USD"

export function PricingAndFaq() {
  const faqs = [
    {
      q: "How does Dealenz differ from generic AI contract tools?",
      a: "Generic AI tools predict likely text, which fails on complex clauses. Dealenz pairs model intelligence with deterministic legal rulepacks: every finding must be validated against the rules, and where source evidence is thin, Dealenz reports unknown rather than guessing.",
    },
    {
      q: "Can counterparties sign without creating an account?",
      a: "Yes. You sign first, then the counterparty receives a link to review and sign without registering, paying, or installing anything. Once fully signed, the agreement locks against further edits.",
    },
    {
      q: "Is Dealenz a replacement for in-house or outside counsel?",
      a: "No. Dealenz is an intelligence, triage, and negotiation-acceleration platform. It surfaces high-risk clauses in minutes, drafts suggested pushback, and prepares a structured handoff with quoted clauses for outside counsel when high-stakes human sign-off is needed.",
    },
    {
      q: "How do post-signature reminders work?",
      a: "Dealenz pulls dated obligations out of the signed text and runs a daily check. Deadlines due within 7 days land in a digest delivered by email when Gmail is connected. Undated obligations stay visible with no invented dates.",
    },
    {
      q: "How is our contract data secured?",
      a: "Mask sensitive details in your browser before anything is sent. Databases are EU-hosted with AES-256 encryption at rest and TLS in transit, advertising trackers are absent, and a SOC 2 Type II audit of our controls is in progress.",
    },
    {
      q: "Do you offer SSO, a DPA, or an API for our legal team?",
      a: "Enterprise plans include SAML SSO, a signed data processing agreement, audit-log export, and API access. These ship with the enterprise tier: start a conversation and we will scope them to your review.",
    },
  ]

  const [starter, standard, pro] = CREDIT_PACKAGES

  return (
    <>
      {/* Pricing Section */}
      <section id="pricing" className="relative overflow-hidden bg-[#FAFAF8] py-20 text-neutral-900 lg:py-28">
        <div className="mx-auto max-w-6xl px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-700">
              TRANSPARENT VALUE PRICING
            </p>
            <h2 className="mt-3 text-[32px] font-bold tracking-tight text-neutral-900 sm:text-[44px]">
              Pay per deal outcome. No subscription lock-in.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-neutral-600 sm:text-[16px]">
              Every account starts with 10 free credits for your first two deal analyses.
              Top up with credit packs when you need them. Credits never expire into a subscription.
            </p>
          </div>

          <div className="mt-14 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {/* Free Tier */}
            <div className="flex flex-col justify-between rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
              <div>
                <span className="rounded-full bg-neutral-100 px-3 py-1 text-[11px] font-bold tracking-wider text-neutral-700 uppercase">
                  Free
                </span>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-[40px] font-bold tracking-tight text-neutral-900">$0</span>
                  <span className="text-[13px] text-neutral-500">/ 10 free credits</span>
                </div>
                <p className="mt-2 text-[13px] text-neutral-600">
                  Granted on registration. Covers your first two complete deal analyses.
                </p>

                <ul className="mt-6 space-y-3 text-[13px] text-neutral-700">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600" />
                    <span>2 full deal analyses</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600" />
                    <span>Suggested counter-language</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600" />
                    <span>Counterparty signing</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600" />
                    <span>In-browser privacy masking</span>
                  </li>
                </ul>
              </div>

              <div className="mt-8">
                <Link
                  href="/register"
                  className="inline-flex h-11 w-full items-center justify-center rounded-full border border-neutral-300 bg-white text-[13px] font-bold text-neutral-900 transition-colors hover:bg-neutral-50"
                >
                  Start with 10 Free Credits
                </Link>
              </div>
            </div>

            {/* Credit packs from the live catalog */}
            {[
              { pkg: starter, name: "Starter", blurb: "For occasional deals and single agreements.", featured: false },
              { pkg: standard, name: "Standard", blurb: "For active pipelines and repeat negotiations.", featured: true },
              { pkg: pro, name: "Pro", blurb: "For heavy deal flow and portfolio tracking.", featured: false },
            ].map(({ pkg, name, blurb, featured }) => (
              pkg && (
                <div
                  key={pkg.id}
                  className={`relative flex flex-col justify-between rounded-2xl bg-white p-8 ${featured ? "border-2 border-amber-500 shadow-xl" : "border border-neutral-200 shadow-sm"}`}
                >
                  {featured && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber-500 px-3 py-0.5 text-[10px] font-extrabold tracking-wider text-neutral-950 uppercase">
                      For Active Pipelines
                    </span>
                  )}
                  <div>
                    <span className={`rounded-full px-3 py-1 text-[11px] font-bold tracking-wider uppercase ${featured ? "bg-amber-100 text-amber-900" : "bg-neutral-100 text-neutral-700"}`}>
                      {name}
                    </span>
                    <div className="mt-4 flex items-baseline gap-1">
                      <span className="text-[40px] font-bold tracking-tight text-neutral-900">{formatPrice(pkg.prices[DISPLAY_CURRENCY], DISPLAY_CURRENCY)}</span>
                      <span className="text-[13px] text-neutral-500">/ {pkg.credits} credits</span>
                    </div>
                    <p className="mt-2 text-[13px] text-neutral-600">{blurb}</p>
                    <ul className="mt-6 space-y-3 text-[13px] text-neutral-700">
                      {packageValueLines(pkg.credits).map((line) => (
                        <li key={line} className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-emerald-600" />
                          <span className="capitalize">{line}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="mt-8">
                    <Link
                      href="/register"
                      className={`inline-flex h-11 w-full items-center justify-center rounded-full text-[13px] font-bold transition-transform active:scale-95 ${featured ? "bg-neutral-900 text-white shadow-md hover:bg-neutral-800" : "border border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50"}`}
                    >
                      Get {name}
                    </Link>
                  </div>
                </div>
              )
            ))}
          </div>

          <p className="mx-auto mt-8 max-w-3xl text-center text-[13px] text-neutral-600">
            Running an enterprise legal function? SSO, a signed DPA, audit-log export, and API
            access ship with the enterprise tier.{" "}
            <Link href="/register" className="font-semibold text-neutral-900 underline underline-offset-2 hover:text-amber-800">
              Talk to us
            </Link>
            .
          </p>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="relative overflow-hidden bg-white py-20 text-neutral-900 lg:py-28">
        <div className="mx-auto max-w-4xl px-6 lg:px-8">
          <div className="text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-700">
              CLARITY & ASSURANCE
            </p>
            <h2 className="mt-3 text-[30px] font-bold tracking-tight text-neutral-900 sm:text-[40px]">
              Frequently Asked Questions
            </h2>
            <p className="mt-3 text-[15px] text-neutral-600">
              Everything you need to know about our deterministic engine, security posture, and workflow.
            </p>
          </div>

          <div className="mt-12 divide-y divide-neutral-200 border-y border-neutral-200">
            {faqs.map((faq) => (
              <details key={faq.q} className="group py-6">
                <summary className="flex cursor-pointer list-none items-center justify-between text-[16px] font-bold text-neutral-900 [&::-webkit-details-marker]:hidden">
                  <span>{faq.q}</span>
                  <span className="ml-4 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-neutral-300 text-neutral-500 transition-transform duration-200 group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 max-w-3xl text-[14px] leading-relaxed text-neutral-600">
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
