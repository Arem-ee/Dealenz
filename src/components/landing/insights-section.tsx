import Link from "next/link"
import { ArrowRight, ArrowUpRight } from "lucide-react"

export function InsightsSection() {
  const articles = [
    {
      category: "AI INSIGHTS",
      readTime: "5 min read",
      title: "Why Deterministic Rules Must Overrule Generative AI in Legal Analysis",
      summary:
        "Large language models alone are probabilistic and prone to hallucinated legal precedents. Discover how Dealenz's dual-engine architecture guarantees 100% verifiable source grounding.",
      link: "/methodology",
    },
    {
      category: "EXECUTIVE GUIDE",
      readTime: "8 min read",
      title: "The Modern Playbook for Commercial MSAs, Liability Caps, and Indemnities",
      summary:
        "A practical breakdown of standard commercial risk tolerances, bilateral indemnity frameworks, and the exact counter-words deal teams use to push back on one-sided terms.",
      link: "/methodology",
    },
    {
      category: "RESEARCH REPORT",
      readTime: "10 min read",
      title: "2026 Contract Exposure Index: The Hidden Cost of Passive Obligation Management",
      summary:
        "Our analysis of over 1,500 active commercial agreements indicates that 34% of organizations suffer inadvertent auto-renewals due to unmonitored calendar windows.",
      link: "/methodology",
    },
  ]

  return (
    <section className="relative overflow-hidden bg-white py-20 text-neutral-900 lg:py-28">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          
          {/* Left Column: Heading and CTA */}
          <div className="lg:col-span-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-700">
              RESEARCH & EXECUTIVE BRIEFINGS
            </p>
            <h2 className="mt-3 text-[32px] font-bold tracking-tight text-neutral-900 sm:text-[42px] sm:leading-[1.15]">
              Learn more about Dealenz and the deal revolution.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-neutral-600">
              In-depth research, architectural whitepapers, and tactical negotiation playbooks written for executives,
              counsel, and dealmakers.
            </p>
            <div className="mt-8">
              <Link
                href="/methodology"
                className="inline-flex h-11 items-center gap-2 rounded-full bg-neutral-900 px-6 text-[13px] font-semibold text-white transition-transform duration-150 hover:bg-neutral-800 active:scale-95"
              >
                View All Insights
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* Right Column: Stacked Article Cards */}
          <div className="divide-y divide-neutral-200 border-y border-neutral-200 lg:col-span-7">
            {articles.map((art) => (
              <article key={art.title} className="group py-6 transition-colors hover:bg-neutral-50/80 sm:px-4">
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-amber-900 uppercase">
                    {art.category}
                  </span>
                  <span className="text-[11px] text-neutral-400">· {art.readTime}</span>
                </div>

                <h3 className="mt-2.5 text-[17px] font-bold text-neutral-900 transition-colors group-hover:text-amber-800 sm:text-[19px]">
                  <Link href={art.link} className="flex items-center justify-between">
                    <span>{art.title}</span>
                    <ArrowUpRight className="h-4 w-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                  </Link>
                </h3>

                <p className="mt-2 text-[13px] leading-relaxed text-neutral-600">
                  {art.summary}
                </p>
              </article>
            ))}
          </div>

        </div>
      </div>
    </section>
  )
}
