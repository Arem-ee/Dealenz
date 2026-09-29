import Link from "next/link"
import { ArrowRight, FileCheck2, Lock, ScrollText, ShieldCheck } from "lucide-react"

export function RatingBanner() {
  const controls = [
    {
      icon: <Lock className="h-4 w-4" />,
      title: "AES-256 at rest, TLS in transit",
      body: "Databases encrypted at rest, every connection over HTTPS. No exceptions, no HTTP fallback.",
    },
    {
      icon: <ShieldCheck className="h-4 w-4" />,
      title: "Row-level access control",
      body: "Every table enforces owner-scoped access in the database itself, not just the app layer.",
    },
    {
      icon: <ScrollText className="h-4 w-4" />,
      title: "Immutable audit trail",
      body: "Signatures, versions, and resolutions are hash-linked and append-only. History cannot be rewritten.",
    },
    {
      icon: <FileCheck2 className="h-4 w-4" />,
      title: "SOC 2 Type II in progress",
      body: "Independent audit of our security controls is underway. Ask us for the current status and timeline.",
    },
  ]

  return (
    <section className="relative overflow-hidden bg-white py-20 text-neutral-900 lg:py-28">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-16">

          <div className="lg:col-span-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-[11px] font-bold text-amber-900">
              <ShieldCheck className="h-3.5 w-3.5 text-amber-700" />
              <span>SECURITY & COMPLIANCE POSTURE</span>
            </div>

            <h2 className="mt-4 text-[30px] font-bold tracking-tight text-neutral-900 sm:text-[42px] sm:leading-[1.1]">
              Contract intelligence your security team can approve.
            </h2>

            <p className="mt-4 text-[15px] leading-relaxed text-neutral-600 sm:text-[16px]">
              Generic chatbots guess at legal conclusions and train on your data. Dealenz couples
              model intelligence with deterministic rules that win every disagreement, and wraps
              the whole system in controls your IT review recognizes.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-4">
              <Link
                href="/methodology"
                className="inline-flex h-11 items-center gap-2 rounded-full bg-neutral-900 px-6 text-[13px] font-semibold text-white transition-transform duration-150 hover:bg-neutral-800 active:scale-95"
              >
                Read Our Methodology
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="lg:col-span-6">
            <ul className="divide-y divide-neutral-200 rounded-2xl border border-neutral-200 bg-[#FAFAF8]">
              {controls.map((c) => (
                <li key={c.title} className="flex items-start gap-3 p-5">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-700">
                    {c.icon}
                  </span>
                  <span>
                    <span className="block text-[14px] font-bold text-neutral-900">{c.title}</span>
                    <span className="mt-0.5 block text-[13px] leading-relaxed text-neutral-600">{c.body}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

        </div>
      </div>
    </section>
  )
}
