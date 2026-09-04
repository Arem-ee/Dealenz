const risks = [
  { name: "Payment", desc: "\"Payment upon completion\" with no milestone structure or deposit mentioned." },
  { name: "Scope", desc: "\"And anything else we need\" added after the deliverables list." },
  { name: "IP", desc: "\"Full ownership of all assets including source files\" before final payment is received." },
  { name: "Legal", desc: "No termination clause. No dispute resolution mechanism." },
  { name: "Timeline", desc: "Hard deadline with no flexibility and no client dependency acknowledgment." },
  { name: "Communication", desc: "\"The team will review\" -- no named decision maker." },
  { name: "Counterparty Signals", desc: "\"This should be straightforward\" for a complicated deal that clearly is not." },
  { name: "Contract", desc: "Verbal agreement assumed. No mention of a written contract." },
]

export function LandingRiskIntelligence() {
  return (
    <section className="bg-[#fdfaf7] px-6 py-24 sm:py-32">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-brand-red">Risk intelligence</p>
        <p className="mt-3 text-3xl font-semibold tracking-tight text-[#1a0f0f] sm:text-4xl">
          The risks that tend to cost people
          <br />
          the most, and how they usually
          <br />
          show up in a real deal.
        </p>
        <div className="mt-16 grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="space-y-0">
            {risks.map((r) => (
              <div key={r.name} className="border-l-2 border-brand-red/20 py-3 pl-4">
                <p className="text-sm font-semibold text-[#1a0f0f]">{r.name}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{r.desc}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-black/[0.06] bg-white p-6 shadow-[0_8px_32px_rgba(0,0,0,0.06)]">
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-brand-red">Scope</p>
            <span className="inline-block rounded-full bg-brand-red/10 px-2 py-0.5 text-[11px] font-medium text-brand-red">
              CRITICAL
            </span>
            <p className="mt-4 text-lg font-semibold text-[#1a0f0f]">Unlimited revision language detected</p>
            <div className="mt-4 border-l-2 border-brand-red/30 bg-[#fdfaf7] py-3 pl-4 text-sm italic text-muted-foreground">
              &ldquo;We may require additional iterations based on stakeholder feedback throughout the process.&rdquo;
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              <span className="font-medium text-[#1a0f0f]">What this means:</span> No revision limit, no change order process, no
              acceptance criteria. Every stakeholder can request changes indefinitely.
            </p>
            <div className="mt-4 rounded-lg border border-black/[0.06] bg-[#fdfaf7] p-4">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Suggested clause</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                &ldquo;This engagement includes two rounds of consolidated revisions per deliverable. Additional revisions are
                available as change orders.&rdquo;
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
