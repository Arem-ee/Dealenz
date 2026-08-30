const steps = [
  {
    num: "01",
    title: "Paste the brief",
    desc: "Drop in the email, the Notion doc, the Slack thread. It does not need to be formatted. Messy works fine.",
  },
  {
    num: "02",
    title: "Get the risk report",
    desc: "Eight categories: payment, scope, IP, legal, timeline, communication, client signals, contract gaps. Every finding has a plain reason behind it.",
  },
  {
    num: "03",
    title: "Generate your documents",
    desc: "Proposal, scope of work, contract, and deliverables checklist. Sequential. Each document builds context for the next.",
  },
  {
    num: "04",
    title: "Send for signing",
    desc: "Your client gets a secure link. They read and accept in their browser. The timestamp is recorded on both sides.",
  },
]

export function LandingHowItWorks() {
  return (
    <section id="how-it-works" className="bg-[#141414] px-6 py-24 sm:py-32">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-brand-red">The process</p>
        <p className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          From brief to signed contract
          <br />
          in four steps.
        </p>
        <div className="mt-16 grid grid-cols-1 gap-10 sm:grid-cols-4 sm:gap-6">
          {steps.map((s, i) => (
            <div key={s.num} className="relative">
              <p className="text-6xl font-bold text-brand-red/30 leading-none">{s.num}</p>
              <p className="mt-3 text-base font-semibold text-white">{s.title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-[#a0a0a0]">{s.desc}</p>
              {i < steps.length - 1 && (
                <div className="mt-6 h-px w-full bg-[#2a2a2a] sm:absolute sm:right-[-12px] sm:top-8 sm:h-px sm:w-8" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
