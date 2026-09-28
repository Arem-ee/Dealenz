import Link from "next/link"
import Image from "next/image"
import { LandingMobileNav } from "./landing-mobile-nav"
import { CREDIT_PACKAGES, formatPrice, packageValueLines } from "@/lib/billing/catalog"
import {
  ArrowRight,
  Bell,
  CheckCircle2,
  CircleAlert,
  Clock,
  Download,
  EyeOff,
  FileCheck,
  FileText,
  Mail,
  PenLine,
  RotateCcw,
  Scale,
  Search,
  ShieldCheck,
  Trash2,
  Unlink,
  Upload,
} from "lucide-react"

export const metadata = {
  title: "Dealenz — Contract analysis, drafting, signing, and tracking",
  description:
    "Upload their contract. See every risk with its clause. Draft documents, sign, and stay covered.",
}

const steps = [
  {
    n: "1",
    title: "Upload it",
    tag: "Their paper in",
    body: "Drop in the contract they sent, or describe the situation in your own words. There is no questionnaire to complete, no legal form to fill in, and no background reading required before you begin.",
  },
  {
    n: "2",
    title: "Respond",
    tag: "Drafted replies",
    body: "For each genuine risk, you receive a drafted response — staged payments, clearer scope, a revised clause — which you can send as written or adjust in your own voice. When they return a revision, re-check it here before you sign.",
  },
  {
    n: "3",
    title: "Sign covered",
    tag: "Sign tracked",
    body: "You sign first, then the other side signs through a secure link — no account needed on their end. Renewals, notice windows, and obligations stay tracked, with email alerts before they matter.",
  },
]

const faqs = [
  {
    q: "What kinds of deals can Dealenz look at?",
    a: "Freelance contracts, leases, partnership agreements, purchase agreements, employment terms, founder agreements, and MSAs. Dealenz starts from your actual situation instead of forcing it into a template, and it tells you plainly when something falls outside what it handles well.",
  },
  {
    q: "Is this a replacement for a lawyer?",
    a: "No. Dealenz helps you catch problems before they become legal problems, and it prepares a cleaner file for your lawyer when one is needed. For high-value contracts or anything genuinely complex, have a qualified lawyer review the final document.",
  },
  {
    q: "How does Dealenz check its own work?",
    a: "Every risk it flags goes through a deterministic rule check before it reaches you — not just an AI result. Where the model and the rules disagree, the rules win, and findings that lack supporting evidence are reported as unknown rather than stated with false confidence.",
  },
  {
    q: "What do I leave with?",
    a: "More than a report. Every freelance analysis can produce the documents the situation calls for — a proposal, a scope of work, a contract, or a deliverables checklist — alongside negotiation drafts for the terms you should push back on.",
  },
  {
    q: "Can the other side sign here too?",
    a: "Yes. You sign first, then the counterparty signs through a secure link, with no account needed on their side. Once everyone has signed, the document locks, and any later change becomes a new version rather than a silent edit.",
  },
  {
    q: "What happens after I sign?",
    a: "Dealenz keeps watch over what was agreed through monitoring: renewal dates, notice windows, payment obligations, and material deadlines. Connect Gmail once and it emails you before each one matters, instead of after.",
  },
  {
    q: "What happens to my contract data?",
    a: "It stays yours. Mask emails, phone numbers, and your own terms before sending — detection runs in your browser and you review every item. Delete any single deal from your dashboard, download everything from Settings, and revoke any shared link at any time. Your database lives in the EU, there are no advertising trackers, and deleting your account erases your deals, documents, and files — billing records and provider backups age out separately.",
  },
  {
    q: "Is the free tier a trial?",
    a: "There is no trial because there is nothing to gate: every account starts with 10 signup credits, which covers your first two analyses. No credit card is required to start, and nothing expires.",
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
      <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-[7px]">
        <Image
          src="/favicon.svg"
          alt="Dealenz logo"
          fill
          className="object-cover"
          priority
        />
      </div>
      <span
        className={`text-[15px] font-semibold tracking-[-0.02em] ${
          dark ? "text-white" : "text-foreground"
        }`}
      >
        dealenz
      </span>
    </div>
  )
}

function ProductShot({ url, label, children }: { url: string; label: string; children: React.ReactNode }) {
  return (
    <figure role="img" aria-label={label} className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2.5" aria-hidden>
        <span className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
        </span>
        <span className="ml-2 min-w-0 flex-1 truncate rounded-md bg-background px-3 py-1 text-[11px] text-foreground/45">{url}</span>
      </div>
      <div className="p-5 text-left sm:p-6" aria-hidden>
        {children}
      </div>
    </figure>
  )
}

