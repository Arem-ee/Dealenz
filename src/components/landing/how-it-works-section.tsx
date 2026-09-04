import { SectionWrapper, Heading, BodyText } from "@/components/landing/primitives"

const steps = [
  {
    title: "Share the deal",
    description:
      "You start by giving Dealenz whatever you've got. That could be a messy email thread, a PDF someone sent over, a contract you're about to send out yourself, or you can just describe the deal in your own words if that's easier.",
  },
  {
    title: "Understand the agreement",
    description:
      "From there, Dealenz goes through it and works out what's actually being agreed to. Who's involved, what money's changing hands, what everyone's expected to do, that kind of thing.",
  },
  {
    title: "Get the risk report",
    description:
      "Then you get a risk report, and it's specific. It tells you exactly where the trouble spots are instead of handing you a vague score and leaving you to guess why it landed there.",
  },
  {
    title: "Decide what to do next",
    description:
      "If you're the one sending something out, like a proposal or a contract, Dealenz can put one together for you that actually accounts for whatever risks it found. And if someone else sent the deal to you, it'll tell you what to push back on before you put your name on anything.",
  },
]

export function HowItWorksSection() {
  return (
    <SectionWrapper width="xwide" className="py-14 sm:py-20">
      <Heading>From brief to signed contract in one pass.</Heading>
      <div className="mt-8 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, i) => (
          <div key={step.title}>
            <span className="font-mono text-3xl sm:text-4xl font-bold text-primary/40">
              {String(i + 1).padStart(2, "0")}
            </span>
            <h3 className="mt-4 text-base font-semibold">{step.title}</h3>
            <BodyText muted className="mt-2">{step.description}</BodyText>
          </div>
        ))}
      </div>
      <div className="mt-8 rounded-xl border border-border/60 bg-card py-4 px-5 sm:py-5 sm:px-6">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-medium text-foreground">Client brief received</span>
          <span className="text-muted-foreground/40">&mdash;</span>
          <span className="italic text-muted-foreground/60">Pasted from email</span>
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground/40">
          <span className="font-mono">&darr;</span>
        </div>
        <div>
          <p className="text-xs font-medium text-foreground">Dealenz detected:</p>
          <ul className="mt-2 space-y-1">
            <li className="flex items-start gap-2 text-xs text-muted-foreground">
              <span className="mt-1 block h-1 w-1 shrink-0 rounded-full bg-risk-high" />
              Missing deposit language
            </li>
            <li className="flex items-start gap-2 text-xs text-muted-foreground">
              <span className="mt-1 block h-1 w-1 shrink-0 rounded-full bg-risk-high" />
              Unlimited revision risk
            </li>
            <li className="flex items-start gap-2 text-xs text-muted-foreground">
              <span className="mt-1 block h-1 w-1 shrink-0 rounded-full bg-risk-medium" />
              IP ownership transferred before payment
            </li>
          </ul>
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground/40">
          <span className="font-mono">&darr;</span>
        </div>
        <div>
          <p className="text-xs font-medium text-foreground">Generated:</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="rounded-md border border-border/60 bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground">Proposal</span>
            <span className="rounded-md border border-border/60 bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground">Scope of Work</span>
            <span className="rounded-md border border-border/60 bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground">Contract</span>
            <span className="rounded-md border border-border/60 bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground">Deliverables Checklist</span>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground/40">
          <span className="font-mono">&darr;</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Sent for signature</span>
          <span className="text-muted-foreground/30">&rarr;</span>
          <span className="text-emerald-600 font-medium">Signed and recorded</span>
        </div>
      </div>
      <div className="mt-8 flex flex-col sm:flex-row sm:items-start sm:gap-12">
        <div className="sm:w-1/2">
          <p className="text-sm sm:text-base leading-relaxed text-muted-foreground">
            Clients receive a secure link. They read, review, and accept in their browser. Every signature is timestamped and recorded in the deal timeline.
          </p>
        </div>
        <div className="sm:w-1/2 mt-4 sm:mt-0">
          <div className="overflow-hidden rounded-lg border border-border/40 shadow-sm">
            <img
              src="/client-signing.png"
              alt="Client signing portal"
              className="block h-auto w-full object-contain"
            />
          </div>
        </div>
      </div>
    </SectionWrapper>
  )
}
