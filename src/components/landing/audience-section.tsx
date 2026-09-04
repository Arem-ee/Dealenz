import { SectionWrapper, BodyText } from "@/components/landing/primitives"

export function AudienceSection() {
  return (
    <SectionWrapper width="narrow" className="py-14">
      <BodyText muted={false}>
        Dealenz was built with freelancers in mind first, people taking on a new client without really knowing much about them yet, and that is still the part of the product that is furthest along. But it is not just for freelancers. If you are a small business owner about to sign a lease or a vendor agreement, a contractor looking over a contract somebody else wrote, or honestly just someone about to sign something you did not write and never had a lawyer look at, this is for you too.
      </BodyText>
    </SectionWrapper>
  )
}
