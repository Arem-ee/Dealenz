import { LandingNav } from "@/components/landing/landing-nav"
import { LandingHero } from "@/components/landing/landing-hero"
import { LandingTrustedBy } from "@/components/landing/landing-trusted-by"
import { LandingMiniDashboard } from "@/components/landing/landing-mini-dashboard"
import { LandingProblem } from "@/components/landing/landing-problem"
import { LandingHowItWorks } from "@/components/landing/landing-how-it-works"
import { LandingRiskIntelligence } from "@/components/landing/landing-risk-intelligence"
import { LandingProtectionPackage } from "@/components/landing/landing-protection-package"
import { LandingPricing } from "@/components/landing/landing-pricing"
import { LandingFAQ } from "@/components/landing/landing-faq"
import { LandingFinalCTA } from "@/components/landing/landing-final-cta"
import { LandingFooter } from "@/components/landing/landing-footer"

export default function Home() {
  return (
    <div className="min-h-screen bg-[#F2F0ED]">
      <div className="max-w-[1400px] mx-auto px-4 pt-6 sm:pt-10">
        <div className="relative rounded-[32px] bg-[#FDFBF9] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] overflow-hidden">
          <LandingNav />
          <LandingHero />
          <LandingTrustedBy />
        </div>
      </div>
      <LandingMiniDashboard />
      <LandingProblem />
      <LandingHowItWorks />
      <LandingRiskIntelligence />
      <LandingProtectionPackage />
      <LandingPricing />
      <LandingFAQ />
      <LandingFinalCTA />
      <LandingFooter />
    </div>
  )
}