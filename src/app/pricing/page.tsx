import Link from "next/link"
import { Check } from "lucide-react"
import { CREDIT_PACKAGES, formatPrice, packageValueLines, type Currency } from "@/lib/billing/catalog"

export const metadata = {
  title: "Pricing",
}

const DISPLAY_CURRENCY: Currency = "USD"

const FAQS = [
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

export default function PricingPage() {
  const [starter, standard, pro] = CREDIT_PACKAGES

  return (
    <main className="min-h-screen bg-paper text-neutral-900">
      <div className="mx-auto max-w-6xl px-6 py-24 lg:px-8 lg:py-32">
        <Link href="/" className="text-[13px] font-medium text-neutral-500 hover:text-neutral-900">
          Back to Dealenz
        </Link>

        <div className="mx-auto mt-8 max-w-3xl text-center">
          <h1 className="display-h text-[32px] text-neutral-900 sm:text-[44px]">
            Pay per deal, or subscribe for allowance.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-neutral-600">
            Every account starts with 10 free credits for your first two deal analyses.
            Top up with credit packs when you need them, or subscribe for a monthly
            allowance. Cancel anytime, effective at period end.
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col justify-between border border-neutral-200 bg-white p-7">
            <div>
              <span className="bg-neutral-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-neutral-700">
                Free
              </span>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="display-h text-[40px] text-neutral-900">$0</span>
                <span className="text-[13px] text-neutral-500">/ 10 free credits</span>
              </div>
              <p className="mt-2 text-[13px] text-neutral-600">
                Granted on registration. Covers your first two complete deal analyses.
              </p>
              <ul className="mt-6 space-y-3 text-[13px] text-neutral-700">
                {["2 full deal analyses", "Suggested counter-language", "Counterparty signing", "In-browser privacy masking"].map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-neutral-900" strokeWidth={3} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-8">
              <Link href="/register" className="btn-ink h-11 w-full text-[13px]">
                Start with 10 Free Credits
              </Link>
            </div>
          </div>

          {[
            { pkg: starter, name: "Starter", blurb: "For occasional deals and single agreements." },
            { pkg: standard, name: "Standard", blurb: "For active pipelines and repeat negotiations." },
            { pkg: pro, name: "Pro", blurb: "For heavy deal flow and portfolio tracking." },
          ].map(({ pkg, name, blurb }) => (
            pkg && (
              <div key={pkg.id} className="flex flex-col justify-between border border-neutral-200 bg-white p-7">
                <div>
                  <span className="bg-neutral-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-neutral-700">
                    {name}
                  </span>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="display-h text-[40px] text-neutral-900">{formatPrice(pkg.prices[DISPLAY_CURRENCY], DISPLAY_CURRENCY)}</span>
                    <span className="text-[13px] text-neutral-500">/ {pkg.credits} credits</span>
                  </div>
                  <p className="mt-2 text-[13px] text-neutral-600">{blurb}</p>
                  <ul className="mt-6 space-y-3 text-[13px] text-neutral-700">
                    {packageValueLines(pkg.credits).map((line) => (
                      <li key={line} className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-neutral-900" strokeWidth={3} />
                        <span className="capitalize">{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="mt-8">
                  <Link href="/register" className="btn-ink h-11 w-full text-[13px]">
                    Get {name}
                  </Link>
                </div>
              </div>
            )
          ))}
        </div>

        <p className="mx-auto mt-10 max-w-3xl text-center text-[13px] text-neutral-600">
          Running an enterprise legal function? SSO, a signed DPA, audit-log export, and API
          access ship with the enterprise tier.{" "}
          <Link href="/register" className="font-semibold text-neutral-900 underline underline-offset-2 hover:text-pine-700">
            Talk to us
          </Link>
          .
        </p>

        <div className="mx-auto mt-20 max-w-4xl" id="faq">
          <div className="text-center">
            <h2 className="display-h text-[28px] text-neutral-900 sm:text-[36px]">
              Frequently Asked Questions
            </h2>
          </div>
          <div className="mt-10 divide-y divide-neutral-200 border-y border-neutral-200">
            {FAQS.map((faq) => (
              <details key={faq.q} className="group py-6">
                <summary className="flex cursor-pointer list-none items-center justify-between text-[16px] font-bold text-neutral-900 [&::-webkit-details-marker]:hidden">
                  <span>{faq.q}</span>
                  <span className="ml-4 flex h-6 w-6 shrink-0 items-center justify-center border border-neutral-300 text-neutral-500 transition-transform duration-200 group-open:rotate-45">
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
      </div>
    </main>
  )
}
