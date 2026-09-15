import Link from "next/link"
import {
  FileSearch,
  MessageCircleQuestion,
  ShieldCheck,
  FileText,
  ArrowRight,
  Check,
  CircleAlert,
  Scale,
} from "lucide-react"

export const metadata = {
  title: "Dealenz: Know what you are signing before you sign it",
  description:
    "Dealenz reads what you are being asked to sign, tells you plainly where the risk actually is, and helps you decide what to do about it.",
}

function LogoMark({ dark = false }: { dark?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className={`flex h-7 w-7 items-center justify-center rounded-[7px] ${
          dark ? "bg-white" : "bg-[var(--burgundy)]"
        }`}
      >
        <span
          className={`text-[11px] font-bold tracking-[0.08em] ${
            dark ? "text-[#141110]" : "text-white"
          }`}
        >
          D
        </span>
      </div>
      <span
        className={`text-[15px] font-semibold tracking-[-0.02em] ${
          dark ? "text-white" : "text-[#1C1917]"
        }`}
      >
        dealenz
      </span>
    </div>
  )
}

function Nav() {
  return (
    <header className="bg-[#FAFAF8] pt-6">
      <nav
        aria-label="Primary"
        className="mx-auto flex h-[64px] max-w-[1280px] items-center justify-between px-6 lg:px-8"
      >
        <div className="flex items-center gap-10">
          <Link href="/" aria-label="Dealenz home">
            <LogoMark />
          </Link>
          <div className="hidden items-center gap-7 md:flex">
            <a
              href="#how-it-works"
              className="text-[13px] font-normal tracking-[0.04em] text-[#1C1917]/60 transition-colors hover:text-[#1C1917]"
            >
              How it works
            </a>
            <a
              href="#why-dealenz-exists"
              className="text-[13px] font-normal tracking-[0.04em] text-[#1C1917]/60 transition-colors hover:text-[#1C1917]"
            >
              Why Dealenz
            </a>
            <a
              href="#pricing"
              className="text-[13px] font-normal tracking-[0.04em] text-[#1C1917]/60 transition-colors hover:text-[#1C1917]"
            >
              Pricing
            </a>
            <a
              href="#faq"
              className="text-[13px] font-normal tracking-[0.04em] text-[#1C1917]/60 transition-colors hover:text-[#1C1917]"
            >
              FAQ
            </a>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="text-[13px] font-medium text-[#1C1917]/70 transition-colors hover:text-[#1C1917]"
          >
            Login
          </Link>
          <Link
            href="/register"
            className="inline-flex h-10 items-center rounded-full bg-[#1C1917] px-6 text-[13px] font-semibold text-white transition-colors hover:bg-black"
          >
            Analyze your deal
          </Link>
        </div>
      </nav>
    </header>
  )
}

