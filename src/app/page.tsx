import Link from "next/link"
import { ArrowRight, ShieldCheck, Cpu, BellRing } from "lucide-react"
import { SiteHeader } from "@/components/landing/site-header"
import { HeroMockup } from "@/components/landing/hero-mockup"
import { TrustStrip } from "@/components/landing/trust-strip"
import { Advantage } from "@/components/landing/advantage"
import { Impact } from "@/components/landing/impact"
import { Comparison } from "@/components/landing/comparison"
import { Workflows } from "@/components/landing/workflows"
import { Industries } from "@/components/landing/industries"
import { ViewPricing } from "@/components/landing/view-pricing"
import { FinalCta } from "@/components/landing/final-cta"
import { SiteFooter } from "@/components/landing/site-footer"

export const metadata = {
  title: "Dealenz — Enterprise Contract & Deal Intelligence Platform",
  description:
    "The enterprise deal platform that extracts risk, enforces deterministic playbooks, automates counter-drafts, and guards contractual obligations across your agreement lifecycle.",
}

const softwareSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Dealenz",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  description:
    "Enterprise deal intelligence: deterministic contract review, counter-language drafting, signing, and obligation monitoring.",
}

export default function Home() {
  return (
    <div className="min-h-screen bg-ink text-white selection:bg-pine-500 selection:text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
      />

      <SiteHeader />

      <main>
        <section className="relative overflow-hidden pt-20 pb-28 lg:pt-28 lg:pb-40">
          <div className="relative z-10 mx-auto max-w-6xl px-6 text-center lg:px-8">

            <h1 className="display-h mx-auto mt-2 max-w-3xl text-balance text-[36px] leading-[1.08] text-white sm:text-[54px] lg:text-[64px]">
              Turn Contracts into Strategic Intelligence with AI Deal Management.
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-[15px] leading-relaxed text-white/75 sm:text-[17px]">
              The enterprise deal platform that extracts risk, enforces deterministic playbooks, automates counter-drafts, and guards contractual obligations across your agreement lifecycle.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/register" className="btn-paper">
                <span>Get Started Free</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="#platform" className="btn-ghost-dark">
                <span>Explore Platform</span>
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[12px] font-semibold text-white/60">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-pine-400" />
                Deterministic Rule Engine
              </span>
              <span className="flex items-center gap-1.5">
                <Cpu className="h-4 w-4 text-pine-400" />
                Deterministic Risk Scoring
              </span>
              <span className="flex items-center gap-1.5">
                <BellRing className="h-4 w-4 text-pine-400" />
                Renewal & Obligation Monitoring
              </span>
            </div>

            <div id="platform" className="mt-8">
              <HeroMockup />
              <p className="mx-auto mt-3 max-w-4xl text-center text-[11px] text-white/40">
                Illustrated example. A freelance analysis can produce this exact report, with every finding traced to its source clause.
              </p>
            </div>

          </div>
        </section>

        <TrustStrip />

        <Advantage />

        <Impact />

        <Comparison />

        <Workflows />

        <Industries />

        <ViewPricing />

        <FinalCta />
      </main>

      <SiteFooter />
    </div>
  )
}
