const risks = [
  { name: "Payment", desc: "\"Payment upon completion\" with no milestone structure or deposit mentioned." },
  { name: "Scope", desc: "\"And anything else we need\" added after the deliverables list." },
  { name: "IP", desc: "\"Full ownership of all assets including source files\" before final payment is received." },
  { name: "Legal", desc: "No termination clause. No dispute resolution mechanism." },
  { name: "Timeline", desc: "Hard deadline with no flexibility and no client dependency acknowledgment." },
  { name: "Communication", desc: "\"The team will review\" -- no named decision maker." },
  { name: "Client Signals", desc: "\"This should be straightforward\" for a six-figure project." },
  { name: "Contract", desc: "Verbal agreement assumed. No mention of a written contract." },
]

export function LandingRiskIntelligence() {
  return (
    <section className="bg-[#0f0f0f] px-6 py-24 sm:py-32">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-brand-red">Risk intelligence</p>
        <p className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          The risks that cost freelancers
          <br />
          the most -- and how they appear
          <br />
          in a real brief.
        </p>
        <div className="mt-16 grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="space-y-0">
            {risks.map((r) => (
              <div key={r.name} className="border-l-2 border-brand-red py-3 pl-4">
                <p className="text-sm font-semibold text-white">{r.name}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-[#a0a0a0]">{r.desc}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-6 shadow-lg">
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-brand-red">Scope</p>
            <span className="inline-block rounded-full bg-red-900/30 px-2 py-0.5 text-[11px] font-medium text-red-400">
              CRITICAL
            </span>
            <p className="mt-4 text-lg font-semibold text-white">Unlimited revision language detected</p>
            <div className="mt-4 border-l-2 border-brand-red bg-[#141414] py-3 pl-4 text-sm italic text-[#a0a0a0]">
              &ldquo;We may require additional iterations based on stakeholder feedback throughout the process.&rdquo;
            </div>
            <p className="mt-4 text-sm leading-relaxed text-[#a0a0a0]">
              <span className="font-medium text-white">What this means:</span> No revision limit, no change order process, no
              acceptance criteria. Every stakeholder can request changes indefinitely.
            </p>
            <div className="mt-4 rounded-lg border border-[#2a2a2a] bg-[#141414] p-4">
              <p className="text-[10px] font-medium uppercase tracking-wider text-[#606060]">Suggested clause</p>
              <p className="mt-1 text-sm leading-relaxed text-[#a0a0a0]">
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
