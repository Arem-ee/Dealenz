import { SectionWrapper, BodyText } from "@/components/landing/primitives"

export function PricingSection() {
  return (
    <SectionWrapper width="narrow" className="py-12 sm:py-16">
      <p className="text-xl font-semibold text-center">One plan.</p>
      <BodyText muted className="text-center mt-2">
        Your first 5 analyses are free. Paid plans start when you need more. Every plan includes all document types and client sharing.
      </BodyText>
    </SectionWrapper>
  )
}
