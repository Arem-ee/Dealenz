import { LandingNav } from "@/components/landing/landing-nav"
import { LandingHero } from "@/components/landing/landing-hero"
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
    <div className="landing-theme">
      <LandingNav />
      <LandingHero />
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
