import Link from "next/link"
import { notFound } from "next/navigation"

export const dynamic = "force-static"

const GUIDES: Record<string, { title: string; tag: string; desc: string }> = {
  "enterprise-tech-saas": {
    title: "Enterprise Tech & Cloud SaaS",
    tag: "IP & MSA GOVERNANCE",
    desc: "Review vendor master services agreements, warranty disclaimers, and data protection addendums with every risk traced to its clause.",
  },
  "professional-services": {
    title: "Professional Services & Agencies",
    tag: "SCOPE & BILLING DEFENSE",
    desc: "Review revision caps, staged payment milestones, and deliverable ownership terms before they cost margin.",
  },
  "real-estate-leases": {
    title: "Commercial Real Estate & Leases",
    tag: "LEASE & OPERATIONAL AUDIT",
    desc: "Review rent escalation formulas, CAM expense allocations, and renewal notice traps in commercial leases.",
  },
  "venture-partnerships": {
    title: "Venture & Strategic Partnerships",
    tag: "EQUITY & JURISDICTION COMPLIANCE",
    desc: "Review founder vesting schedules, deadlock provisions, and cross-border terms across US, UK, and CAMA frameworks.",
  },
}

export function generateStaticParams() {
  return Object.keys(GUIDES).map((slug) => ({ slug }))
}

export default async function InsightGuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const guide = GUIDES[slug]
  if (!guide) notFound()

  return (
    <main className="min-h-screen bg-paper text-neutral-900">
      <div className="mx-auto max-w-3xl px-6 py-16 lg:py-24">
        <Link href="/" className="text-[13px] font-medium text-neutral-500 hover:text-neutral-900">
          Back to Dealenz
        </Link>
        <p className="eyebrow mt-8 text-pine-700">{guide.tag}</p>
        <h1 className="display-h mt-3 text-[32px] leading-[1.1] sm:text-[44px]">{guide.title}</h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-neutral-600">{guide.desc}</p>

        <div className="mt-10 border border-neutral-200 bg-white p-6">
          <p className="text-[14px] font-semibold">This guide is being written.</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-600">
            How Dealenz matters for {guide.title.toLowerCase()}, the careers it touches, and the
            impact it has, told properly and at length. Meanwhile, the fastest way to understand
            it is to run your own agreement through the product.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/register" className="btn-ink h-10 px-5 text-[13px]">
              Try it on your contract
            </Link>
            <Link href="/methodology" className="btn-ghost-light h-10 px-5 text-[13px]">
              How review works
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
