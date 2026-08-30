import { SectionWrapper, BodyText, CTAButton } from "@/components/landing/primitives"

export function FinalCTASection() {
  return (
    <SectionWrapper dark noBorder className="py-20 sm:py-28">
      <div className="flex flex-col items-center text-center">
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight max-w-2xl">
          Your next client brief is already in your inbox.
        </h2>
        <BodyText variant="large" muted className="mt-4 text-[#a0a0a0]">
          Analyze it before you reply.
        </BodyText>
        <CTAButton variant="primary" href="/register" className="mt-8 px-8 py-3">
          Get started free
        </CTAButton>
      </div>
    </SectionWrapper>
  )
}
