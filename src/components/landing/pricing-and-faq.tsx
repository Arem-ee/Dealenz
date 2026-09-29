import Link from "next/link"
import { Check } from "lucide-react"

export function PricingAndFaq() {
  const faqs = [
    {
      q: "How does Dealenz differ from generic AI contract tools?",
      a: "Generic AI tools rely purely on probabilistic token prediction, which causes dangerous legal hallucinations on complex clauses. Dealenz operates a dual-engine architecture: frontier AI extracts terms, but every finding must be validated against deterministic legal rulepacks (Commercial MSAs, Leases, IP Assignment). If there is insufficient source evidence, Dealenz reports it as unknown rather than guessing.",
    },
    {
      q: "Can counterparties sign without creating an account?",
      a: "Yes. Dealenz provides frictionless counterparty signing. You sign first, and the counterparty receives a secure, encrypted link to review and sign without being forced to register, pay, or install any software. Once executed, the agreement locks cryptographically.",
    },
    {
      q: "Is Dealenz a replacement for in-house or outside counsel?",
      a: "No. Dealenz is an intelligence, triage, and negotiation acceleration platform. It catches high-risk clauses in minutes, drafts pre-approved pushback words, and prepares a clean, structured dossier with quoted clause diffs for outside counsel when high-stakes human sign-off is needed.",
    },
    {
      q: "How does the post-signature obligation watchdog work?",
      a: "Dealenz extracts key milestone obligations, liability caps, notice windows, and auto-renewal dates from your executed agreements. By syncing with Gmail or Outlook, it automatically delivers alert notifications 30, 60, or 90 days before deadlines occur, preventing unintended auto-renewals.",
    },
    {
      q: "How is our sensitive contract data secured and isolated?",
      a: "Dealenz offers in-browser client-side masking so you can scrub sensitive counterparties, rates, and personal data before transmission. All platform databases are hosted in the European Union with AES-256 encryption at rest and in transit, zero third-party advertising tracking, and SOC 2 Type II compliance.",
    },
  ]

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
              Every account starts with 10 free credits to analyze your first two contracts.
              Purchase additional credits on-demand as your deal flow demands.
            </p>
          </div>

          <div className="mt-14 grid gap-8 md:grid-cols-3">
            {/* Free Tier */}
            <div className="flex flex-col justify-between rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
              <div>
                <span className="rounded-full bg-neutral-100 px-3 py-1 text-[11px] font-bold tracking-wider text-neutral-700 uppercase">
                  Starter Grant
                </span>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-[40px] font-bold tracking-tight text-neutral-900">$0</span>
                  <span className="text-[13px] text-neutral-500">/ forever free</span>
                </div>
                <p className="mt-2 text-[13px] text-neutral-600">
                  10 free credits upon account registration. Covers your first two complete deal audits.
                </p>

                <ul className="mt-6 space-y-3 text-[13px] text-neutral-700">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600" />
                    <span>2 Full Contract Risk Audits</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600" />
                    <span>Lawyer-Grade Counter-Drafts</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600" />
                    <span>Frictionless Counterparty E-Sign</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600" />
                    <span>In-Browser Privacy Masking</span>
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

            {/* Standard Tier (Featured) */}
            <div className="relative flex flex-col justify-between rounded-2xl border-2 border-amber-500 bg-white p-8 shadow-xl">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber-500 px-3 py-0.5 text-[10px] font-extrabold tracking-wider text-neutral-950 uppercase">
                Most Popular for Active Deals
              </span>

              <div>
                <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-bold tracking-wider text-amber-900 uppercase">
                  Growth Pack
                </span>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-[40px] font-bold tracking-tight text-neutral-900">$49</span>
                  <span className="text-[13px] text-neutral-500">/ 50 credits</span>
                </div>
                <p className="mt-2 text-[13px] text-neutral-600">
                  Ideal for teams actively negotiating commercial agreements, leases, and vendor MSAs.
                </p>

                <ul className="mt-6 space-y-3 text-[13px] text-neutral-700">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600" />
                    <span>10 Full Contract Audits & Redlines</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600" />
                    <span>All Deterministic Rulepacks Included</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600" />
                    <span>Continuous Obligation Watchdog Alerts</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600" />
                    <span>Exportable Outside Counsel Dossiers</span>
                  </li>
                </ul>
              </div>

              <div className="mt-8">
                <Link
                  href="/register"
                  className="inline-flex h-11 w-full items-center justify-center rounded-full bg-neutral-900 text-[13px] font-bold text-white shadow-md transition-transform hover:bg-neutral-800 active:scale-95"
                >
                  Get Growth Pack
                </Link>
              </div>
            </div>

            {/* Enterprise Tier */}
            <div className="flex flex-col justify-between rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
              <div>
                <span className="rounded-full bg-neutral-100 px-3 py-1 text-[11px] font-bold tracking-wider text-neutral-700 uppercase">
                  Scale & Portfolio
                </span>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-[40px] font-bold tracking-tight text-neutral-900">$149</span>
                  <span className="text-[13px] text-neutral-500">/ 200 credits</span>
                </div>
                <p className="mt-2 text-[13px] text-neutral-600">
                  Designed for heavy deal flow, multi-entity holdings, and institutional deal governance.
                </p>

                <ul className="mt-6 space-y-3 text-[13px] text-neutral-700">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600" />
                    <span>40 Full Contract Audits & Redlines</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600" />
                    <span>Priority Processing & OCR Speed</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600" />
                    <span>Multi-Corridor CAMA & Cross-Border Rules</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600" />
                    <span>Dedicated Integration Support</span>
                  </li>
                </ul>
              </div>

              <div className="mt-8">
                <Link
                  href="/register"
                  className="inline-flex h-11 w-full items-center justify-center rounded-full border border-neutral-300 bg-white text-[13px] font-bold text-neutral-900 transition-colors hover:bg-neutral-50"
                >
                  Buy Scale Credits
                </Link>
              </div>
            </div>
          </div>
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