function OrbitChip({ className, label, children }: { className?: string; label: string; children: React.ReactNode }) {
  return (
    <div
      title={label}
      aria-hidden
      className={`absolute flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card shadow-[0_12px_28px_-12px_rgba(28,25,23,0.25)] sm:h-14 sm:w-14 lg:h-16 lg:w-16 [&_svg]:h-5 [&_svg]:w-5 sm:[&_svg]:h-6 sm:[&_svg]:w-6 ${className ?? ""}`}
    >
      {children}
    </div>
  )
}

export default function Home() {
  return (
    <div className="landing-anchor-scroll light min-h-screen bg-card text-foreground selection:bg-primary selection:text-primary-foreground">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      {/* Nav */}
      <header className="border-b border-border bg-card">
        <nav aria-label="Primary" className="mx-auto flex h-[68px] max-w-[1280px] items-center justify-between px-6 lg:px-8">
          <Link href="/" aria-label="Dealenz home">
            <LogoMark />
          </Link>
          <div className="hidden items-center gap-7 md:flex">
            <Link href="/#how-it-works" className="text-[13px] text-foreground/60 transition-colors hover:text-foreground">
              How it works
            </Link>
            <Link href="/#features" className="text-[13px] text-foreground/60 transition-colors hover:text-foreground">
              Features
            </Link>
            <Link href="/#pricing" className="text-[13px] text-foreground/60 transition-colors hover:text-foreground">
              Pricing
            </Link>
            <Link href="/#faq" className="text-[13px] text-foreground/60 transition-colors hover:text-foreground">
              FAQ
            </Link>
          </div>
          <div className="flex items-center gap-1 sm:gap-3">
            <LandingMobileNav />
            <Link href="/login" className="hidden text-[13px] font-medium text-foreground/70 transition-colors hover:text-foreground sm:inline">
              Sign in
            </Link>
            <Link
              href="/register"
              className="inline-flex h-9 items-center rounded-full bg-[var(--burgundy)] px-5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
            >
              Get started free
            </Link>
          </div>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden bg-card">
          <div className="relative mx-auto max-w-[1280px] px-6 pt-12 text-center lg:px-8 lg:pt-16">
            {/* Headline layer paints above the orbit field pulled up behind it. */}
            <div className="relative z-10">
            <div className="flex items-center justify-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-[11px] font-medium text-foreground/60">
                <ShieldCheck className="h-3 w-3 text-[var(--burgundy)]" />
                Rules check every flag
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-[11px] font-medium text-foreground/60">
                <FileText className="h-3 w-3 text-[var(--burgundy)]" />
                10 signup credits — first two analyses free
              </span>
            </div>
            <h1 className="mx-auto mt-5 max-w-[20ch] text-[40px] font-semibold leading-[1.04] tracking-[-0.04em] sm:text-[48px] lg:text-[56px]">
              Know what&apos;s in your contracts.
            </h1>
            <p className="mx-auto mt-5 max-w-[60ch] text-[15px] leading-relaxed text-foreground/60 lg:text-[16px]">
              Upload the contract you received. Dealenz reads every clause, flags the terms that put you
              at risk, drafts your replies, and carries the deal through signing, renewal, and every
              deadline after it.
            </p>
            <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/register"
                className="inline-flex h-11 items-center gap-2 rounded-full bg-[var(--burgundy)] px-7 text-[14px] font-semibold text-white transition-opacity hover:opacity-90"
              >
                Get started free
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/#how-it-works"
                className="inline-flex h-11 items-center gap-1.5 px-2 text-[14px] font-medium text-foreground/70 transition-colors hover:text-foreground"
              >
                See how it works
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            </div>

            {/* Orbit visual — the field sits behind the headline (pulled up
                under the nav) so the icons orbit the message, not the cards.
                Rings center ~1/3 down; the exhibit stack rests ~3/4 down. */}
            <div className="relative mx-auto -mt-[400px] h-[780px] max-w-[1080px] sm:-mt-[440px] sm:h-[860px]" aria-hidden>
              <div className="absolute left-1/2 top-[34%] h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-border sm:h-[620px] sm:w-[620px]" />
              <div className="absolute left-1/2 top-[34%] h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-border sm:h-[880px] sm:w-[880px]" />
              <div className="absolute left-1/2 top-[34%] hidden h-[1180px] w-[1180px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-border md:block" />
              <OrbitChip label="Contract" className="left-[6%] top-[6%]">
                <FileText className="h-4 w-4 text-[var(--burgundy)]" />
              </OrbitChip>
              <OrbitChip label="Signed" className="left-[12%] top-[22%] hidden sm:flex">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              </OrbitChip>
              <OrbitChip label="Review" className="right-[6%] top-[5%]">
                <Search className="h-4 w-4 text-amber-600" />
              </OrbitChip>
              <OrbitChip label="Deadlines" className="right-[13%] top-[21%] hidden sm:flex">
                <Clock className="h-4 w-4 text-sky-600" />
              </OrbitChip>
              <OrbitChip label="Fair terms" className="left-[1%] top-[44%]">
                <Scale className="h-4 w-4 text-emerald-600" />
              </OrbitChip>
              <OrbitChip label="Verified" className="left-[5%] top-[62%] hidden sm:flex">
                <ShieldCheck className="h-4 w-4 text-[var(--burgundy)]" />
              </OrbitChip>
              <OrbitChip label="Alerts" className="right-[1%] top-[42%]">
                <Bell className="h-4 w-4 text-sky-600" />
              </OrbitChip>
              <OrbitChip label="Protected" className="right-[6%] top-[60%] hidden sm:flex">
                <FileCheck className="h-4 w-4 text-violet-600" />
              </OrbitChip>
              <OrbitChip label="Upload" className="left-[18%] top-[80%]">
                <Upload className="h-4 w-4 text-violet-600" />
              </OrbitChip>
              <OrbitChip label="Signature" className="right-[18%] top-[78%]">
                <PenLine className="h-4 w-4 text-rose-600" />
              </OrbitChip>
              <OrbitChip label="Monitoring" className="left-1/2 top-[91%] hidden -translate-x-1/2 sm:flex">
                <Mail className="h-4 w-4 text-orange-500" />
              </OrbitChip>

              {/* Center notification stack — overlapping like handled paper */}
              <div className="absolute left-1/2 top-[72%] w-[300px] -translate-x-1/2 -translate-y-1/2 -space-y-4 text-left sm:w-[330px]">
                <div className="rounded-2xl border border-border bg-card p-3.5 shadow-[0_20px_48px_-16px_rgba(0,0,0,0.25)]">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[11px] font-bold text-amber-800">F1</span>
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-semibold">Unlimited revisions, fixed price</p>
                      <p className="text-[11px] text-foreground/50">High risk · Clause 3.1 quoted</p>
                    </div>
                  </div>
                </div>
                <div className="ml-6 rounded-2xl border border-border bg-card p-3.5 shadow-[0_20px_48px_-16px_rgba(0,0,0,0.25)]">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/40">Suggested response</p>
                  <p className="mt-1 text-[12px] leading-relaxed">&ldquo;Please cap revisions at two rounds. Extra rounds will be billed at my standard rate.&rdquo;</p>
                </div>
                <div className="ml-12 flex items-center gap-2 rounded-2xl border border-border bg-card px-3.5 py-2.5 shadow-[0_20px_48px_-16px_rgba(0,0,0,0.25)]">
                  <CircleAlert className="h-3.5 w-3.5 shrink-0 text-amber-700" />
                  <p className="text-[12px]">Renewal in 21 days — alert scheduled</p>
                </div>
              </div>
            </div>
            <p className="relative mt-2 text-[11px] text-foreground/40">Illustrated example. Your report will reflect your deal.</p>
          </div>
        </section>

        {/* Deal-type cloud */}
        <section className="border-y border-border bg-card">
          <div className="mx-auto max-w-[1280px] px-6 py-10 lg:px-8">
            <p className="text-center text-[12px] text-foreground/40">Built for the people who receive the paper, not the ones who wrote it</p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-[15px] text-foreground/35">
              <span className="font-semibold tracking-tight">Freelance contracts</span>
              <span className="font-medium">Founder agreements</span>
              <span className="font-bold tracking-tight">Leases</span>
              <span className="font-medium">Employment terms</span>
              <span className="font-semibold tracking-tight">Partnerships</span>
              <span className="font-medium">Purchase agreements</span>
              <span className="font-bold tracking-tight">MSAs</span>
            </div>
          </div>
        </section>

        {/* 2x2 features */}
        <section id="features" className="bg-card">
          <div className="mx-auto max-w-[1080px] px-6 py-16 lg:px-8 lg:py-24">
            <h2 className="mx-auto max-w-[24ch] text-center text-[28px] font-semibold leading-tight tracking-[-0.03em] sm:text-[36px]">
              Clarity for every deal you didn&apos;t write
            </h2>
            <div className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2">
              {[
                {
                  icon: <Search className="h-4 w-4 text-[var(--burgundy)]" />,
                  title: "Every flag carries its clause",
                  body: "Each finding quotes the exact language it came from, so you can verify everything yourself instead of taking the software at its word. Where the evidence does not support a conclusion, the report says unknown rather than guessing.",
                },
                {
                  icon: <PenLine className="h-4 w-4 text-[var(--burgundy)]" />,
                  title: "Negotiation drafts",
                  body: "Every material risk arrives with a drafted response you can accept, edit, or skip — staged payments, capped revisions, a rewritten clause — written in your voice and ready to copy into your reply.",
                },
                {
                  icon: <ShieldCheck className="h-4 w-4 text-[var(--burgundy)]" />,
                  title: "Rules overrule the AI",
                  body: "Before any finding reaches you, it passes a deterministic check against rule packs built for your deal type — freelance, lease, partnership, employment, and more. Most teams have no playbook at all; yours ships inside the product. Where the model and the rules disagree, the rules win, and the report shows the reasoning it relied on.",
                },
                {
                  icon: <Bell className="h-4 w-4 text-[var(--burgundy)]" />,
                  title: "Sign here, stay guarded",
                  body: "You sign first, then the other side signs through a secure link — no account needed on their end. Renewals, notice windows, and obligations stay tracked, with email alerts before they matter.",
                },
              ].map((f) => (
                <div key={f.title} className="text-center sm:px-6">
                  <span className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-foreground/[0.04]">
                    {f.icon}
                  </span>
                  <h3 className="mt-3 text-[16px] font-semibold tracking-[-0.01em]">{f.title}</h3>
                  <p className="mx-auto mt-2 max-w-[42ch] text-[13px] leading-relaxed text-foreground/55">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Workspace + loop */}
        <section id="how-it-works" className="border-t border-border bg-muted/40">
          <div className="mx-auto max-w-[1280px] px-6 py-16 lg:px-8 lg:py-24">
            <h2 className="mx-auto max-w-[26ch] text-center text-[28px] font-semibold leading-tight tracking-[-0.03em] sm:text-[36px]">
              From their paper to your signature
            </h2>
            <p className="mx-auto mt-3 max-w-[58ch] text-center text-[14px] leading-relaxed text-foreground/55">
              Upload the contract, answer one clarifying question where something is missing, respond
              with drafted replies, sign, and stay covered — three stages in one place, designed for
              people who have never done this before.
            </p>
            {/* Steps: flat numbered list on hairlines — no cards. The loop
                note and CTA follow the list, centered. */}
            <ol aria-label="How Dealenz works" className="mx-auto mt-12 w-full max-w-3xl divide-y divide-border border-y border-border">
              {steps.map((s, i) => (
                <li key={s.n} className="flex items-baseline gap-5 py-7 sm:gap-8">
                  <span aria-hidden className="shrink-0 text-[13px] font-semibold tabular-nums text-foreground/30">
                    0{s.n}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-[19px] font-semibold tracking-[-0.01em] sm:text-[21px]">
                      {s.title}
                      <span className="ml-2.5 align-middle text-[12px] font-medium text-foreground/40">{s.tag}</span>
                    </h3>
                    <p className="mt-1.5 max-w-[62ch] text-[14px] leading-relaxed text-foreground/60">{s.body}</p>
                    {i === 1 && (
                      <p className="mt-2.5 inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--burgundy)]">
                        <RotateCcw className="h-3 w-3" />
                        They revise? Re-check before you sign
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-10 text-center">
              <h3 className="text-[24px] font-semibold leading-tight tracking-[-0.02em] sm:text-[30px]">
                The loop is the product
              </h3>
              <p className="mx-auto mt-3 max-w-[54ch] text-[14px] leading-relaxed text-foreground/60">
                Most tools stop at the report. Dealenz is built around what happens next: push
                back in your words, re-check their revision, sign, and stay guarded — every
                deal, same loop, nothing to learn.
              </p>
              <Link
                href="/register"
                className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-[var(--burgundy)] px-7 text-[14px] font-semibold text-white transition-opacity hover:opacity-90"
              >
                Analyze your first deal
                <ArrowRight className="h-4 w-4" />
              </Link>
              <p className="mt-3 text-[12px] text-foreground/40">Free to start. No credit card required.</p>
            </div>

            <div className="mx-auto mt-16 grid max-w-4xl gap-10 sm:grid-cols-2 sm:gap-8">
              <figure>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/40">Suggested response</p>
                <blockquote className="mt-3 border-l-2 border-[var(--burgundy)] pl-5 text-[19px] font-medium leading-snug tracking-[-0.01em]">
                  &ldquo;Please cap revisions at two rounds. Extra rounds will be billed at my standard rate.&rdquo;
                </blockquote>
                <figcaption className="mt-3 text-[11px] text-foreground/40">Illustrated example · from an unlimited-revisions finding</figcaption>
              </figure>
              <figure>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/40">Evidence</p>
                <p className="mt-3 text-[19px] font-semibold leading-snug tracking-[-0.01em]">Payment is due before you have leverage to enforce it.</p>
                <p className="mt-3 border-l-2 border-border pl-5 text-[13px] leading-relaxed text-foreground/60">
                  Clause 4.2: full payment on signing, delivery within 60 days.
                </p>
                <figcaption className="mt-3 text-[11px] text-foreground/40">Illustrated example · deterministic rule, quoted source</figcaption>
              </figure>
            </div>
          </div>
        </section>

        {/* A look inside — crafted product shots in browser frames, the way
            established startups present the product before asking for signup. */}
        <section className="border-t border-border bg-card">
          <div className="mx-auto max-w-[1280px] px-6 py-16 lg:px-8 lg:py-24">
            <p className="text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground/40">A look inside</p>
            <h2 className="mx-auto mt-3 max-w-[26ch] text-center text-[28px] font-semibold leading-tight tracking-[-0.03em] sm:text-[36px]">
              The product, before you create an account
            </h2>
            <p className="mx-auto mt-3 max-w-[56ch] text-center text-[14px] leading-relaxed text-foreground/55">
              These are faithful illustrations of the two screens you will spend your time on:
              the risk report that quotes every clause, and the signing view your counterparty sees.
            </p>
            <div className="mx-auto mt-12 grid max-w-5xl gap-8 lg:grid-cols-2">
              <div>
                <ProductShot url="app.dealenz.site/report" label="Illustrated risk report showing quoted findings with severity levels">
                  <p className="text-[13px] font-semibold">Freelance Agreement — Risk report</p>
                  <p className="mt-1 text-[12px] text-foreground/50">Score 62 · 4 findings need attention</p>
                  <ul className="mt-4 divide-y divide-border border-y border-border">
                    <li className="py-3">
                      <p className="flex items-center gap-2 text-[13px] font-semibold">
                        <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-700">High</span>
                        Unlimited revisions, fixed price
                      </p>
                      <p className="mt-1 text-[12px] text-foreground/55">&ldquo;Contractor shall perform unlimited revisions…&rdquo; — Clause 3.1</p>
                    </li>
                    <li className="py-3">
                      <p className="flex items-center gap-2 text-[13px] font-semibold">
                        <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">Medium</span>
                        Payment on signing, delivery in 60 days
                      </p>
                      <p className="mt-1 text-[12px] text-foreground/55">&ldquo;Full payment due upon execution…&rdquo; — Clause 4.2</p>
                    </li>
                    <li className="py-3">
                      <p className="flex items-center gap-2 text-[13px] font-semibold">
                        <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">Medium</span>
                        Termination without notice
                      </p>
                      <p className="mt-1 text-[12px] text-foreground/55">&ldquo;Either party may terminate at will…&rdquo; — Clause 9.3</p>
                    </li>
                  </ul>
                  <p className="mt-3 text-[12px] font-medium text-[var(--burgundy)]">Negotiation drafts ready for each finding →</p>
                </ProductShot>
                <p className="mt-2 text-[11px] text-foreground/40">Illustrated example · the risk report</p>
              </div>
              <div>
                <ProductShot url="app.dealenz.site/sign" label="Illustrated signing view showing owner signature and renewal tracking">
                  <p className="text-[13px] font-semibold">MSA with Acme — Signing</p>
                  <p className="mt-1 text-[12px] text-foreground/50">Version 2 · locked after all signatures</p>
                  <ul className="mt-4 divide-y divide-border border-y border-border">
                    <li className="flex items-center gap-2.5 py-3">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold">You signed · May 12</p>
                        <p className="text-[12px] text-foreground/50">Owner signature recorded</p>
                      </div>
                    </li>
                    <li className="flex items-center gap-2.5 py-3">
                      <Clock className="h-4 w-4 shrink-0 text-amber-700" />
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold">Counterparty invited</p>
                        <p className="text-[12px] text-foreground/50">Secure link sent · no account needed</p>
                      </div>
                    </li>
                    <li className="flex items-center gap-2.5 py-3">
                      <Bell className="h-4 w-4 shrink-0 text-[var(--burgundy)]" />
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold">Renewal tracked · Jun 2</p>
                        <p className="text-[12px] text-foreground/50">Alert scheduled 21 days before</p>
                      </div>
                    </li>
                  </ul>
                  <p className="mt-3 text-[12px] font-medium text-[var(--burgundy)]">Deadlines stay tracked after signing →</p>
                </ProductShot>
                <p className="mt-2 text-[11px] text-foreground/40">Illustrated example · signing and tracking</p>
              </div>
            </div>
          </div>
        </section>

        {/* In-view deal tracking */}
        <section className="border-t border-border bg-card">
          <div className="mx-auto max-w-[1280px] px-6 py-16 lg:px-8 lg:py-24">
            <div className="grid items-center gap-10 lg:grid-cols-2">
              <div>
                <div className="flex gap-2">
                  {["Flagged", "Response", "Tracked"].map((t, i) => (
                    <span
                      key={t}
                      className={`rounded-full px-4 py-1.5 text-[12px] font-medium ${
                        i === 0 ? "bg-primary text-primary-foreground" : "border border-border text-foreground/55"
                      }`}
                    >
                      {t}
                    </span>
                  ))}
                </div>
                <h2 className="mt-5 max-w-[22ch] text-[28px] font-semibold leading-tight tracking-[-0.03em] sm:text-[34px]">
                  The whole deal in view, from first flag to final signature
                </h2>
                <p className="mt-3 max-w-[48ch] text-[14px] leading-relaxed text-foreground/55">
                  Flags, drafted replies, signatures, and deadlines live on one timeline, so nothing
                  slips between the report you read and the handshake you make.
                </p>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href="/register"
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[var(--burgundy)] px-7 text-[14px] font-semibold text-white transition-opacity hover:opacity-90"
                  >
                    Get started free
                  </Link>
                  <Link
                    href="/#pricing"
                    className="inline-flex h-11 items-center justify-center rounded-full border border-border px-7 text-[14px] font-medium transition-colors hover:bg-foreground/[0.03]"
                  >
                    See pricing
                  </Link>
                </div>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground/40">Live example</p>
                <ul className="mt-4 divide-y divide-border border-y border-border">
                  <li className="flex items-center gap-3 py-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--burgundy)] text-[11px] font-bold text-white">AK</span>
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-semibold">Protection package ready</p>
                      <p className="truncate text-[12px] text-foreground/50">Revised clause 4.2 is ready to send.</p>
                    </div>
                  </li>
                  <li className="flex items-center gap-3 py-4">
                    <CircleAlert className="h-4 w-4 shrink-0 text-amber-700" />
                    <p className="text-[14px]">Renewal in 21 days — alert scheduled</p>
                  </li>
                  <li className="flex items-center gap-3 py-4">
                    <Mail className="h-4 w-4 shrink-0 text-[var(--burgundy)]" />
                    <p className="text-[14px]">Signed by both sides — document locked</p>
                  </li>
                </ul>
                <p className="pt-2 text-[11px] text-foreground/40">Illustrated example · signing and monitoring</p>
              </div>
            </div>
          </div>
        </section>

        {/* Trio */}
        <section className="border-t border-border bg-muted/40">
          <div className="mx-auto max-w-[1280px] px-6 py-16 lg:px-8 lg:py-24">
            <h2 className="mx-auto max-w-[24ch] text-center text-[28px] font-semibold leading-tight tracking-[-0.03em] sm:text-[36px]">
              From redline to signature without leaving
            </h2>
            <div className="mt-12 grid gap-10 sm:grid-cols-3 sm:gap-8">
              {[
                {
                  icon: <Upload className="h-4 w-4 text-[var(--burgundy)]" />,
                  title: "Drop in anything",
                  body: "Paste text or upload the file they sent — PDF, Word, or scan. Analysis starts immediately, for 5 credits.",
                },
                {
                  icon: <Scale className="h-4 w-4 text-[var(--burgundy)]" />,
                  title: "Re-check the redline",
                  body: "Past back their revised version and see what actually changed: what got fixed, what got worse, what is still open.",
                },
                {
                  icon: <Mail className="h-4 w-4 text-[var(--burgundy)]" />,
                  title: "Never miss a date",
                  body: "Connect Gmail once. Renewals, notice windows, and payment obligations surface as email alerts before they matter.",
                },
              ].map((f) => (
                <div key={f.title}>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground/[0.04]">
                    {f.icon}
                  </span>
                  <h3 className="mt-3 text-[16px] font-semibold tracking-[-0.01em]">{f.title}</h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-foreground/55">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Workflow integrations */}
        <section className="border-t border-border bg-card">
          <div className="mx-auto max-w-[1280px] px-6 py-16 lg:px-8 lg:py-24">
            <div className="grid items-center gap-10 lg:grid-cols-2">
              <div>
                <h2 className="max-w-[20ch] text-[28px] font-semibold leading-tight tracking-[-0.03em] sm:text-[34px]">
                  Plays well with how you already work
                </h2>
                <p className="mt-3 max-w-[48ch] text-[14px] leading-relaxed text-foreground/55">
                  There is no new platform to adopt. Dealenz works inside the channels the deal
                  already moves through — your inbox for alerts, a secure link for their signature,
                  and a clean handoff file for your lawyer.
                </p>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href="/register"
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[var(--burgundy)] px-7 text-[14px] font-semibold text-white transition-opacity hover:opacity-90"
                  >
                    Get started free
                  </Link>
                </div>
              </div>
              <ul className="divide-y divide-border border-y border-border">
                {[
                  {
                    icon: <Mail className="h-4 w-4 text-[var(--burgundy)]" />,
                    name: "Gmail",
                    body: "Deadline alerts land in your inbox before they matter. Connect once, in Settings.",
                  },
                  {
                    icon: <PenLine className="h-4 w-4 text-[var(--burgundy)]" />,
                    name: "Counterparty signing link",
                    body: "The other side signs through a secure link — no account needed on their end.",
                  },
                ].map((r) => (
                  <li key={r.name} className="flex items-start gap-3.5 py-5">
                    <span className="mt-0.5 shrink-0">
                      {r.icon}
                    </span>
                    <div>
                      <p className="text-[14px] font-semibold">{r.name}</p>
                      <p className="mt-0.5 text-[13px] leading-relaxed text-foreground/55">{r.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Private by design */}
        <section id="privacy" className="border-t border-border bg-card">
          <div className="mx-auto max-w-[1280px] px-6 py-16 lg:px-8 lg:py-24">
            <h2 className="mx-auto max-w-[24ch] text-center text-[28px] font-semibold leading-tight tracking-[-0.03em] sm:text-[36px]">
              Sensitive paper deserves more than a promise
            </h2>
            <p className="mx-auto mt-3 max-w-[52ch] text-center text-[14px] leading-relaxed text-foreground/55">
              Contracts carry other people&apos;s names, numbers, and money. Dealenz gives you
              control over every copy — before, during, and after the work.
            </p>
            <div className="mt-12 grid gap-10 sm:grid-cols-2 sm:gap-8 lg:grid-cols-4">
              {[
                {
                  icon: <EyeOff className="h-4 w-4 text-[var(--burgundy)]" />,
                  title: "Mask before sending",
                  body: "Emails, phone numbers, and your own terms are found in your browser for your review — nothing is masked silently, and masked deals simply analyze less precisely.",
                },
                {
                  icon: <Trash2 className="h-4 w-4 text-[var(--burgundy)]" />,
                  title: "Delete any deal",
                  body: "Remove a single sensitive deal — files, threads, documents, monitoring — from your dashboard, without touching the rest.",
                },
                {
                  icon: <Download className="h-4 w-4 text-[var(--burgundy)]" />,
                  title: "Take it all with you",
                  body: "Download everything Dealenz holds about you as one file, any time, from Settings.",
                },
                {
                  icon: <Unlink className="h-4 w-4 text-[var(--burgundy)]" />,
                  title: "Revoke any link",
                  body: "Every shared view and report link lives in one place with its expiry — kill any of them in one tap.",
                },
              ].map((f) => (
                <div key={f.title}>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground/[0.04]">
                    {f.icon}
                  </span>
                  <h3 className="mt-3 text-[16px] font-semibold tracking-[-0.01em]">{f.title}</h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-foreground/55">{f.body}</p>
                </div>
              ))}
            </div>
            <p className="mx-auto mt-8 max-w-[62ch] text-center text-[13px] leading-relaxed text-foreground/55">
              Your data lives in the EU, there are no advertising trackers, and deleting your
              account erases your deals, documents, and files (billing records and provider
              backups age out separately).{" "}
              <Link href="/privacy" className="font-medium text-foreground underline decoration-foreground/20 underline-offset-4 hover:decoration-foreground/40">
                Read the privacy policy
              </Link>
            </p>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="border-t border-border bg-muted/40">
          <div className="mx-auto max-w-5xl px-6 py-16 lg:py-24">
            <div className="text-center">
              <h2 className="text-[28px] font-semibold tracking-[-0.03em] sm:text-[36px]">
                Pay per deal outcome. Nothing else.
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-[14px] text-foreground/55">
                There are no subscriptions, no tiers, and no feature gates. Every account starts
                with 10 signup credits, and every analysis after that costs 5 credits.
              </p>
            </div>
            <ul className="mx-auto mt-12 max-w-3xl divide-y divide-border border-y border-border">
              <li className="flex flex-wrap items-baseline gap-x-6 gap-y-1 py-6">
                <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-foreground/40">Free</p>
                <p className="text-4xl font-semibold tracking-tight">$0</p>
                <p className="w-full text-[13px] text-foreground/60">10 signup credits — first two analyses free. All four document types on freelance deals.</p>
                <Link href="/register" className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:text-foreground">
                  Get started free
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </li>
              {CREDIT_PACKAGES.filter((p) => p.active).map((p) => (
                <li key={p.id} className="flex flex-wrap items-baseline gap-x-6 gap-y-1 py-6">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-foreground/40">{p.credits} credits</p>
                  <p className="text-4xl font-semibold tracking-tight">{formatPrice(p.prices.USD, "USD")}</p>
                  <p className="w-full text-[13px] text-foreground/60">
                    {p.id === "starter" ? "Enough for a deal or two, start to finish" : p.id === "standard" ? "Enough for a busy month of reviews" : "Enough for steady deal flow across your pipeline"}
                    {" · "}{packageValueLines(p.credits).join(" · ")}
                    {" · "}One-time top-up. No subscription.
                  </p>
                  <Link href="/register" className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--burgundy)] transition-opacity hover:opacity-80">
                    Buy {p.credits} credits
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-center text-[12px] text-foreground/45">Prices in USD, plus tax at checkout. An account is required before purchase.</p>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="border-t border-border bg-card">
          <div className="mx-auto max-w-[680px] px-6 py-16 lg:py-24">
            <h2 className="text-center text-[28px] font-semibold tracking-[-0.03em] sm:text-[36px]">
              Common questions
            </h2>
            <div className="mt-10 divide-y divide-border border-y border-border">
              {faqs.map((faq) => (
                <details
                  key={faq.q}
                  className="group py-5"
                >
                  <summary className="cursor-pointer list-none text-[15px] font-semibold [&::-webkit-details-marker]:hidden">
                    <span className="flex items-center justify-between gap-4">
                      {faq.q}
                      <span className="text-foreground/30 transition-transform duration-300 group-open:rotate-45">+</span>
                    </span>
                  </summary>
                  <p className="mt-2.5 max-w-[62ch] text-[14px] leading-relaxed text-foreground/60">{faq.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA — full-bleed flat band, square edges, no card. */}
        <section className="bg-[var(--burgundy)] px-6 py-16 text-center text-white lg:px-8 lg:py-20">
          <div className="mx-auto max-w-[1280px]">
            <h2 className="mx-auto max-w-[20ch] text-[30px] font-semibold leading-[1.05] tracking-[-0.03em] sm:text-[42px]">
              Upload your next contract.
            </h2>
            <p className="mx-auto mt-3 max-w-[52ch] text-[15px] text-white/70">
              You do not need to know where to start. Upload the paper you received, and see
              what it means, what to change, and what to sign.
            </p>
            <div className="mt-8">
              <Link
                href="/register"
                className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-8 text-[15px] font-semibold text-[var(--burgundy)] transition-colors hover:bg-white/90"
              >
                Get started free
                <ArrowRight className="h-4 w-4" />
              </Link>
              <p className="mt-3 text-[12px] text-white/60">Free to start. No credit card required.</p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-[#141110] text-white">
        <div className="mx-auto max-w-[1280px] px-6 pt-16 lg:px-8">
          <div className="grid gap-10 border-b border-white/10 pb-12 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr_1fr]">
            <div>
              <LogoMark dark />
              <p className="mt-4 max-w-xs text-[13px] leading-relaxed text-white/60">
                Contract analysis, drafting, and signing for people who receive paper.
              </p>
            </div>
            <nav aria-label="Product">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-foreground/40">Product</p>
              <ul className="mt-4 space-y-2.5 text-[13px]">
                <li><Link href="/#how-it-works" className="text-white/70 transition-colors hover:text-white">How it works</Link></li>
                <li><Link href="/#features" className="text-white/70 transition-colors hover:text-white">Features</Link></li>
                <li><Link href="/#pricing" className="text-white/70 transition-colors hover:text-white">Pricing</Link></li>
                <li><Link href="/register" className="text-white/70 transition-colors hover:text-white">Analyze your deal</Link></li>
              </ul>
            </nav>
            <nav aria-label="Company">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-foreground/40">Company</p>
              <ul className="mt-4 space-y-2.5 text-[13px]">
                <li><a href="mailto:dealenz.help@gmail.com" className="text-white/70 transition-colors hover:text-white">Contact</a></li>
                <li><Link href="/help" className="text-white/70 transition-colors hover:text-white">Help center</Link></li>
                <li><Link href="/methodology" className="text-white/70 transition-colors hover:text-white">Our method</Link></li>
              </ul>
            </nav>
            <nav aria-label="Resources">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-foreground/40">Resources</p>
              <ul className="mt-4 space-y-2.5 text-[13px]">
                <li><Link href="/register" className="text-white/70 transition-colors hover:text-white">Get started</Link></li>
                <li><Link href="/login" className="text-white/70 transition-colors hover:text-white">Sign in</Link></li>
              </ul>
            </nav>
            <nav aria-label="Legal">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-foreground/40">Legal</p>
              <ul className="mt-4 space-y-2.5 text-[13px]">
                <li><Link href="/privacy" className="text-white/70 transition-colors hover:text-white">Privacy</Link></li>
                <li><Link href="/terms" className="text-white/70 transition-colors hover:text-white">Terms</Link></li>
              </ul>
            </nav>
          </div>
          <div className="py-6">
            <p className="max-w-3xl text-[12px] leading-relaxed text-primary-foreground/40">
              Dealenz generates AI-assisted recommendations and document drafts. These are not
              legal services or legal advice. Review important agreements with a qualified
              professional.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[12px] text-primary-foreground/40">© 2026 Dealenz. Know what&apos;s in your contracts.</p>
              <p className="text-[12px] text-primary-foreground/40">
                Questions? <a href="mailto:dealenz.help@gmail.com" className="underline underline-offset-2 transition-colors hover:text-white">dealenz.help@gmail.com</a>
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
