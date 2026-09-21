import Link from "next/link"
import {
  ArrowRight,
  CircleAlert,
  Scale,
  ShieldCheck,
} from "lucide-react"
import { LandingHeroPreview } from "@/components/landing-hero-preview"

export const metadata = {
  title: "Dealenz: Know what you are signing before you sign it",
  description:
    "They sent the contract. Dealenz reads it, tells you where the risk is, gives you the words to push back, and guards what was agreed.",
}

const steps = [
  {
    n: "1",
    title: "Send it",
    body: "Drop in their contract or describe the situation in your own words. No questionnaire, no legal form, no account homework.",
  },
  {
    n: "2",
    title: "Push back",
    body: "For each real risk, get the exact words to send back — staged payments, clearer scope, a revised clause. Re-check the redline before you sign.",
  },
  {
    n: "3",
    title: "Sign guarded",
    body: "Both sides sign in the same workspace. Renewals, notice windows, and obligations stay tracked, with email alerts before they matter.",
  },
]

const faqs = [
  {
    q: "What kinds of deals can Dealenz look at?",
    a: "Freelance contracts, leases, partnership agreements, purchase agreements, and more. Dealenz starts with your actual situation instead of forcing it into a template.",
  },
  {
    q: "Is this a replacement for a lawyer?",
    a: "No. Dealenz helps you catch problems before they become legal problems. For high value contracts or anything complex, have a lawyer review the final document. For deals where the stakes call for it, you can request a review from a verified lawyer without leaving the workspace.",
  },
  {
    q: "How does Dealenz check its own work?",
    a: "Every risk Dealenz flags goes through a deterministic rule check before it reaches you, not just an AI result. If the AI and the rules disagree, the rules win.",
  },
  {
    q: "What do I leave with?",
    a: "More than a report. Every freelance analysis can produce the documents you need: a proposal, a scope of work, a contract, or a deliverables checklist — plus the exact words to push back on unfair terms.",
  },
  {
    q: "Can the other side sign here too?",
    a: "Yes. You sign first, then the counterparty signs through a secure link — no account needed on their side. Once everyone has signed, the document locks and any later change becomes a new version, not a silent edit.",
  },
  {
    q: "What happens after I sign?",
    a: "Dealenz can track what was agreed in monitoring: renewal dates, notice windows, payment obligations, and material deadlines — connect Gmail once and it emails you before they matter.",
  },
  {
    q: "Is the free tier a trial?",
    a: "No. It is the product with a daily limit: five analyses per day plus 10 signup credits. No credit card required to start.",
  },
]

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
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

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--burgundy)]">
      {children}
    </p>
  )
}

