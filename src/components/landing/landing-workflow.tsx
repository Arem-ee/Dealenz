const steps = [
  {
    num: "01",
    title: "Paste the brief",
    desc: "Drop in the email, the Notion doc, the Slack thread, or the client message. Messy is fine.",
  },
  {
    num: "02",
    title: "Get the risk report",
    desc: "Eight categories are analyzed including payment, scope, IP, legal, communication, timeline, contract gaps, and client signals.",
  },
  {
    num: "03",
    title: "Generate your documents",
    desc: "Proposal, scope of work, contract, and deliverables checklist generated from the analysis.",
  },
  {
    num: "04",
    title: "Send for signing",
    desc: "Clients receive a secure link and signing activity is recorded in your workspace.",
  },
]

const documents = [
  { name: "Proposal", desc: "Sets expectations before the engagement starts." },
  { name: "Scope of Work", desc: "Defines what is included and what is not. The document you reference when a client says \"just one more thing.\"" },
  { name: "Contract", desc: "Covers payment, IP, revision limits, and termination language calibrated to what the risk report found." },
  { name: "Deliverables Checklist", desc: "A live scope tracker for active work. Mark items as in-scope, out-of-scope, or change request." },
]

export function LandingWorkflow() {
  return (
    <section className="bg-background pt-24 sm:pt-32 pb-16 sm:pb-24">
      <div className="mx-auto max-w-[720px] px-6 text-center mb-16 sm:mb-20">
        <p className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground mb-4">
          From brief to signed contract in four steps.
        </p>
        <p className="text-base leading-relaxed text-text-secondary max-w-[600px] mx-auto">
          Dealenz reads the messy inputs you already have and turns them into something you can actually work with.
        </p>
      </div>
      <div className="mx-auto max-w-[960px] px-6 mb-20 sm:mb-24">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-8 sm:gap-6">
          {steps.map((s) => (
            <div key={s.num} className="text-center sm:text-left">
              <p className="text-4xl sm:text-5xl font-bold text-border/50 leading-none mb-3">{s.num}</p>
              <p className="text-base font-semibold text-foreground mb-1.5">{s.title}</p>
              <p className="text-sm leading-relaxed text-text-secondary">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="mx-auto max-w-[800px] px-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {documents.map((d) => (
            <div key={d.name} className="bg-surface border border-border rounded-xl p-6">
              <p className="text-base font-semibold text-foreground mb-1.5">{d.name}</p>
              <p className="text-sm leading-relaxed text-text-secondary">{d.desc}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="mx-auto max-w-[560px] px-6 text-center mt-10 sm:mt-12">
        <p className="text-xs leading-relaxed text-text-muted">
          Documents are AI-generated and should be reviewed before use. Dealenz is not a law firm and does not provide legal advice.
        </p>
      </div>
    </section>
  )
}
