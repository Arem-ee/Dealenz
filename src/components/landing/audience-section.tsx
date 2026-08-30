import { SectionWrapper, BodyText } from "@/components/landing/primitives"

export function AudienceSection() {
  return (
    <SectionWrapper width="narrow" className="py-14">
      <BodyText muted={false}>
        This is for solo freelancers and small teams who write their own contracts. You do the work and you handle the paperwork. If you have a legal department, you do not need Dealenz.
      </BodyText>
    </SectionWrapper>
  )
}
