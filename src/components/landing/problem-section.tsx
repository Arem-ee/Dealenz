import { SectionWrapper } from "@/components/landing/primitives"

const scenarios = [
  "The brief said 'simple website.' The kickoff call had 47 pages of requirements.",
  "There was no deposit clause. They went quiet after the first draft.",
  "The contract transferred all IP before final payment. You did not notice.",
  "'Just a few tweaks' turned into three weeks of unpaid revisions.",
]

export function ProblemSection() {
  return (
    <SectionWrapper width="wide" className="py-16 sm:py-24">
      <p className="text-2xl sm:text-3xl lg:text-4xl font-semibold leading-tight tracking-tight max-w-3xl">
        The moment you agree to a bad deal, you have already lost.
      </p>
      <div className="mt-10 space-y-5">
        {scenarios.map((s) => (
          <p key={s} className="font-mono text-sm sm:text-base leading-relaxed text-muted-foreground">
            {s}
          </p>
        ))}
      </div>
      <p className="mt-8 text-base sm:text-lg text-foreground/70 border-l-2 border-primary pl-4">
        By the time you see it in the contract, you have already said yes.
      </p>
      <div className="mt-10 flex flex-col sm:flex-row sm:items-start sm:gap-12">
        <div className="sm:w-1/2">
          <div className="overflow-hidden rounded-lg border border-border/40 shadow-sm">
            <img
              src="/activity-timeline.png"
              alt="Deal activity timeline"
              className="block h-auto w-full object-contain"
            />
          </div>
        </div>
        <div className="sm:w-1/2 mt-4 sm:mt-0">
          <p className="text-sm sm:text-base leading-relaxed text-muted-foreground">
            Every action across every deal is logged automatically. If a client later disputes what was agreed, the timeline shows exactly when and how terms changed.
          </p>
        </div>
      </div>
    </SectionWrapper>
  )
}
