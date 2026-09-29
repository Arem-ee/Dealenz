import Link from "next/link"
import { ArrowRight, ShieldCheck, Cpu, BellRing, Sparkles } from "lucide-react"
import { LandingHeader } from "@/components/landing/landing-header"
import { CircuitBackdrop } from "@/components/landing/circuit-backdrop"
import { HeroContractCard } from "@/components/landing/hero-contract-card"
import { SocialProofStrip } from "@/components/landing/social-proof-strip"
import { CompetitiveAdvantageSection } from "@/components/landing/competitive-advantage"
import { BusinessImpactSection } from "@/components/landing/business-impact-section"
import { RatingBanner } from "@/components/landing/rating-banner"
import { CustomerLoveSection } from "@/components/landing/customer-love-section"
import { ConnectIntegrationsSection } from "@/components/landing/connect-integrations-section"
import { ConnectedWorkflowsSection } from "@/components/landing/connected-workflows-section"
import { IndustryCarousel } from "@/components/landing/industry-carousel"
import { InsightsSection } from "@/components/landing/insights-section"
import { PricingAndFaq } from "@/components/landing/pricing-and-faq"
import { PreFooterCta } from "@/components/landing/pre-footer-cta"
import { LandingFooter } from "@/components/landing/landing-footer"

export const metadata = {
  title: "Dealenz — Enterprise Contract & Deal Intelligence Platform",
  description:
    "Turn contracts into strategic intelligence. Dealenz reviews agreements against deterministic rulepacks, drafts counter-language, and guards renewal and obligation deadlines.",
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
    "Enterprise AI deal intelligence and contract management platform with deterministic rule verification and obligation monitoring.",
}

export default function Home() {
  return (
    <div className="landing-anchor-scroll min-h-screen bg-[#090A0F] text-white selection:bg-amber-500 selection:text-neutral-950">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
      />

      {/* 0. Top Navigation Bar */}
      <LandingHeader />

      <main>
        {/* 1. Hero Section (Dark Obsidian + Amber Constellation Circuit) */}
        <section className="relative overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-28">
          <CircuitBackdrop variant="hero" />

          <div className="relative z-10 mx-auto max-w-6xl px-6 text-center lg:px-8">
            
            {/* Enterprise Tag / Eyebrow */}
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 text-[11px] font-bold tracking-wider text-amber-300 backdrop-blur-sm">
              <Sparkles className="h-3 w-3 text-amber-400" />
              <span>ENTERPRISE CONTRACT & DEAL INTELLIGENCE</span>
            </div>

            {/* Main Headline matching Agiloft commanding visual stature */}
            <h1 className="mx-auto mt-6 max-w-3xl text-balance text-[36px] font-bold leading-[1.08] tracking-tight text-white sm:text-[54px] lg:text-[64px]">
              Turn Contracts into Business Intelligence With AI Deal Management.
            </h1>

            {/* Subtitle */}
            <p className="mx-auto mt-6 max-w-2xl text-[15px] leading-relaxed text-white/75 sm:text-[17px]">
              The contract platform that reviews every deal against deterministic rulepacks,
              drafts counter-language you can send, and watches renewal and obligation deadlines after signing.
            </p>

            {/* Dual CTAs */}
            <div className="mt-8 flex flex-col items-center justify-center gap-3.5 sm:flex-row">
              <Link
                href="/register"
                className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-8 text-[14px] font-bold text-neutral-950 shadow-2xl transition-all duration-150 hover:bg-neutral-100 hover:scale-105 active:scale-95"
              >
                <span>Get Started Free</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="#platform"
                className="inline-flex h-12 items-center gap-2 rounded-full border border-white/20 bg-white/[0.04] px-7 text-[14px] font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/10"
              >
                <span>Explore Platform</span>
              </Link>
            </div>

            {/* Quick Feature Badges Bar */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[12px] font-semibold text-white/60">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-amber-400" />
                Deterministic Rule Engine
              </span>
              <span className="flex items-center gap-1.5">
                <Cpu className="h-4 w-4 text-amber-400" />
                Deterministic Risk Scoring
              </span>
              <span className="flex items-center gap-1.5">
                <BellRing className="h-4 w-4 text-amber-400" />
                Renewal & Obligation Monitoring
              </span>
            </div>

            {/* Hero Asset: Floating Warm Canvas Contract Review Console */}
            <div id="platform" className="mt-8">
              <HeroContractCard />
              <p className="mx-auto mt-3 max-w-4xl text-center text-[11px] text-white/40">
                Illustrated example. A freelance analysis can produce this exact report, with every finding traced to its source clause.
              </p>
            </div>

          </div>
        </section>

        {/* 2. Social Proof Enterprise Bar */}
        <SocialProofStrip />

        {/* 3. Section 1: "Turn contracts into competitive advantage" (Light Section) */}
        <div id="solutions">
          <CompetitiveAdvantageSection />
        </div>

        {/* 4. Section 2: "See the business impact of every contract" (Dark Navy Section) */}
        <BusinessImpactSection />

        {/* 5. Section 3: Industry Rating & 3D Isometric Wireframe Graphic (Light Section) */}
        <RatingBanner />

        {/* 6. Section 4: Customer Spotlight & Executive Stats (Light Section) */}
        <CustomerLoveSection />

        {/* 7. Section 5: "Point, Click, & Connect" (Deep Obsidian Section) */}
        <div id="integrations">
          <ConnectIntegrationsSection />
        </div>

        {/* 8. Section 6: "A full suite of connected workflows, built on AI" (Light Section) */}
        <div id="workflows">
          <ConnectedWorkflowsSection />
        </div>

        {/* 9. Section 7: "Explore by industry" (Light Section with Photography Cards) */}
        <IndustryCarousel />

        {/* 10. Section 8: "Learn more about Dealenz and the deal revolution" (Light Section) */}
        <InsightsSection />

        {/* 11. Pricing and FAQ */}
        <PricingAndFaq />

        {/* 12. Pre-Footer High-Impact CTA (Dark Obsidian Section) */}
        <PreFooterCta />
      </main>

      {/* 13. Global Enterprise Footer with Massive Watermark Wordmark */}
      <LandingFooter />
    </div>
  )
}
