import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { Reveal } from "@/components/landing/reveal"

const INDUSTRIES = [
  {
    title: "Enterprise Tech & Cloud SaaS",
    tag: "IP & MSA GOVERNANCE",
    desc: "Review vendor master services agreements, warranty disclaimers, and data protection addendums with every risk traced to its clause.",
    image: "/industries/tech-saas.jpg",
    alt: "Enterprise technology team reviewing vendor agreements",
    slug: "enterprise-tech-saas",
    highlight: "Flags one-sided liability and IP grabs",
  },
  {
    title: "Professional Services & Agencies",
    tag: "SCOPE & BILLING DEFENSE",
    desc: "Review revision caps, staged payment milestones, and deliverable ownership terms before they cost margin.",
    image: "/industries/professional-services.jpg",
    alt: "Agency team reviewing client scope and billing terms",
    slug: "professional-services",
    highlight: "Flags scope creep on fixed-fee engagements",
  },
  {
    title: "Commercial Real Estate & Leases",
    tag: "LEASE & OPERATIONAL AUDIT",
    desc: "Review rent escalation formulas, CAM expense allocations, and renewal notice traps in commercial leases.",
    image: "/industries/real-estate-leases.jpg",
    alt: "Commercial office building exterior",
    slug: "real-estate-leases",
    highlight: "Surfaces maintenance and exit penalties",
  },
  {
    title: "Venture & Strategic Partnerships",
    tag: "EQUITY & JURISDICTION COMPLIANCE",
    desc: "Review founder vesting schedules, deadlock provisions, and cross-border terms across US, UK, and CAMA frameworks.",
    image: "/industries/venture-partnerships.jpg",
    alt: "Founders reviewing partnership terms",
    slug: "venture-partnerships",
    highlight: "Surfaces voting and exit-term risks",
  },
]

export function Industries() {
  return (
    <section className="bg-paper py-28 text-neutral-900 lg:py-40">
      <Reveal className="mx-auto max-w-6xl px-6 lg:px-8">
        <div className="max-w-3xl">
          <h2 className="display-h mt-0 text-[30px] text-neutral-900 sm:text-[40px]">
            Explore by industry
          </h2>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {INDUSTRIES.map((ind, i) => (
            <Reveal key={ind.slug} delay={Math.min(i * 0.09, 0.3)} className="h-full">
            <Link
              href={`/insights/${ind.slug}`}
              className="group flex h-full flex-col border border-neutral-200 bg-white shadow-raised transition-colors hover:border-neutral-900 hover:shadow-surface"
              aria-label={`${ind.title} — read how Dealenz matters for this industry`}
            >
              <div className="relative h-44 w-full overflow-hidden bg-neutral-200">
                {/* eslint-disable-next-line @next/next/no-img-element -- author-supplied industry photography, not an optimizable asset */}
                <img
                  src={ind.image}
                  alt={ind.alt}
                  loading="lazy"
                  className="h-full w-full object-cover grayscale"
                />
                <span className="absolute bottom-3 left-3 bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-neutral-900">
                  {ind.tag}
                </span>
              </div>

              <div className="flex flex-1 flex-col p-6">
                <h3 className="display-h text-[17px] text-neutral-900">{ind.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-neutral-600">{ind.desc}</p>
                <p className="mt-3 border-t border-neutral-100 pt-3 text-[11px] font-semibold text-pine-700">
                  {ind.highlight}
                </p>
                <p className="mt-3 flex items-center gap-1 text-[12px] font-bold text-neutral-900">
                  Read the guide
                  <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </p>
              </div>
            </Link>
            </Reveal>
          ))}
        </div>
      </Reveal>
    </section>
  )
}
