import Link from "next/link"

export const metadata = {
  title: "Dealenz — You don't need to know what to ask.",
  description:
    "Tell Dealenz what you're dealing with. It asks what matters, understands the context, and helps you decide what to do next — from first question to signed agreement.",
}

function LogoMark() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-7 w-7 rounded-[7px] bg-[var(--burgundy)] flex items-center justify-center">
        <span className="text-[11px] font-bold tracking-[0.08em] text-white">D</span>
      </div>
      <span className="text-[15px] font-semibold tracking-[-0.02em] text-[#1C1917]">dealenz</span>
    </div>
  )
}

function Nav() {
  return (
    <nav aria-label="Primary" className="sticky top-0 z-40 border-b border-black/[0.06] bg-[#FAFAF8]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-[64px] max-w-[1280px] items-center justify-between px-6 lg:px-8">
        <Link href="/" aria-label="Dealenz home" className="focus-visible:outline-none">
          <LogoMark />
        </Link>
        <div className="hidden items-center gap-8 md:flex">
          <a href="#how-it-works" className="text-[13px] font-medium text-[#1C1917]/70 hover:text-[#1C1917] transition-colors">
            How it works
          </a>
          <a href="#why-dealenz" className="text-[13px] font-medium text-[#1C1917]/70 hover:text-[#1C1917] transition-colors">
            Why Dealenz
          </a>
          <a href="#principles" className="text-[13px] font-medium text-[#1C1917]/70 hover:text-[#1C1917] transition-colors">
            About
          </a>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="hidden sm:inline-flex h-9 items-center rounded-full px-5 text-[13px] font-medium text-[#1C1917] hover:bg-black/[0.04] transition-colors"
          >
            Log in
          </Link>
          <Link
            href="/register"
            className="inline-flex h-9 items-center rounded-full bg-[var(--burgundy)] px-5 text-[13px] font-semibold text-white hover:bg-[var(--brand-red-hover)] transition-colors"
          >
            Get started
          </Link>
        </div>
      </div>
    </nav>
  )
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[#1C1917]/40">{children}</p>
}

function SectionLabel({ k, label }: { k: string; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1C1917] text-[10px] font-bold tracking-widest text-white">{k}</span>
      <span className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[#1C1917]/40">{label}</span>
    </div>
  )
}

export default function Home() {
  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#1C1917] selection:bg-[#1C1917] selection:text-white">
      <Nav />

      <main>
        {/* HERO — Section 1 */}
        <section className="mx-auto max-w-[1280px] px-6 lg:px-8 pt-10 lg:pt-16 pb-10">
          <div className="grid gap-10 lg:grid-cols-[1.05fr_1.15fr] lg:items-center">
            <div>
              <h1 className="text-[40px] sm:text-[52px] lg:text-[64px] font-semibold leading-[0.92] tracking-[-0.04em]">
                You don&apos;t need
                <br />
                to know what
                <br />
                <span className="font-light italic tracking-[-0.03em] text-[#1C1917]/80">to ask.</span>
              </h1>
              <p className="mt-6 max-w-[42ch] text-[17px] leading-relaxed text-[#1C1917]/65">
                Tell Dealenz what you&apos;re dealing with. It will ask what matters, understand the context, and help you
                figure out what to do next.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/register"
                  className="inline-flex h-11 items-center rounded-full bg-[var(--burgundy)] px-7 text-[14px] font-semibold text-white hover:bg-[var(--brand-red-hover)] transition-colors"
                >
                  Get started
                </Link>
                <a
                  href="#how-it-works"
                  className="inline-flex h-11 items-center rounded-full border border-black/10 bg-white px-7 text-[14px] font-medium hover:bg-black/[0.03] transition-colors"
                >
                  See how it works
                </a>
              </div>
              <p className="mt-4 text-[12px] leading-relaxed text-[#1C1917]/45">
                No questionnaire. No legal form. Just explain what&apos;s happening.
              </p>
            </div>

            {/* Hero product composition */}
            <div className="relative">
              <div className="rounded-[24px] border border-black/[0.07] bg-white p-3 sm:p-4 shadow-[0_24px_64px_-24px_rgba(0,0,0,0.22),0_1px_2px_rgba(0,0,0,0.06)]">
                <div className="rounded-[16px] border border-black/[0.06] bg-[#FAFAF8] overflow-hidden">
                  <div className="flex items-center justify-between border-b border-black/[0.06] bg-white px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
                      <span className="text-[12px] font-medium">Consultant</span>
                      <span className="hidden sm:inline text-[11px] text-black/40">· understands what context it needs</span>
                    </div>
                    <span className="text-[11px] font-medium text-black/40">Dealenz</span>
                  </div>

                  <div className="space-y-4 p-4 sm:p-5">
                    <div className="ml-auto max-w-[86%] rounded-2xl rounded-br-[6px] bg-[#1C1917] px-4 py-3 text-[13px] leading-relaxed text-white">
                      I&apos;m selling my business and the buyer sent me this.
                    </div>

                    <div className="max-w-[92%] rounded-2xl rounded-bl-[6px] border border-black/[0.07] bg-white px-4 py-3">
                      <p className="text-[13px] leading-relaxed">
                        I can help. Before I review it, I need a little context about the transaction.
                      </p>
                      <p className="mt-2 text-[11px] font-medium tracking-wide uppercase text-black/40">
                        One question at a time — only what matters
                      </p>
                      <div className="mt-3 grid gap-2">
                        <button
                          type="button"
                          className="rounded-full border border-black/10 bg-[#FAFAF8] px-3.5 py-2 text-left text-[13px] font-medium hover:bg-black/[0.03] transition-colors"
                        >
                          <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#1C1917] text-[10px] text-white">A</span>
                          Asset sale
                        </button>
                        <button
                          type="button"
                          className="rounded-full border border-black/10 bg-[#FAFAF8] px-3.5 py-2 text-left text-[13px] font-medium hover:bg-black/[0.03] transition-colors"
                        >
                          <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#1C1917] text-[10px] text-white">B</span>
                          Share sale
                        </button>
                        <button
                          type="button"
                          className="rounded-full bg-[var(--burgundy)] px-3.5 py-2 text-left text-[13px] font-medium text-white"
                        >
                          <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-bold text-[var(--burgundy)]">C</span>
                          Not sure — explain the difference
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-black/40">
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--burgundy)] animate-pulse" />
                      Dealenz is not filling a form. It is figuring out what to ask next.
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between px-1">
                  <span className="text-[11px] font-medium tracking-wide uppercase text-black/30">Context → Questions → Confirmation</span>
                  <span className="text-[11px] text-black/30">No questionnaire</span>
                </div>
              </div>

              <div className="pointer-events-none absolute -right-2 -top-2 hidden lg:block rounded-full border border-black/10 bg-white px-3 py-1.5 text-[11px] font-medium shadow-sm">
                Asks only what matters
              </div>
            </div>
          </div>
        </section>

        {/* PROBLEM — Section 2 */}
        <section className="border-t border-black/[0.06] bg-white">
          <div className="mx-auto max-w-[1280px] px-6 lg:px-8 py-16 lg:py-24">
            <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
              <div>
                <Eyebrow>THE PROBLEM</Eyebrow>
                <h2 className="mt-4 text-[32px] sm:text-[40px] font-semibold leading-[0.95] tracking-[-0.03em]">
                  Most important
                  <br />
                  agreements begin
                  <br />
                  <span className="font-light italic">with incomplete</span> information.
                </h2>
              </div>
              <div className="lg:pt-8">
                <p className="text-[15px] leading-relaxed text-black/60">
                  The document is rarely the whole problem. Before anyone can tell you what matters, they need to
                  understand the situation around it.
                </p>
                <div className="mt-8 grid gap-4 border-t border-black/10 pt-8">
                  {[
                    ["What is actually being agreed", "Not just what the clause says, but what it means for you."],
                    ["What is missing", "Silence in a contract can be as important as what is written."],
                    ["What could leave you exposed", "Where the risk lands, and when."],
                    ["What should change", "And what happens next if you do nothing."],
                  ].map(([title, desc]) => (
                    <div key={title} className="flex gap-4">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--burgundy)]" aria-hidden />
                      <div>
                        <p className="text-[13px] font-semibold leading-none">{title}</p>
                        <p className="mt-1 text-[13px] leading-relaxed text-black/55">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CONSULTANT — Section 3 */}
        <section id="how-it-works" className="bg-[#FAFAF8] border-t border-black/[0.06]">
          <div className="mx-auto max-w-[1280px] px-6 lg:px-8 py-16 lg:py-20">
            <div className="max-w-2xl">
              <SectionLabel k="01" label="Consultant" />
              <h2 className="mt-4 text-[30px] sm:text-[38px] font-semibold leading-[0.95] tracking-[-0.03em]">Start with what you know.</h2>
              <p className="mt-4 text-[15px] leading-relaxed text-black/60">
                Explain the situation in your own words. Dealenz figures out what is missing and asks one focused
                question at a time. It does not run a fixed questionnaire.
              </p>
            </div>

            <div className="mt-10 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="rounded-[20px] border border-black/[0.07] bg-white p-5 sm:p-6 shadow-surface">
                <div className="space-y-4">
                  <div className="rounded-2xl bg-[#FAFAF8] border border-black/[0.06] px-4 py-3">
                    <p className="text-[11px] font-semibold tracking-wide uppercase text-black/40">You</p>
                    <p className="mt-1 text-[14px] leading-relaxed">Our landlord wants to raise the rent and sent an addendum.</p>
                  </div>

                  <div className="rounded-2xl border border-black/[0.07] bg-white px-4 py-3">
                    <p className="text-[11px] font-semibold tracking-wide uppercase text-[var(--burgundy)]">Dealenz</p>
                    <p className="mt-1 text-[14px] leading-relaxed">Got it. Are you the tenant or the landlord in this lease?</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-full bg-[#1C1917] px-3 py-1.5 text-xs font-medium text-white">Tenant</span>
                      <span className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-medium">Landlord</span>
                    </div>
                    <p className="mt-2 text-[11px] text-black/40">Why this matters: who you are changes what the clause means.</p>
                  </div>

                  <div className="rounded-2xl bg-[#FAFAF8] border border-black/[0.06] px-4 py-3">
                    <p className="text-[11px] font-semibold tracking-wide uppercase text-black/40">You</p>
                    <p className="mt-1 text-[14px]">Tenant. The flat is in Berlin.</p>
                  </div>

                  <div className="rounded-2xl border border-black/[0.07] bg-white px-4 py-3">
                    <p className="text-[11px] font-semibold tracking-wide uppercase text-[var(--burgundy)]">Dealenz</p>
                    <p className="mt-1 text-[14px] leading-relaxed">
                      Thanks. I&apos;ll check this against the context for Berlin. What does the addendum change — just the rent,
                      or also term or notice?
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-[20px] border border-black/[0.07] bg-white p-6">
                  <p className="text-[12px] font-semibold tracking-wide uppercase text-black/40">How it feels</p>
                  <ul className="mt-4 space-y-3 text-[13px] leading-relaxed text-black/60">
                    <li className="flex gap-2">
                      <span className="text-[var(--burgundy)]">—</span> Questions are visibly small in number, not exhaustive.
                    </li>
                    <li className="flex gap-2">
                      <span className="text-[var(--burgundy)]">—</span> Options appear where they make answering easier.
                    </li>
                    <li className="flex gap-2">
                      <span className="text-[var(--burgundy)]">—</span> Free text when you need to explain naturally.
                    </li>
                    <li className="flex gap-2">
                      <span className="text-[var(--burgundy)]">—</span> Every question says why it matters, in one clause.
                    </li>
                  </ul>
                </div>
                <div className="rounded-[20px] bg-[#1C1917] p-6 text-white">
                  <p className="text-[13px] font-medium leading-relaxed">
                    It feels intelligent because the questions are relevant, not because there are many of them.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CONTEXT — Section 4 */}
        <section className="bg-white border-t border-black/[0.06]">
          <div className="mx-auto max-w-[1280px] px-6 lg:px-8 py-16 lg:py-20">
            <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
              <div>
                <SectionLabel k="02" label="Context" />
                <h2 className="mt-4 text-[30px] sm:text-[38px] font-semibold leading-[0.95] tracking-[-0.03em]">
                  The right answer
                  <br />
                  depends on the <span className="font-light italic">situation.</span>
                </h2>
                <p className="mt-4 max-w-[44ch] text-[15px] leading-relaxed text-black/60">
                  Dealenz structures the situation as you talk. You don&apos;t fill a legal form. The consultant does the
                  structuring for you.
                </p>
              </div>

              <div className="rounded-[20px] border border-black/[0.07] bg-[#FAFAF8] p-4 sm:p-6">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {[
                    ["Your role", "Seller"],
                    ["What you're selling", "Business"],
                    ["Stage", "Negotiating"],
                    ["Priority", "Payment protection"],
                    ["Document", "Purchase agreement"],
                    ["Jurisdiction", "United Kingdom"],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-2xl border border-black/[0.06] bg-white px-4 py-4">
                      <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-black/40">{label}</p>
                      <p className="mt-1 text-[13px] font-semibold">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center gap-2 rounded-full bg-white px-3 py-2 text-[12px] font-medium text-black/60 border border-black/[0.06]">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Context confirmed · used to select what to check next
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* UNDERSTAND — Section 5 */}
        <section className="bg-[#FAFAF8] border-t border-black/[0.06]">
          <div className="mx-auto max-w-[1280px] px-6 lg:px-8 py-16 lg:py-20">
            <SectionLabel k="03" label="Understand" />
            <h2 className="mt-4 text-[30px] sm:text-[38px] font-semibold leading-[0.95] tracking-[-0.03em]">Then it gets to what matters.</h2>
            <p className="mt-3 max-w-[60ch] text-[15px] leading-relaxed text-black/60">
              Not a summary. A reading of what the situation means for you, grounded where possible in evidence and
              applicable context.
            </p>

            <div className="mt-10 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-[20px] border border-black/[0.07] bg-white overflow-hidden shadow-surface">
                <div className="border-b border-black/[0.06] bg-[#FAFAF8] px-5 py-3 flex items-center justify-between">
                  <span className="text-[11px] font-semibold tracking-wide uppercase text-black/40">Finding · Payment terms</span>
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-900">Attention</span>
                </div>
                <div className="p-5 sm:p-6">
                  <h3 className="text-[15px] font-semibold leading-snug">Payment is due before you have leverage to enforce it.</h3>
                  <div className="mt-3 rounded-xl border border-black/[0.06] bg-[#FAFAF8] px-3.5 py-3">
                    <p className="text-[11px] font-semibold tracking-wide uppercase text-black/40">Evidence</p>
                    <p className="mt-1 text-[13px] leading-relaxed text-black/70">
                      Clause 4.2: &ldquo;Full payment on signing, delivery within 60 days.&rdquo;
                    </p>
                  </div>
                  <p className="mt-3 text-[13px] leading-relaxed text-black/60">
                    If delivery slips, you have already paid. That shifts risk to you. This matters most because payment
                    protection was your stated priority.
                  </p>
                  <div className="mt-4 flex gap-2">
                    <span className="rounded-full bg-[#1C1917] px-3 py-1.5 text-xs font-medium text-white">Suggested next step</span>
                    <span className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs">Ask for staged payments</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-[20px] border border-black/[0.07] bg-white p-6">
                  <p className="text-[12px] font-semibold tracking-wide uppercase text-black/40">What grounding looks like</p>
                  <div className="mt-4 space-y-3">
                    <div className="flex gap-3 text-[13px]">
                      <span className="text-black/30">01</span>
                      <span>
                        <span className="font-medium">Finding</span> <span className="text-black/50">— what was found</span>
                      </span>
                    </div>
                    <div className="flex gap-3 text-[13px]">
                      <span className="text-black/30">02</span>
                      <span>
                        <span className="font-medium">Evidence</span> <span className="text-black/50">— where it appears</span>
                      </span>
                    </div>
                    <div className="flex gap-3 text-[13px]">
                      <span className="text-black/30">03</span>
                      <span>
                        <span className="font-medium">Significance</span> <span className="text-black/50">— why it matters for you</span>
                      </span>
                    </div>
                    <div className="flex gap-3 text-[13px]">
                      <span className="text-black/30">04</span>
                      <span>
                        <span className="font-medium">Next step</span> <span className="text-black/50">— what could change</span>
                      </span>
                    </div>
                  </div>
                </div>
                <p className="px-2 text-[12px] leading-relaxed text-black/45">
                  Not every answer is legally authoritative. When it can be grounded, Dealenz shows the basis. When it
                  cannot, it says so.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* PROTECT — Section 6 */}
        <section className="bg-white border-t border-black/[0.06]">
          <div className="mx-auto max-w-[1280px] px-6 lg:px-8 py-16 lg:py-20">
            <SectionLabel k="04" label="Protect" />
            <h2 className="mt-4 text-[28px] sm:text-[36px] font-semibold leading-[0.95] tracking-[-0.03em]">
              Understanding is only useful
              <br />
              when you can <span className="font-light italic">act on it.</span>
            </h2>

            <div className="mt-10 grid gap-4 lg:grid-cols-4">
              {[
                { step: "Problem", title: "Full payment on signing", desc: "You pay before delivery. Risk sits with you.", tone: "bg-red-50 border-red-200 text-red-900" },
                { step: "What could change", title: "Staged or held payment", desc: "Pay on milestones, or hold in escrow.", tone: "bg-amber-50 border-amber-200 text-amber-900" },
                { step: "Protective action", title: "Ask for 30% on signing, 70% on delivery", desc: "Keeps leverage. Matches your priority.", tone: "bg-white border-black/10" },
                { step: "Updated terms", title: "Revised clause 4.2 → ready to send", desc: "Clear language. Ready for the other side.", tone: "bg-emerald-50 border-emerald-200 text-emerald-900" },
              ].map((card) => (
                <div key={card.step} className={`rounded-[16px] border px-4 py-4 ${card.tone}`}>
                  <p className="text-[10px] font-semibold tracking-[0.12em] uppercase opacity-60">{card.step}</p>
                  <p className="mt-2 text-[13px] font-semibold leading-snug">{card.title}</p>
                  <p className="mt-1 text-[12px] leading-relaxed opacity-70">{card.desc}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 flex items-center gap-3 text-[12px] text-black/40">
              <span className="h-px flex-1 bg-black/10" />
              The product helps you do something, not just notice a problem
              <span className="h-px flex-1 bg-black/10" />
            </div>
          </div>
        </section>

        {/* WORK CONTINUES — Section 7 */}
        <section className="bg-[#FAFAF8] border-t border-black/[0.06]">
          <div className="mx-auto max-w-[1280px] px-6 lg:px-8 py-16 lg:py-20">
            <SectionLabel k="05" label="Continuity" />
            <h2 className="mt-4 text-[30px] sm:text-[38px] font-semibold tracking-[-0.03em]">Keep the work together.</h2>
            <p className="mt-3 max-w-[62ch] text-[15px] leading-relaxed text-black/60">
              The work does not have to be scattered across different tools. One workspace carries the matter forward.
            </p>

            <div className="mt-10 overflow-x-auto">
              <div className="flex min-w-[720px] items-stretch gap-3">
                {[
                  ["Context", "Role, jurisdiction, stage, priority"],
                  ["Findings", "Evidence, significance, next step"],
                  ["Protection", "What could change"],
                  ["Documents", "Updated terms, ready to send"],
                  ["Lawyer", "Review in the same work"],
                  ["Signing", "Send, sign, track"],
                  ["Complete", "Done, with a record"],
                ].map(([title, desc], i) => (
                  <div key={title} className="flex flex-1 items-stretch gap-3">
                    <div className="flex-1 rounded-[16px] border border-black/[0.07] bg-white px-4 py-4">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1C1917] text-[10px] font-bold text-white">
                          {i + 1}
                        </span>
                        <span className="text-[12px] font-semibold">{title}</span>
                      </div>
                      <p className="mt-2 text-[12px] leading-relaxed text-black/55">{desc}</p>
                    </div>
                    {i < 6 ? <div className="hidden sm:flex w-6 items-center justify-center text-black/20">→</div> : null}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* LAWYER — Section 8 */}
        <section className="bg-white border-t border-black/[0.06]">
          <div className="mx-auto max-w-[1280px] px-6 lg:px-8 py-16 lg:py-20">
            <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-start">
              <div>
                <SectionLabel k="06" label="Human review" />
                <h2 className="mt-4 text-[30px] sm:text-[38px] font-semibold leading-[0.95] tracking-[-0.03em]">
                  Some situations
                  <br />
                  need another <span className="font-light italic">human.</span>
                </h2>
                <p className="mt-4 text-[15px] leading-relaxed text-black/60">
                  When appropriate, Dealenz can bring a lawyer into the same work. The lawyer sees your context,
                  findings, and documents — not a blank intake form. They propose changes. You review.
                </p>
                <p className="mt-3 text-[13px] leading-relaxed text-black/45">
                  Dealenz is not primarily a lawyer marketplace. Not every matter receives a lawyer. The option is there
                  when the stakes warrant it.
                </p>
              </div>

              <div className="rounded-[20px] border border-black/[0.07] bg-[#FAFAF8] p-4 sm:p-5">
                <div className="grid gap-3">
                  <div className="rounded-2xl border border-black/[0.06] bg-white px-4 py-3">
                    <p className="text-[11px] font-semibold tracking-wide uppercase text-black/40">Already in the workspace</p>
                    <p className="mt-1 text-[13px]">Context · Findings · Evidence · Draft terms</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-[#1C1917] px-4 py-4 text-white">
                      <p className="text-[11px] font-semibold tracking-wide uppercase text-white/60">Lawyer review</p>
                      <p className="mt-1 text-[13px] leading-relaxed">Proposed changes with reasons, in the document.</p>
                    </div>
                    <div className="rounded-2xl border border-black/[0.06] bg-white px-4 py-4">
                      <p className="text-[11px] font-semibold tracking-wide uppercase text-black/40">You</p>
                      <p className="mt-1 text-[13px] leading-relaxed">Review, accept, or ask for adjustment.</p>
                    </div>
                  </div>
                  <p className="px-1 text-[11px] text-black/40">No separate marketplace. No re-explaining. Same work.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SIGNING — Section 9 */}
        <section className="bg-[#FAFAF8] border-t border-black/[0.06]">
          <div className="mx-auto max-w-[1280px] px-6 lg:px-8 py-16 lg:py-20">
            <SectionLabel k="07" label="Completion" />
            <h2 className="mt-4 text-[30px] sm:text-[38px] font-semibold tracking-[-0.03em]">Get from uncertainty to done.</h2>

            <div className="mt-10 flex flex-wrap items-center gap-2 text-[13px]">
              {["Understand", "Protect", "Review", "Finalize", "Sign", "Complete"].map((label, i, arr) => (
                <span key={label} className="flex items-center gap-2">
                  <span className={`rounded-full px-3.5 py-2 font-medium ${i === 0 ? "bg-[#1C1917] text-white" : i === arr.length - 1 ? "bg-[var(--burgundy)] text-white" : "border border-black/10 bg-white"}`}>
                    {label}
                  </span>
                  {i < arr.length - 1 ? <span className="text-black/20">→</span> : null}
                </span>
              ))}
            </div>
            <p className="mt-4 text-[12px] text-black/40">Dealenz helps you progress toward signing. It does not guarantee outcomes.</p>
          </div>
        </section>

        {/* WHY WE BUILT IT — Section 10 */}
        <section id="why-dealenz" className="bg-[#1C1917] text-white">
          <div className="mx-auto max-w-[1280px] px-6 lg:px-8 py-16 lg:py-24">
            <Eyebrow>
              <span className="text-white/40">Why Dealenz exists</span>
            </Eyebrow>
            <h2 className="mt-4 max-w-[22ch] text-[30px] sm:text-[40px] font-semibold leading-[0.95] tracking-[-0.03em] text-white">
              We think important decisions deserve more context.
            </h2>
            <div className="mt-8 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-4 text-[14px] leading-relaxed text-white/70">
                <p>
                  Important agreements often begin with uncertainty. You receive a document you did not write, in language
                  you did not choose, and are expected to know what questions to ask before you know what the real
                  problem is.
                </p>
                <p>
                  The work gets split across disconnected tools: a review here, drafting somewhere else, lawyer search
                  somewhere else, signing somewhere else, storage somewhere else. Context is lost at every handoff.
                </p>
                <p>
                  Dealenz is built around a different idea: the work should stay connected. Start with what is
                  happening. Let the system ask what matters, establish context, understand what is at stake, and help
                  you act — involving a lawyer in the same workspace when the situation warrants it.
                </p>
              </div>
              <div className="rounded-[20px] border border-white/10 bg-white/[0.06] p-6 backdrop-blur">
                <p className="text-[13px] font-medium leading-relaxed text-white">
                  No fake milestones. No invented customers. No claims of universal coverage.
                </p>
                <p className="mt-3 text-[13px] leading-relaxed text-white/60">
                  Dealenz does not promise outcomes. It helps you move forward with more context than you started with.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* PRINCIPLES — Section 11 */}
        <section id="principles" className="bg-white border-t border-black/[0.06]">
          <div className="mx-auto max-w-[1280px] px-6 lg:px-8 py-16 lg:py-20">
            <SectionLabel k="08" label="Principles" />
            <h2 className="mt-4 text-[28px] font-semibold tracking-[-0.03em]">Our principles</h2>

            <div className="mt-10 grid gap-10 lg:grid-cols-2">
              <div className="space-y-10">
                <div>
                  <h3 className="text-[18px] font-semibold tracking-[-0.02em]">Context matters.</h3>
                  <p className="mt-2 max-w-[38ch] text-[14px] leading-relaxed text-black/60">
                    The situation around a document can matter as much as the document itself. Role, transaction, stage,
                    and jurisdiction change what you should do.
                  </p>
                </div>
                <div>
                  <h3 className="text-[18px] font-semibold tracking-[-0.02em]">Evidence matters.</h3>
                  <p className="mt-2 max-w-[38ch] text-[14px] leading-relaxed text-black/60">
                    Important conclusions should be grounded where possible. When Dealenz can point to evidence or
                    applicable context, it shows the basis.
                  </p>
                </div>
                <div>
                  <h3 className="text-[18px] font-semibold tracking-[-0.02em]">Human judgment still matters.</h3>
                  <p className="mt-2 max-w-[38ch] text-[14px] leading-relaxed text-black/60">
                    Some situations deserve a lawyer. Dealenz can bring the right person into the same work.
                  </p>
                </div>
              </div>
              <div className="space-y-10">
                <div>
                  <h3 className="text-[18px] font-semibold tracking-[-0.02em]">AI proposes. You decide.</h3>
                  <p className="mt-2 max-w-[38ch] text-[14px] leading-relaxed text-black/60">
                    Dealenz can analyze, explain, and suggest. It does not make decisions for you, and it does not
                    claim automated legal authority.
                  </p>
                </div>
                <div>
                  <h3 className="text-[18px] font-semibold tracking-[-0.02em]">Privacy is not a checkbox.</h3>
                  <p className="mt-2 max-w-[38ch] text-[14px] leading-relaxed text-black/60">
                    Your work stays yours. Private documents are not treated as public knowledge, and one client&apos;s
                    matter does not become another&apos;s insight.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* WHO IT IS FOR — Section 12 */}
        <section className="bg-[#FAFAF8] border-t border-black/[0.06]">
          <div className="mx-auto max-w-[1280px] px-6 lg:px-8 py-16 lg:py-20">
            <SectionLabel k="09" label="Who it is for" />
            <h2 className="mt-4 text-[28px] font-semibold tracking-[-0.03em]">If you&apos;re dealing with something important.</h2>
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ["Starting an agreement", "You have terms in mind and need to set them fairly."],
                ["Reviewing something you've been sent", "A contract, amendment, or clause landed in your inbox."],
                ["Negotiating terms", "You need to know what to push back on and what to accept."],
                ["Buying or selling", "A business, an asset, a property — structure matters."],
                ["Running a business", "Founder, partner, employer — decisions compound."],
                ["Trying to understand what happens next", "You don't know what you need yet. Start there."],
              ].map(([title, desc]) => (
                <div key={title} className="rounded-[16px] border border-black/[0.07] bg-white px-5 py-5">
                  <p className="text-[13px] font-semibold">{title}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-black/55">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* INTERNATIONAL — Section 13 */}
        <section className="bg-white border-t border-black/[0.06]">
          <div className="mx-auto max-w-[1280px] px-6 lg:px-8 py-16 lg:py-20">
            <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-center">
              <div>
                <SectionLabel k="10" label="International" />
                <h2 className="mt-4 text-[28px] font-semibold tracking-[-0.03em]">Where you are matters.</h2>
                <p className="mt-3 max-w-[46ch] text-[14px] leading-relaxed text-black/60">
                  Dealenz considers the jurisdiction and legal context relevant to the work. Coverage depends on the
                  matter and jurisdiction.
                </p>
                <p className="mt-3 text-[13px] leading-relaxed text-black/45">
                  Dealenz does not present itself as belonging to one jurisdiction, and it does not claim universal
                  coverage. When a matter falls outside covered context, it says so.
                </p>
              </div>
              <div className="rounded-[20px] border border-black/[0.07] bg-[#FAFAF8] p-6">
                <p className="text-[11px] font-semibold tracking-wide uppercase text-black/40">Jurisdiction shapes the checks</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {["United Kingdom", "United States", "Germany", "France", "Netherlands", "Nigeria"].map((j) => (
                    <span key={j} className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-medium">
                      {j}
                    </span>
                  ))}
                </div>
                <p className="mt-4 text-[12px] leading-relaxed text-black/45">
                  Your role, the transaction, and where it sits determine which considerations apply.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* TRUST — Section 14 */}
        <section className="bg-[#FAFAF8] border-t border-black/[0.06]">
          <div className="mx-auto max-w-[1280px] px-6 lg:px-8 py-16 lg:py-20">
            <SectionLabel k="11" label="Trust" />
            <h2 className="mt-4 text-[28px] font-semibold tracking-[-0.03em]">Your work is yours.</h2>
            <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-4 text-[14px] leading-relaxed text-black/60">
                <p>Customer content is private by default. Dealenz does not sell customer data.</p>
                <p>
                  Private customer documents are not quietly turned into public knowledge. A lawyer&apos;s work for one
                  client does not automatically become general knowledge for others.
                </p>
                <p>
                  If Dealenz uses aggregate intelligence in the future, it will be governed and privacy-preserving. We
                  will describe what that means plainly before it matters, not after.
                </p>
                <p className="text-[12px] text-black/40">
                  We do not claim your information is never processed by AI. We describe precisely what happens, where,
                  and why.
                </p>
              </div>
              <div className="rounded-[20px] border border-black/[0.07] bg-white p-6">
                <p className="text-[12px] font-semibold tracking-wide uppercase text-black/40">What this means in practice</p>
                <ul className="mt-4 space-y-2 text-[13px] leading-relaxed text-black/60">
                  <li>· Your documents stay in your workspace.</li>
                  <li>· Access is governed, not open.</li>
                  <li>· No sale of customer data. Ever.</li>
                  <li>· Clear data practices you can read before you commit.</li>
                </ul>
                <div className="mt-5 flex gap-2">
                  <Link href="/privacy" className="text-xs font-medium underline decoration-black/20 underline-offset-4 hover:decoration-black/40">
                    Privacy
                  </Link>
                  <span className="text-black/20">·</span>
                  <Link href="/terms" className="text-xs font-medium underline decoration-black/20 underline-offset-4 hover:decoration-black/40">
                    Terms
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FINAL CTA — Section 15 */}
        <section className="bg-white border-t border-black/[0.06]">
          <div className="mx-auto max-w-[1280px] px-6 lg:px-8 py-16 lg:py-24">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-[36px] sm:text-[44px] font-semibold leading-[0.9] tracking-[-0.04em]">Bring us what you&apos;re dealing with.</h2>
              <p className="mt-4 text-[15px] leading-relaxed text-black/60">You don&apos;t need to know where to start.</p>
              <div className="mt-8 flex justify-center">
                <Link
                  href="/register"
                  className="inline-flex h-12 items-center rounded-full bg-[var(--burgundy)] px-8 text-[15px] font-semibold text-white hover:bg-[var(--brand-red-hover)] transition-colors"
                >
                  Get started
                </Link>
              </div>
              <p className="mt-3 text-[12px] text-black/40">Free to start. No credit card required.</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-[#141110] text-white">
        <div className="mx-auto max-w-[1280px] px-6 lg:px-8 py-12">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-[7px] bg-white flex items-center justify-center">
                  <span className="text-[11px] font-bold tracking-[0.08em] text-[#141110]">D</span>
                </div>
                <span className="text-[15px] font-semibold tracking-[-0.02em]">dealenz</span>
              </div>
              <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-white/60">
                Know what you&apos;re dealing with — before you sign.
              </p>
              <p className="mt-4 text-[12px] leading-relaxed text-white/40">
                Dealenz is not a law firm and does not provide legal advice.
              </p>
            </div>

            <nav aria-label="Product">
              <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-white/40">Product</p>
              <ul className="mt-4 space-y-2.5 text-[13px]">
                <li>
                  <a href="#how-it-works" className="text-white/70 hover:text-white transition-colors">
                    How it works
                  </a>
                </li>
                <li>
                  <Link href="/deals" className="text-white/70 hover:text-white transition-colors">
                    Deals
                  </Link>
                </li>
                <li>
                  <Link href="/ask" className="text-white/70 hover:text-white transition-colors">
                    Ask
                  </Link>
                </li>
                <li>
                  <Link href="/vault" className="text-white/70 hover:text-white transition-colors">
                    Documents
                  </Link>
                </li>
                <li>
                  <Link href="/lawyer-application" className="text-white/70 hover:text-white transition-colors">
                    Lawyer review
                  </Link>
                </li>
              </ul>
            </nav>

            <nav aria-label="Company">
              <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-white/40">Company</p>
              <ul className="mt-4 space-y-2.5 text-[13px]">
                <li>
                  <a href="#why-dealenz" className="text-white/70 hover:text-white transition-colors">
                    Our approach
                  </a>
                </li>
                <li>
                  <Link href="/privacy" className="text-white/70 hover:text-white transition-colors">
                    Privacy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="text-white/70 hover:text-white transition-colors">
                    Terms
                  </Link>
                </li>
                <li>
                  <Link href="/login" className="text-white/70 hover:text-white transition-colors">
                    Contact
                  </Link>
                </li>
              </ul>
            </nav>

            <nav aria-label="Trust">
              <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-white/40">Trust</p>
              <ul className="mt-4 space-y-2.5 text-[13px]">
                <li>
                  <Link href="/privacy" className="text-white/70 hover:text-white transition-colors">
                    Privacy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="text-white/70 hover:text-white transition-colors">
                    Terms
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="text-white/70 hover:text-white transition-colors">
                    Security
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="text-white/70 hover:text-white transition-colors">
                    Data practices
                  </Link>
                </li>
              </ul>
            </nav>

            <nav aria-label="Account">
              <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-white/40">Account</p>
              <ul className="mt-4 space-y-2.5 text-[13px]">
                <li>
                  <Link href="/login" className="text-white/70 hover:text-white transition-colors">
                    Log in
                  </Link>
                </li>
                <li>
                  <Link href="/register" className="text-white/70 hover:text-white transition-colors">
                    Get started
                  </Link>
                </li>
              </ul>
            </nav>
          </div>

          <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 sm:flex-row">
            <p className="text-[12px] text-white/40">© 2026 Dealenz</p>
            <p className="text-[12px] text-white/40">
              Are you a lawyer?{" "}
              <Link href="/lawyer-application" className="text-white/70 hover:text-white transition-colors">
                Apply to join Dealenz
              </Link>
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