export default function Home() {
  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#1C1917] selection:bg-[#1C1917] selection:text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      {/* Nav */}
      <header className="bg-[#FAFAF8] pt-6">
        <nav aria-label="Primary" className="mx-auto flex h-[64px] max-w-[1280px] items-center justify-between px-6 lg:px-8">
          <div className="flex items-center gap-10">
            <Link href="/" aria-label="Dealenz home">
              <LogoMark />
            </Link>
            <div className="hidden items-center gap-7 md:flex">
              <Link href="/#how-it-works" className="text-[13px] text-[#1C1917]/60 transition-colors hover:text-[#1C1917]">
                How it works
              </Link>
              <Link href="/#features" className="text-[13px] text-[#1C1917]/60 transition-colors hover:text-[#1C1917]">
                Features
              </Link>
              <Link href="/#pricing" className="text-[13px] text-[#1C1917]/60 transition-colors hover:text-[#1C1917]">
                Pricing
              </Link>
              <Link href="/#faq" className="text-[13px] text-[#1C1917]/60 transition-colors hover:text-[#1C1917]">
                FAQ
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="hidden text-[13px] font-medium text-[#1C1917]/70 transition-colors hover:text-[#1C1917] sm:inline">
              Sign in
            </Link>
            <Link
              href="/register"
              className="inline-flex h-10 items-center gap-2 rounded-full bg-[#1C1917] px-6 text-[13px] font-semibold text-white transition-all hover:bg-black hover:shadow-lg"
            >
              Analyze your deal
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-b from-[#FAFAF8] via-[#F6F1EC] to-[#EFE3DC]">
          <div className="relative mx-auto max-w-[1280px] px-6 pb-16 pt-14 text-center lg:px-8 lg:pt-24">
            <Eyebrow>AI Contract Review Tool</Eyebrow>
            <h1 className="mx-auto mt-5 max-w-[22ch] text-[42px] font-semibold leading-[1.02] tracking-[-0.04em] sm:text-[56px] lg:text-[72px]">
              You signed something you didn&apos;t fully understand.
            </h1>
            <p className="mx-auto mt-6 max-w-[58ch] text-[16px] leading-relaxed text-[#1C1917]/60 lg:text-[18px]">
              Buried clauses, one-sided terms, quiet auto-renewals. Lawyers are slow and
              expensive; generic AI is fast but answers to no one. Dealenz is the
              counterparty-side loop: send us their contract, get back what to push
              back on — in your words. Sign here. Stay guarded.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/register"
                className="inline-flex h-12 items-center gap-2 rounded-full bg-[#1C1917] px-8 text-[15px] font-semibold text-white transition-all hover:bg-black hover:shadow-xl"
              >
                Analyze your deal
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/#how-it-works"
                className="inline-flex h-12 items-center rounded-full border border-black/10 bg-white/60 px-8 text-[15px] font-medium transition-colors hover:bg-white"
              >
                See how it works
              </Link>
            </div>
            <p className="mt-3 text-[12px] text-[#1C1917]/45">
              Free to start. No credit card required.
            </p>
            <div className="mx-auto mt-12 max-w-[880px] text-left">
              <LandingHeroPreview />
              <p className="mt-3 text-center text-[11px] text-black/40">Illustrated example. Your report will reflect your deal.</p>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="border-t border-black/[0.06] bg-[#FAFAF8]">
          <div className="mx-auto max-w-[1280px] px-6 py-16 lg:px-8 lg:py-24">
            <div className="max-w-2xl">
              <Eyebrow>The loop</Eyebrow>
              <h2 className="mt-4 text-[30px] font-semibold tracking-[-0.03em] sm:text-[38px]">
                Three steps. Nothing to learn.
              </h2>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {steps.map((s, i) => (
                <div
                  key={s.n}
                  className={`rounded-[20px] border p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_48px_-20px_rgba(0,0,0,0.25)] sm:p-7 ${
                    i === 1
                      ? "border-[var(--burgundy)]/25 bg-[#1C1917] text-white"
                      : "border-black/[0.07] bg-white"
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-bold ${
                      i === 1 ? "bg-[var(--burgundy)] text-white" : "bg-[#1C1917] text-white"
                    }`}
                  >
                    {s.n}
                  </span>
                  <h3 className="mt-4 text-[18px] font-semibold tracking-[-0.01em]">{s.title}</h3>
                  <p className={`mt-2 text-[14px] leading-relaxed ${i === 1 ? "text-white/65" : "text-black/60"}`}>{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Mission / trust */}
        <section id="mission" className="border-t border-black/[0.06] bg-white">
          <div className="mx-auto max-w-[1280px] px-6 py-16 lg:px-8 lg:py-24">
            <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr]">
              <div>
                <Eyebrow>Why this exists</Eyebrow>
                <h2 className="mt-4 text-[30px] font-semibold tracking-[-0.03em] sm:text-[38px]">
                  Most people sign paper they did not write and cannot fully read.
                </h2>
                <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-black/60">
                  The other side has lawyers. You have a deadline. Dealenz exists to close
                  that gap for the person receiving the paper — the freelancer, the
                  founder, the small business owner — with machine thoroughness,
                  deterministic checks that overrule the AI when they disagree, and
                  words you can actually send back.
                </p>
                <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-black/60">
                  Nothing here is legal advice, and we say that plainly instead of
                  burying it in fine print. For high stakes, get a lawyer — Dealenz
                  will tell you when that moment arrives.
                </p>
              </div>
              <div className="rounded-[20px] border border-black/[0.07] bg-[#FAFAF8] p-6 sm:p-7">
                <h3 className="text-[15px] font-semibold">How your data is handled</h3>
                <ul className="mt-4 space-y-3">
                  {[
                    ["Your deals stay yours", "Every deal is scoped to your account. Nothing is shared, sold, or used to train anyone else's model."],
                    ["AI processing, stated plainly", "Deal content goes to our AI processing provider to produce your analysis — and nowhere else."],
                    ["Delete everything, anytime", "Settings → Delete account erases your account and everything in it. No retention games."],
                    ["No trackers", "Sign-in cookies only. No advertising trackers, ever."],
                  ].map(([title, body]) => (
                    <li key={title} className="flex gap-3">
                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--burgundy)]" />
                      <div>
                        <p className="text-[13px] font-semibold">{title}</p>
                        <p className="mt-0.5 text-[13px] leading-relaxed text-black/55">{body}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Feature deep-dives */}
        <section id="features" className="border-t border-black/[0.06] bg-[#FAFAF8]">
          <div className="mx-auto max-w-[1280px] px-6 py-16 lg:px-8 lg:py-24">
            <div className="max-w-2xl">
              <Eyebrow>What you get</Eyebrow>
              <h2 className="mt-4 text-[30px] font-semibold tracking-[-0.03em] sm:text-[38px]">
                Not a report. Leverage.
              </h2>
            </div>

            <div className="mt-10 grid items-center gap-8 lg:grid-cols-2">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--burgundy)]">Counter-words</p>
                <h3 className="mt-2 text-[24px] font-semibold tracking-[-0.02em]">The exact words to push back with</h3>
                <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-black/60">
                  Every real risk comes with sendable language — staged payments,
                  capped revisions, a revised clause. Written deterministically from
                  the finding, ready to paste into your reply. Copy it straight
                  from the report.
                </p>
              </div>
              <div className="rounded-[20px] border border-black/[0.07] bg-white p-5 shadow-[0_24px_64px_-24px_rgba(0,0,0,0.22)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_32px_72px_-24px_rgba(0,0,0,0.28)]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-black/40">Words to send</p>
                <p className="mt-2 font-serif text-[15px] leading-relaxed">&ldquo;Please cap revisions at two rounds. Extra rounds will be billed at my standard rate.&rdquo;</p>
                <p className="mt-2 text-[11px] text-black/40">Illustrated example · from an unlimited-revisions finding</p>
              </div>
            </div>

            <div className="mt-14 grid items-center gap-8 lg:grid-cols-2">
              <div className="order-2 rounded-[20px] border border-black/[0.07] bg-[#1C1917] p-5 text-white shadow-[0_24px_64px_-24px_rgba(0,0,0,0.4)] transition-all duration-300 hover:-translate-y-1 lg:order-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/50">Evidence</p>
                <p className="mt-2 text-[15px] font-semibold leading-snug">Payment is due before you have leverage to enforce it.</p>
                <p className="mt-3 rounded-xl bg-white/[0.07] px-3.5 py-3 text-[12px] leading-relaxed text-white/80">
                  Clause 4.2: full payment on signing, delivery within 60 days.
                </p>
                <p className="mt-2 text-[11px] text-white/40">Illustrated example · deterministic rule, quoted source</p>
              </div>
              <div className="order-1 lg:order-2">
                <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--burgundy)]">Evidence-anchored findings</p>
                <h3 className="mt-2 text-[24px] font-semibold tracking-[-0.02em]">Every flag carries its clause</h3>
                <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-black/60">
                  Findings are checked by deterministic rules that overrule the AI
                  when they disagree — and each one quotes the exact language it
                  came from. What the model cannot support, it says unknown.
                </p>
              </div>
            </div>

            <div className="mt-14 grid items-center gap-8 lg:grid-cols-2">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--burgundy)]">Sign & stay guarded</p>
                <h3 className="mt-2 text-[24px] font-semibold tracking-[-0.02em]">Both sides sign here. Nothing lapses after.</h3>
                <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-black/60">
                  You sign first, the counterparty signs through a secure link —
                  no account needed. The document locks; later changes become new
                  versions. Renewals, notice windows, and obligations stay
                  tracked in monitoring, with email alerts before they matter.
                </p>
              </div>
              <div className="rounded-[20px] border border-black/[0.07] bg-white p-5 shadow-[0_24px_64px_-24px_rgba(0,0,0,0.22)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_32px_72px_-24px_rgba(0,0,0,0.28)]">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--burgundy)] text-[12px] font-bold text-white">AK</span>
                  <div>
                    <p className="text-[13px] font-semibold">Protection package ready</p>
                    <p className="text-[12px] text-black/50">Revised clause 4.2 is ready to send.</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2 rounded-xl bg-[#FAFAF8] px-3.5 py-2.5">
                  <CircleAlert className="h-3.5 w-3.5 shrink-0 text-amber-700" />
                  <p className="text-[12px]">Renewal in 21 days — alert scheduled</p>
                </div>
                <p className="mt-2 text-[11px] text-black/40">Illustrated example · signing and monitoring</p>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="border-t border-black/[0.06] bg-white">
          <div className="mx-auto max-w-5xl px-6 py-16 lg:py-24">
            <div className="text-center">
              <Eyebrow>Pricing</Eyebrow>
              <h2 className="mt-4 text-[30px] font-semibold tracking-[-0.03em] sm:text-[38px]">
                Pay per deal outcome. Nothing else.
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-[15px] text-black/60">
                No subscriptions, no tiers, no feature gates. Free daily analyses —
                credits only when the work goes deeper.
              </p>
            </div>
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-[20px] border border-black/[0.07] bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
                <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-black/40">Free</p>
                <p className="mt-2 text-4xl font-semibold tracking-tight">$0</p>
                <ul className="mt-5 space-y-2 text-[13px] text-black/60">
                  <li>Five analyses per day</li>
                  <li>10 signup credits</li>
                  <li>All four document types on freelance deals</li>
                </ul>
                <Link href="/register" className="mt-6 flex w-full items-center justify-center rounded-full border border-black/10 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-black/[0.03]">
                  Get started free
                </Link>
              </div>
              {[
                { name: "50 credits", price: "$19", note: "A deal or two" },
                { name: "150 credits", price: "$49", note: "A busy month" },
                { name: "400 credits", price: "$99", note: "Steady deal flow" },
              ].map((p) => (
                <div key={p.name} className="rounded-[20px] border border-black/[0.07] bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-black/40">{p.name}</p>
                  <p className="mt-2 text-4xl font-semibold tracking-tight">{p.price}</p>
                  <p className="mt-1 text-[13px] text-black/55">{p.note}</p>
                  <p className="mt-4 text-[13px] text-black/60">One-time top-up. No subscription.</p>
                  <Link href="/register" className="mt-5 flex w-full items-center justify-center rounded-full bg-[#1C1917] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-black">
                    Get started free
                  </Link>
                </div>
              ))}
            </div>
            <div className="mx-auto mt-8 max-w-3xl rounded-[20px] border border-black/[0.06] bg-[#FAFAF8] p-6">
              <p className="text-[13px] font-semibold">Fixed prices per outcome</p>
              <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-[13px] text-black/60 sm:grid-cols-3">
                <p>Ask brief <span className="font-semibold text-black">10</span></p>
                <p>Ask standard <span className="font-semibold text-black">30</span></p>
                <p>Ask extended <span className="font-semibold text-black">100</span></p>
                <p>Proposal <span className="font-semibold text-black">25</span></p>
                <p>Scope of work <span className="font-semibold text-black">35</span></p>
                <p>Contract <span className="font-semibold text-black">45</span></p>
                <p>Checklist <span className="font-semibold text-black">20</span></p>
                <p>Document upload <span className="font-semibold text-black">15</span></p>
                <p>Signature send <span className="font-semibold text-black">25</span></p>
                <p>Lawyer request <span className="font-semibold text-black">15</span></p>
              </div>
              <p className="mt-3 text-[12px] text-black/45">A typical freelance loop — analysis on the free allowance, proposal, signature send — runs about 50 credits.</p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="border-t border-black/[0.06] bg-[#FAFAF8]">
          <div className="mx-auto max-w-[680px] px-6 py-16 lg:py-24">
            <h2 className="text-[30px] font-semibold tracking-[-0.03em] sm:text-[36px]">
              Common questions
            </h2>
            <div className="mt-10 space-y-4">
              {faqs.map((faq) => (
                <details
                  key={faq.q}
                  className="group rounded-[16px] border border-black/[0.06] bg-white p-5 shadow-sm transition-colors open:shadow-md"
                >
                  <summary className="cursor-pointer list-none text-[15px] font-semibold [&::-webkit-details-marker]:hidden">
                    <span className="flex items-center justify-between gap-4">
                      {faq.q}
                      <span className="text-black/30 transition-transform duration-300 group-open:rotate-45">+</span>
                    </span>
                  </summary>
                  <p className="mt-2.5 text-[14px] leading-relaxed text-black/60">{faq.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="border-t border-black/[0.06] bg-[#1C1917] text-white">
          <div className="mx-auto max-w-[1280px] px-6 py-16 text-center lg:px-8 lg:py-24">
            <h2 className="mx-auto max-w-[20ch] text-[32px] font-semibold leading-[1.05] tracking-[-0.03em] sm:text-[44px]">
              Bring us what you are dealing with.
            </h2>
            <p className="mx-auto mt-3 max-w-[48ch] text-[15px] text-white/60">
              You do not need to know where to start. Send the contract — leave with pushback words.
            </p>
            <div className="mt-8">
              <Link
                href="/register"
                className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-8 text-[15px] font-semibold text-[#141110] transition-all hover:bg-white/90 hover:shadow-xl"
              >
                Analyze your deal
                <ArrowRight className="h-4 w-4" />
              </Link>
              <p className="mt-3 text-[12px] text-white/45">Free to start. No credit card required.</p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative overflow-hidden bg-[#141110] text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 -right-24 h-[480px] w-[480px] rounded-full bg-[var(--burgundy)] opacity-40 blur-[140px]"
        />
        <div className="relative mx-auto max-w-[1280px] px-6 pt-16 lg:px-8">
          <div className="grid gap-10 border-b border-white/10 pb-12 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr_1fr]">
            <div>
              <LogoMark dark />
              <p className="mt-4 max-w-xs text-[13px] leading-relaxed text-white/60">
                The counterparty-side loop for people who receive paper: what to
                push back on, in your words. Sign here. Stay guarded.
              </p>
            </div>
            <nav aria-label="Product">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">Product</p>
              <ul className="mt-4 space-y-2.5 text-[13px]">
                <li><Link href="/#how-it-works" className="text-white/70 transition-colors hover:text-white">How it works</Link></li>
                <li><Link href="/#features" className="text-white/70 transition-colors hover:text-white">Features</Link></li>
                <li><Link href="/#pricing" className="text-white/70 transition-colors hover:text-white">Pricing</Link></li>
                <li><Link href="/register" className="text-white/70 transition-colors hover:text-white">Analyze your deal</Link></li>
                <li><Link href="/register" className="text-white/70 transition-colors hover:text-white">Lawyer review</Link></li>
              </ul>
            </nav>
            <nav aria-label="Company">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">Company</p>
              <ul className="mt-4 space-y-2.5 text-[13px]">
                <li><Link href="/#mission" className="text-white/70 transition-colors hover:text-white">Mission</Link></li>
                <li><a href="mailto:support@dealenz.com" className="text-white/70 transition-colors hover:text-white">Contact</a></li>
                <li><Link href="/lawyer-application" className="text-white/70 transition-colors hover:text-white">Apply as a lawyer</Link></li>
              </ul>
            </nav>
            <nav aria-label="Resources">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">Resources</p>
              <ul className="mt-4 space-y-2.5 text-[13px]">
                <li><Link href="/help" className="text-white/70 transition-colors hover:text-white">Help center</Link></li>
                <li><Link href="/register" className="text-white/70 transition-colors hover:text-white">Get started</Link></li>
                <li><Link href="/login" className="text-white/70 transition-colors hover:text-white">Sign in</Link></li>
              </ul>
            </nav>
            <nav aria-label="Legal">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">Legal</p>
              <ul className="mt-4 space-y-2.5 text-[13px]">
                <li><Link href="/privacy" className="text-white/70 transition-colors hover:text-white">Privacy</Link></li>
                <li><Link href="/terms" className="text-white/70 transition-colors hover:text-white">Terms</Link></li>
              </ul>
            </nav>
          </div>
          <div className="py-6">
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
