const steps = [
  {
    num: "01",
    title: "Share the deal",
    desc: "You start by giving Dealenz whatever you've got. That could be a messy email thread, a PDF someone sent over, a contract you're about to send out yourself, or you can just describe the deal in your own words if that's easier.",
  },
  {
    num: "02",
    title: "Understand the agreement",
    desc: "From there, Dealenz goes through it and works out what's actually being agreed to. Who's involved, what money's changing hands, what everyone's expected to do, that kind of thing.",
  },
  {
    num: "03",
    title: "Get the risk report",
    desc: "Then you get a risk report, and it's specific. It tells you exactly where the trouble spots are instead of handing you a vague score and leaving you to guess why it landed there.",
  },
  {
    num: "04",
    title: "Decide what to do next",
    desc: "If you're the one sending something out, like a proposal or a contract, Dealenz can put one together for you that actually accounts for whatever risks it found. And if someone else sent the deal to you, it'll tell you what to push back on before you put your name on anything.",
  },
]

export function LandingHowItWorks() {
  return (
    <section id="how-it-works" className="bg-white px-6 py-24 sm:py-32">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-brand-red">The process</p>
        <p className="mt-3 text-3xl font-semibold tracking-tight text-[#1a0f0f] sm:text-4xl">
          From brief to signed contract
          <br />
          in four steps.
        </p>
        <div className="mt-16 grid grid-cols-1 gap-10 sm:grid-cols-4 sm:gap-6">
          {steps.map((s, i) => (
            <div key={s.num} className="relative rounded-xl border border-black/[0.04] bg-[#fdfaf7] p-5">
              <p className="text-6xl font-bold text-brand-red/20 leading-none">{s.num}</p>
              <p className="mt-3 text-base font-semibold text-[#1a0f0f]">{s.title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
              {i < steps.length - 1 && (
                <div className="mt-6 h-px w-full bg-brand-red/10 sm:absolute sm:right-[-12px] sm:top-8 sm:h-px sm:w-8" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