function Eyebrow({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return (
    <p
      className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${
        light ? "text-white/50" : "text-[#1C1917]/40"
      }`}
    >
      {children}
    </p>
  )
}

function HeroBackdrop() {
  const marks = [
    { top: "12%", left: "8%" },
    { top: "22%", left: "18%" },
    { top: "10%", left: "72%" },
    { top: "28%", left: "86%" },
    { top: "46%", left: "4%" },
    { top: "58%", left: "93%" },
    { top: "38%", left: "64%" },
    { top: "64%", left: "12%" },
  ]
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {marks.map((m, i) => (
        <svg
          key={i}
          width="14"
          height="14"
          viewBox="0 0 14 14"
          className="absolute text-[var(--burgundy)] opacity-[0.10]"
          style={{ top: m.top, left: m.left }}
        >
          {i % 2 === 0 ? (
            <path
              d="M7 1v12M1 7h12"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          ) : (
            <circle cx="7" cy="7" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
          )}
        </svg>
      ))}
    </div>
  )
}

function RiskGauge() {
  return (
    <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-black/[0.06] bg-[#FAFAF8] px-4 py-6 text-center">
      <div className="relative h-[120px] w-[120px]">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
          <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(28,25,23,0.08)" strokeWidth="12" />
          <circle
            cx="60"
            cy="60"
            r="50"
            fill="none"
            stroke="var(--burgundy)"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray="314"
            strokeDashoffset="88"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[26px] font-semibold tracking-tight" data-numeric>
            72
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-black/40">
            Risk score
          </span>
        </div>
      </div>
      <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold text-amber-900">
        <CircleAlert className="h-3 w-3" />
        Needs attention
      </span>
      <p className="mt-3 text-[12px] leading-relaxed text-black/55">
        3 terms carry most of the risk. The rest looks standard.
      </p>
    </div>
  )
}

function HeroMockup() {
  return (
    <div className="rounded-[24px] border border-black/[0.07] bg-white p-3 shadow-[0_24px_64px_-24px_rgba(0,0,0,0.22),0_1px_2px_rgba(0,0,0,0.06)] sm:p-4">
      <div className="grid gap-3 lg:grid-cols-[0.9fr_1.2fr_0.9fr]">
        <RiskGauge />
        <div className="relative overflow-hidden rounded-2xl border border-black/[0.06] bg-[#1C1917] p-5 text-white">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/50">
            Risk report preview
          </p>
          <p className="mt-2 text-[15px] font-semibold leading-snug">
            Payment is due before you have leverage to enforce it.
          </p>
          <div className="mt-3 rounded-xl bg-white/[0.07] px-3.5 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/50">
              Evidence
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-white/80">
              Clause 4.2: full payment on signing, delivery within 60 days.
            </p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-[#1C1917]">
              3 terms flagged
            </span>
            <span className="rounded-full border border-white/20 px-3 py-1.5 text-[11px] font-medium text-white/80">
              Clause 4.2
            </span>
            <span className="rounded-full border border-white/20 px-3 py-1.5 text-[11px] font-medium text-white/80">
              Rule checked
            </span>
          </div>
        </div>
        <div className="grid gap-3">
          <div className="rounded-2xl border border-black/[0.06] bg-[#FAFAF8] px-4 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-black/40">
              Risk across the deal
            </p>
            <svg viewBox="0 0 200 48" className="mt-3 h-12 w-full" aria-hidden>
              <polyline
                points="0,36 20,32 40,34 60,22 80,26 100,14 120,20 140,10 160,16 180,8 200,12"
                fill="none"
                stroke="var(--burgundy)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="140" cy="10" r="4" fill="var(--burgundy)" />
            </svg>
            <p className="mt-1 text-[11px] text-black/50">Highest exposure sits in payment terms.</p>
          </div>
          <div className="rounded-2xl border border-black/[0.06] bg-white px-4 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--burgundy)] text-[12px] font-bold text-white">
                AK
              </span>
              <div>
                <p className="text-[12px] font-semibold">Protection package ready</p>
                <p className="text-[11px] text-black/50">Revised clause 4.2 is ready to send.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-3 rounded-2xl border border-black/[0.06] bg-[#FAFAF8] px-4 py-3.5">
          <ShieldCheck className="h-4 w-4 text-[var(--burgundy)]" />
          <p className="text-[12px] font-medium">Protection checklist: 4 of 6 items done</p>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-black/[0.06] bg-[#FAFAF8] px-4 py-3.5">
          <Scale className="h-4 w-4 text-[var(--burgundy)]" />
          <p className="text-[12px] font-medium">Lawyer review available in the same workspace</p>
        </div>
      </div>
    </div>
  )
}

const featureCards = [
  {
    n: "1/",
    icon: MessageCircleQuestion,
    tint: "bg-[var(--burgundy)]",
    caption: "Say what is happening, in your own words",
  },
  {
    n: "2/",
    icon: FileSearch,
    tint: "bg-[#1C1917]",
    caption: "See where the risk actually sits",
  },
  {
    n: "3/",
    icon: ShieldCheck,
    tint: "bg-[#3D5A45]",
    caption: "Know what to push back on",
  },
  {
    n: "4/",
    icon: FileText,
    tint: "bg-[#5A4A3A]",
    caption: "Leave with documents you can send",
  },
]

const processSteps = [
  {
    title: "Describe",
    body: "Explain the situation in your own words. No questionnaire, no legal form. Dealenz asks one focused question at a time, and only when the answer changes what to check.",
  },
  {
    title: "Understand",
    body: "Dealenz reads the document in the context of your situation and shows what each finding means for you, with the clause it came from and why it matters.",
  },
  {
    title: "Protect",
    body: "For each real risk, Dealenz proposes what could change: staged payments, clearer scope, a revised clause. You get protective language, not just warnings.",
  },
  {
    title: "Complete",
    body: "Generate the documents the situation calls for, bring in a verified lawyer when the stakes warrant it, then sign and keep a record in one workspace.",
  },
]

const riskPoints = [
  ["What is actually being agreed", "Not just what the clause says, but what it means for you."],
  ["What is missing", "Silence in a contract can matter as much as what is written."],
  ["What could leave you exposed", "Where the risk lands, and when it lands on you."],
  ["What should change", "And what happens next if you do nothing."],
]

const documentCards = [
  ["Proposal", "Set terms fairly before work starts."],
  ["Scope of work", "Define what is included, and what is not."],
  ["Contract", "Clear language for the deal in front of you."],
  ["Deliverables checklist", "Track what was agreed, all the way to done."],
]

const pricingFree = [
  "Five analyses per day.",
  "All four document types.",
  "Client portal and signing.",
  "Activity timeline.",
]

const pricingCredits = [
  "Free daily analyses included.",
  "Ask credits for deeper conversations.",
  "Buy packs inside the app when you need them.",
]

const faqs = [
  {
    q: "What kinds of deals can Dealenz look at?",
    a: "Freelance contracts, leases, partnership agreements, purchase agreements, and more. Dealenz starts with your actual situation instead of forcing it into a template.",
  },
  {
    q: "Is this a replacement for a lawyer?",
    a: "No. Dealenz helps you catch problems before they become legal problems. For high value contracts or anything complex, have a lawyer review the final document. For deals where the stakes call for it, Dealenz can bring a real, verified lawyer into the same workspace.",
  },
  {
    q: "How does Dealenz check its own work?",
    a: "Every risk Dealenz flags goes through a deterministic rule check before it reaches you, not just an AI result. If the AI and the rules disagree, the rules win.",
  },
  {
    q: "What do I leave with?",
    a: "More than a report. Every analysis can produce the documents you need: a proposal, a scope of work, a contract, or a deliverables checklist. Something to send, not just something to worry about.",
  },
  {
    q: "Who can see my deals?",
    a: "Only you. Every deal is scoped to your account and your documents stay in your workspace.",
  },
  {
    q: "Is the free tier a trial?",
    a: "No. It is the product with a daily limit. No credit card required to start.",
  },
]

const howItWorks = [
  {
    title: "AI finds things. It does not decide things.",
    body: "Every risk Dealenz flags goes through a deterministic rule check before it reaches you, not just an AI's best guess. If the AI and the rules disagree, the rules win. That's a deliberate choice: AI is good at reading a lot of text quickly, but it shouldn't be the final word on something that could cost you money or leave you exposed.",
  },
  {
    title: "Dealenz is not a law firm.",
    body: "Nothing Dealenz produces is legal advice, and we say that plainly instead of burying it in fine print. For deals where the stakes are high enough to need one, Dealenz can bring a real, verified lawyer into the conversation. AI gets you most of the way there. A person should make the final call when it matters.",
  },
  {
    title: "You leave with something real, not just an opinion.",
    body: "A risk report on its own doesn't protect you. Every Dealenz analysis can produce the actual documents you need. A proposal, a scope of work, a contract, a deliverables checklist, whatever the situation calls for, so you have something to actually send, not just something to worry about.",
  },
  {
    title: "Built for the deal in front of you, not a category of user.",
    body: "Dealenz started narrow and grew because the same problem kept showing up in different rooms. It works the same way whether you're a freelancer, a founder, or a small business owner: it starts with your actual situation, not a form asking you to describe yourself first.",
  },
]

export default function Home() {
  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#1C1917] selection:bg-[#1C1917] selection:text-white">
      <Nav />

      <main>
        <section className="relative overflow-hidden bg-gradient-to-b from-[#FAFAF8] via-[#F6F1EC] to-[#EFE3DC]">
          <HeroBackdrop />
          <div className="relative mx-auto max-w-[1280px] px-6 pb-14 pt-14 text-center lg:px-8 lg:pt-20">
            <Eyebrow>Know what you are signing before you sign it</Eyebrow>
            <h1 className="mx-auto mt-5 max-w-[20ch] text-[42px] font-semibold leading-[1.02] tracking-[-0.04em] sm:text-[56px] lg:text-[68px]">
              The deal makes sense.
              <br />
              <span className="text-[var(--burgundy)]">Make sure the paperwork does too.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-[52ch] text-[16px] leading-relaxed text-[#1C1917]/60">
              Dealenz reads what you are being asked to sign, tells you plainly where the risk
              actually is, and helps you decide what to do about it.
            </p>
            <div className="mt-8 flex flex-col items-center">
              <Link
                href="/register"
                className="inline-flex h-12 items-center gap-2 rounded-full bg-[#1C1917] px-8 text-[15px] font-semibold text-white transition-colors hover:bg-black"
              >
                Analyze your deal
                <ArrowRight className="h-4 w-4" />
              </Link>
              <p className="mt-3 text-[12px] text-[#1C1917]/45">
                Free to start. No credit card required.
              </p>
            </div>
            <div className="mt-12 text-left">
              <HeroMockup />
            </div>
          </div>
        </section>

        <section className="border-t border-black/[0.06] bg-white">
          <div className="mx-auto max-w-[1280px] px-6 py-16 lg:px-8 lg:py-24">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-[30px] font-semibold tracking-[-0.03em] sm:text-[38px]">
                From first question to signed agreement
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed text-black/60">
                One workspace carries the matter forward, so context is never lost between steps.
              </p>
              <a
                href="#how-it-works"
                className="mt-6 inline-flex h-10 items-center rounded-full border border-black/10 bg-white px-6 text-[13px] font-medium transition-colors hover:bg-black/[0.03]"
              >
                See how it works
              </a>
            </div>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {featureCards.map((card) => (
                <div
                  key={card.n}
                  className="relative overflow-hidden rounded-[20px] border border-black/[0.07] bg-white shadow-surface"
                >
                  <span className="absolute left-4 top-4 z-10 rounded-full bg-black/[0.45] px-2.5 py-1 text-[11px] font-bold tracking-widest text-white">
                    {card.n}
                  </span>
                  <div
                    className={`flex h-[220px] items-center justify-center ${card.tint}`}
                  >
                    <card.icon className="h-16 w-16 text-white" strokeWidth={1.25} />
                  </div>
                  <p className="px-5 py-4 text-[13px] font-medium leading-snug">{card.caption}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="why-dealenz-exists" className="border-t border-black/[0.06] bg-[#FAFAF8]">
          <div className="mx-auto max-w-[760px] px-6 py-16 lg:py-24">
            <Eyebrow>Why Dealenz exists</Eyebrow>
            <div className="mt-5 space-y-5 text-[16px] leading-relaxed text-[#1C1917]/75">
              <p>
                Most people sign agreements without really understanding what they are agreeing to.
                Not because they are careless, but because reading a contract closely takes time,
                and knowing what actually matters in it takes experience most people do not have.
              </p>
              <p>
                Dealenz started as a tool for freelancers, because that is where the problem is
                easiest to see: a scope-of-work email, a payment clause buried in paragraph four,
                a client who just wants one small change that turns into three unpaid weeks. But
                the same blind spot exists everywhere. Founders signing their first partnership
                agreement. Small business owners buying out a supplier. People renting a space for
                the first time. The deal is different, but the moment is the same: you are being
                asked to agree to something you do not have time to fully understand.
              </p>
              <p>
                So Dealenz became a tool for anyone in that moment. It reads what you are being
                asked to sign, tells you plainly where the risk actually is, and helps you decide
                what to do about it, whether that is negotiating a term, generating your own
                protective language, or bringing in a real lawyer when the stakes call for it.
              </p>
            </div>
          </div>
        </section>

        <section className="border-t border-black/[0.06] bg-white">
          <div className="mx-auto max-w-[1280px] px-6 py-16 lg:px-8 lg:py-24">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-[26px] font-medium leading-snug tracking-[-0.02em] sm:text-[32px]">
                By the time you notice the bad terms, you have already agreed to them.
              </p>
              <p className="mt-4 text-[14px] leading-relaxed text-black/55">
                The document is rarely the whole problem. Before anyone can tell you what matters,
                they need to understand the situation around it.
              </p>
            </div>
            <div className="mx-auto mt-10 grid max-w-4xl gap-4 sm:grid-cols-2">
              {riskPoints.map(([title, desc]) => (
                <div
                  key={title}
                  className="rounded-[16px] border border-black/[0.07] bg-[#FAFAF8] px-5 py-5 shadow-surface"
                >
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--burgundy)]" aria-hidden />
                    <p className="text-[13px] font-semibold">{title}</p>
                  </div>
                  <p className="mt-2 text-[13px] leading-relaxed text-black/55">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="border-t border-black/[0.06] bg-[#FAFAF8]">
          <div className="mx-auto max-w-[1280px] px-6 py-16 lg:px-8 lg:py-24">
            <div className="max-w-2xl">
              <Eyebrow>How it works</Eyebrow>
              <h2 className="mt-4 text-[30px] font-semibold tracking-[-0.03em] sm:text-[38px]">
                Four steps, one workspace
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed text-black/60">
                Start with what you know. Dealenz structures the situation as you talk, checks
                what matters, and helps you act on it.
              </p>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {processSteps.map((step, i) => (
                <div
                  key={step.title}
                  className="rounded-[20px] border border-black/[0.07] bg-white p-6 shadow-surface"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1C1917] text-[12px] font-bold text-white">
                    {i + 1}
                  </span>
                  <h3 className="mt-4 text-[16px] font-semibold tracking-[-0.01em]">{step.title}</h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-black/60">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-black/[0.06] bg-white">
          <div className="mx-auto max-w-[1280px] px-6 py-16 lg:px-8 lg:py-20">
            <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
              <div>
                <Eyebrow>Risk intelligence</Eyebrow>
                <h2 className="mt-4 text-[30px] font-semibold tracking-[-0.03em] sm:text-[36px]">
                  Grounded in evidence, checked by rules
                </h2>
                <p className="mt-4 text-[15px] leading-relaxed text-black/60">
                  Not a summary. A reading of what the situation means for you. Every finding
                  points to the clause it came from and says why it matters for your situation.
                </p>
                <p className="mt-3 text-[14px] leading-relaxed text-black/55">
                  When a conclusion can be grounded, Dealenz shows the basis. When it cannot, it
                  says so plainly.
                </p>
              </div>
              <div className="overflow-hidden rounded-[20px] border border-black/[0.07] bg-white shadow-surface">
                <div className="flex items-center justify-between border-b border-black/[0.06] bg-[#FAFAF8] px-5 py-3">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-black/40">
                    Finding: payment terms
                  </span>
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-900">
                    Attention
                  </span>
                </div>
                <div className="p-5 sm:p-6">
                  <h3 className="text-[15px] font-semibold leading-snug">
                    Payment is due before you have leverage to enforce it.
                  </h3>
                  <div className="mt-3 rounded-xl border border-black/[0.06] bg-[#FAFAF8] px-3.5 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-black/40">
                      Evidence
                    </p>
                    <p className="mt-1 text-[13px] leading-relaxed text-black/70">
                      Clause 4.2: full payment on signing, delivery within 60 days.
                    </p>
                  </div>
                  <p className="mt-3 text-[13px] leading-relaxed text-black/60">
                    If delivery slips, you have already paid. Suggested next step: ask for staged
                    payments tied to milestones.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-black/[0.06] bg-[#FAFAF8]">
          <div className="mx-auto max-w-[1280px] px-6 py-16 lg:px-8 lg:py-20">
            <div className="max-w-2xl">
              <Eyebrow>Documents you get</Eyebrow>
              <h2 className="mt-4 text-[30px] font-semibold tracking-[-0.03em] sm:text-[36px]">
                Leave with something to send
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed text-black/60">
                A risk report on its own does not protect you. Every analysis can produce the
                actual documents the situation calls for.
              </p>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {documentCards.map(([title, desc]) => (
                <div
                  key={title}
                  className="rounded-[20px] border border-black/[0.07] bg-white p-6 shadow-surface"
                >
                  <FileText className="h-5 w-5 text-[var(--burgundy)]" />
                  <h3 className="mt-4 text-[15px] font-semibold">{title}</h3>
                  <p className="mt-1 text-[13px] leading-relaxed text-black/55">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="border-t border-black/[0.06] bg-white">
          <div className="mx-auto max-w-4xl px-6 py-16 lg:py-24">
            <div className="text-center">
              <Eyebrow>Pricing</Eyebrow>
              <h2 className="mt-4 text-[30px] font-semibold tracking-[-0.03em] sm:text-[38px]">
                Simple pricing
              </h2>
              <p className="mt-3 text-[15px] text-black/60">
                Start free. Pay only for deeper work, when you need it.
              </p>
            </div>
            <div className="mt-12 grid gap-6 sm:grid-cols-2">
              <div className="rounded-[20px] border border-black/[0.07] bg-white p-8 shadow-surface">
                <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-black/40">
                  Free
                </p>
                <p className="mt-2 text-4xl font-semibold tracking-tight">$0</p>
                <p className="mt-1 text-sm text-black/55">For getting started</p>
                <ul className="mt-6 space-y-2.5">
                  {pricingFree.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-black/60">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/register"
                  className="mt-8 flex w-full items-center justify-center rounded-full border border-black/10 bg-white px-4 py-2.5 text-sm font-medium transition-colors hover:bg-black/[0.03]"
                >
                  Get started free
                </Link>
              </div>
              <div className="rounded-[20px] border border-[var(--burgundy)]/25 bg-white p-8 shadow-raised">
                <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-black/40">
                  Credits
                </p>
                <p className="mt-2 text-4xl font-semibold tracking-tight">Pay as you go</p>
                <p className="mt-1 text-sm text-black/55">For deeper AI work</p>
                <ul className="mt-6 space-y-2.5">
                  {pricingCredits.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-black/60">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/register"
                  className="mt-8 flex w-full items-center justify-center rounded-full bg-[var(--burgundy)] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--brand-red-hover)]"
                >
                  Get started free
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section id="faq" className="border-t border-black/[0.06] bg-[#FAFAF8]">
          <div className="mx-auto max-w-[680px] px-6 py-16 lg:py-24">
            <h2 className="text-[30px] font-semibold tracking-[-0.03em] sm:text-[36px]">
              Common questions
            </h2>
            <div className="mt-10 space-y-4">
              {faqs.map((faq) => (
                <div
                  key={faq.q}
                  className="rounded-[16px] border border-black/[0.06] bg-white p-5 shadow-surface"
                >
                  <p className="text-[15px] font-semibold">{faq.q}</p>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-black/60">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-black/[0.06] bg-white">
          <div className="mx-auto max-w-[1280px] px-6 py-16 lg:px-8 lg:py-24">
            <div className="max-w-2xl">
              <Eyebrow>How Dealenz actually works</Eyebrow>
              <h2 className="mt-4 text-[30px] font-semibold tracking-[-0.03em] sm:text-[38px]">
                What we will and will not do
              </h2>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-2">
              {howItWorks.map((item, i) => (
                <div
                  key={item.title}
                  className="rounded-[20px] border border-black/[0.07] bg-[#FAFAF8] p-6 sm:p-7"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--burgundy)] text-[12px] font-bold text-white">
                    {i + 1}
                  </span>
                  <h3 className="mt-4 text-[17px] font-semibold tracking-[-0.01em]">{item.title}</h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-black/60">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="relative overflow-hidden bg-[#141110] text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 -right-24 h-[480px] w-[480px] rounded-full bg-[var(--burgundy)] opacity-40 blur-[140px]"
        />
        <div className="relative mx-auto max-w-[1280px] px-6 pt-16 lg:px-8">
          <h2 className="max-w-[18ch] text-[34px] font-semibold leading-[1.05] tracking-[-0.03em] sm:text-[44px]">
            Bring us what you are dealing with.
          </h2>
          <p className="mt-3 text-[15px] text-white/60">You do not need to know where to start.</p>
          <div className="mt-7">
            <Link
              href="/register"
              className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-8 text-[15px] font-semibold text-[#141110] transition-colors hover:bg-white/90"
            >
              Analyze your deal
              <ArrowRight className="h-4 w-4" />
            </Link>
            <p className="mt-3 text-[12px] text-white/45">Free to start. No credit card required.</p>
          </div>

          <div className="mt-16 grid gap-10 border-t border-white/10 pt-12 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
            <div>
              <LogoMark dark />
              <p className="mt-4 max-w-xs text-[13px] leading-relaxed text-white/60">
                Reads what you are being asked to sign and tells you plainly where the risk
                actually is.
              </p>
            </div>
            <nav aria-label="Product">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
                Product
              </p>
              <ul className="mt-4 space-y-2.5 text-[13px]">
                <li>
                  <a href="#how-it-works" className="text-white/70 transition-colors hover:text-white">
                    How it works
                  </a>
                </li>
                <li>
                  <a href="#pricing" className="text-white/70 transition-colors hover:text-white">
                    Pricing
                  </a>
                </li>
                <li>
                  <Link href="/audit/new" className="text-white/70 transition-colors hover:text-white">
                    Analyze your deal
                  </Link>
                </li>
                <li>
                  <Link href="/ask" className="text-white/70 transition-colors hover:text-white">
                    Ask
                  </Link>
                </li>
                <li>
                  <Link href="/lawyer-application" className="text-white/70 transition-colors hover:text-white">
                    Lawyer review
                  </Link>
                </li>
              </ul>
            </nav>
            <nav aria-label="Legal">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
                Legal
              </p>
              <ul className="mt-4 space-y-2.5 text-[13px]">
                <li>
                  <Link href="/privacy" className="text-white/70 transition-colors hover:text-white">
                    Privacy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="text-white/70 transition-colors hover:text-white">
                    Terms
                  </Link>
                </li>
              </ul>
            </nav>
            <nav aria-label="Account">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
                Account
              </p>
              <ul className="mt-4 space-y-2.5 text-[13px]">
                <li>
                  <Link href="/login" className="text-white/70 transition-colors hover:text-white">
                    Sign in
                  </Link>
                </li>
                <li>
                  <Link href="/register" className="text-white/70 transition-colors hover:text-white">
                    Get started
                  </Link>
                </li>
                <li>
                  <Link
                    href="/lawyer-application"
                    className="text-white/70 transition-colors hover:text-white"
                  >
                    Apply as a lawyer
                  </Link>
                </li>
              </ul>
            </nav>
          </div>

          <div className="mt-12 border-t border-white/10 py-6">
            <p className="max-w-3xl text-[12px] leading-relaxed text-white/40">
              Dealenz generates AI-assisted recommendations and document drafts. These are not
              legal services or legal advice. Review important agreements with a qualified
              professional.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[12px] text-white/40">© 2026 Dealenz</p>
              <p className="text-[12px] text-white/40">
                Are you a lawyer?{" "}
                <Link href="/lawyer-application" className="text-white/70 hover:text-white">
                  Apply to join Dealenz
                </Link>
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
