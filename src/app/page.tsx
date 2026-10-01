import Link from "next/link"
import { ArrowRight } from "lucide-react"
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
import { Reveal } from "@/components/landing/reveal"

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
        <section className="relative flex min-h-[92svh] flex-col justify-center overflow-hidden pt-20 pb-28 lg:pt-28 lg:pb-40">
          <svg
            className="pointer-events-none absolute inset-x-0 bottom-0 h-40 w-full"
            viewBox="0 0 1440 160"
            fill="none"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path d="M -20 160 L -20 110 Q -20 60 40 60 L 220 60" stroke="rgba(255,255,255,0.14)" strokeWidth="1" />
            <path d="M 1460 160 L 1460 110 Q 1460 60 1400 60 L 1220 60" stroke="rgba(255,255,255,0.14)" strokeWidth="1" />
          </svg>
          <Reveal className="relative z-10 mx-auto max-w-7xl px-6 text-center lg:px-8">

            <h1 className="display-h mx-auto max-w-7xl text-balance text-[42px] font-normal leading-[1.16] text-white sm:text-[66px] sm:leading-[1.14] lg:text-[80px]" style={{ letterSpacing: "0em" }} aria-label="Harness automated deal intelligence to turn contracts into a strategic advantage.">
              <span className="hero-mask lg:whitespace-nowrap"><span className="hero-line" style={{ animationDelay: "0.05s" }}>Harness automated deal</span></span>
              <span className="hero-mask lg:whitespace-nowrap"><span className="hero-line" style={{ animationDelay: "0.16s" }}>intelligence to turn contracts</span></span>
              <span className="hero-mask lg:whitespace-nowrap"><span className="hero-line" style={{ animationDelay: "0.27s" }}>into a strategic advantage.</span></span>
            </h1>

            <p className="hero-fade mx-auto mt-6 max-w-2xl text-[15px] leading-relaxed text-white/75 sm:text-[17px]" style={{ animationDelay: "0.45s" }}>
              The enterprise deal platform that extracts risk, enforces deterministic playbooks, automates counter-drafts, and guards contractual obligations across your agreement lifecycle.
            </p>

            <div className="hero-fade mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row" style={{ animationDelay: "0.58s" }}>
              <Link href="/register" className="btn-paper group">
                <span>Get Started Free</span>
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </Link>
              <Link href="#platform" className="btn-ghost-dark">
                <span>Explore Platform</span>
              </Link>
            </div>

            <div id="platform" className="hero-fade mt-8" style={{ animationDelay: "0.72s" }}>
              <HeroMockup />
              <p className="mx-auto mt-3 max-w-4xl text-center text-[11px] text-white/40">
                Illustrated example. A freelance analysis can produce this exact report, with every finding traced to its source clause.
              </p>
            </div>

          </Reveal>
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
