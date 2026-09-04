import { SectionWrapper, Heading, BodyText } from "@/components/landing/primitives"

const patterns = [
  "Net-90 payment terms buried in casual phrasing.",
  '"And anything else we need" appended to a scope.',
  "Work-for-hire clauses that hand over source files before payment.",
  "No deposit mentioned on a five-figure project.",
  "Revision language that implies unlimited rounds.",
  "A single stakeholder who needs to check with the team on every decision.",
  "Timeline that depends entirely on the client delivering assets on time.",
  "No termination clause. You are committed even if they stop responding.",
]

export function RiskSection() {
  return (
    <SectionWrapper width="xwide" className="py-16 sm:py-24">
      <div className="flex flex-col sm:flex-row sm:items-start sm:gap-12">
        <div className="sm:w-1/2">
          <Heading>The risks you would not see until it was too late.</Heading>
          <ul className="mt-10 space-y-4">
            {patterns.map((p) => (
              <li key={p} className="flex items-start gap-3">
                <span className="mt-1.5 block h-2 w-2 shrink-0 rounded-full bg-primary" />
                <span className="text-sm sm:text-base leading-relaxed text-muted-foreground">{p}</span>
              </li>
            ))}
          </ul>
          <BodyText muted className="mt-8 max-w-2xl">
            Most of these show up right at the start, before you have had a chance to really look at what you are agreeing to. Dealenz reads for them before you sign anything.
          </BodyText>
        </div>
        <div className="sm:w-1/2 mt-8 sm:mt-0">
          <div className="relative overflow-hidden rounded-t-xl border border-[#222] shadow-2xl">
            <div className="absolute top-3 left-3 flex items-center gap-1.5 z-10">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f]" />
            </div>
            <img
              src="/risk-report.png"
              alt="Risk analysis interface"
              className="block h-auto w-full object-contain"
            />
          </div>
        </div>
      </div>
    </SectionWrapper>
  )
}
