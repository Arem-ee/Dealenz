import Link from "next/link"
import Image from "next/image"
import { CREDIT_PACKAGES, formatPrice, packageValueLines } from "@/lib/billing/catalog"
import {
  ArrowRight,
  Bell,
  CircleAlert,
  Download,
  EyeOff,
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
  title: "Dealenz — AI contract review that tells you what to push back on",
  description:
    "Upload their contract. See every risk with its clause, get the exact words to push back, sign, and stay guarded. Built for founders, freelancers, and anyone signing what they didn't write.",
}

const steps = [
  {
    n: "1",
    title: "Upload it",
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
    a: "No. Dealenz helps you catch problems before they become legal problems. For high value contracts or anything complex, have a lawyer review the final document.",
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
    q: "What happens to my contract data?",
    a: "It stays yours. Mask emails, phone numbers, and your own terms before sending — detection runs in your browser and you review every item. Delete any single deal from your dashboard, download everything from Settings, and revoke any shared link at any time. Your database lives in the EU, there are no advertising trackers, and deleting your account erases your deals, documents, and files — billing records and provider backups age out separately.",
  },
  {
    q: "Is the free tier a trial?",
    a: "There is no trial because there is nothing to gate: 10 signup credits, enough for your first two analyses. No credit card required to start.",
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

function OrbitChip({ className, label, children }: { className?: string; label: string; children: React.ReactNode }) {
  return (
    <div
      title={label}
      aria-hidden
      className={`absolute flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-card shadow-[0_12px_32px_-12px_rgba(0,0,0,0.25)] ${className ?? ""}`}
    >
      {children}
    </div>
  )
}

export default function Home() {
  return (
    <div className="light min-h-screen bg-card text-foreground selection:bg-primary selection:text-primary-foreground">
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
          <div className="flex items-center gap-3">
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
            <h1 className="mx-auto mt-5 max-w-[20ch] text-[40px] font-semibold leading-[1.04] tracking-[-0.04em] sm:text-[54px] lg:text-[64px]">
              Know the risk. Get the words to push back.
            </h1>
            <p className="mx-auto mt-5 max-w-[56ch] text-[15px] leading-relaxed text-foreground/60 lg:text-[16px]">
              Upload their contract. See every risk with its clause. Get the
              exact words to push back. Sign and stay guarded.
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
                className="inline-flex h-11 items-center rounded-full border border-border bg-card px-7 text-[14px] font-medium transition-colors hover:bg-foreground/[0.03]"
              >
                See how it works
              </Link>
            </div>

            {/* Orbit visual */}
            <div className="relative mx-auto mt-6 h-[440px] max-w-[760px] sm:h-[480px]" aria-hidden>
              <div className="absolute left-1/2 top-1/2 h-[280px] w-[280px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-border sm:h-[320px] sm:w-[320px]" />
              <div className="absolute left-1/2 top-1/2 h-[440px] w-[440px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-border sm:h-[500px] sm:w-[500px]" />
              <div className="absolute left-1/2 top-1/2 hidden h-[680px] w-[680px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-border md:block" />
              <OrbitChip label="Contract" className="left-[8%] top-[16%]">
                <FileText className="h-4 w-4 text-[var(--burgundy)]" />
              </OrbitChip>
              <OrbitChip label="Review" className="right-[10%] top-[12%]">
                <Search className="h-4 w-4 text-amber-600" />
              </OrbitChip>
              <OrbitChip label="Fair terms" className="left-[2%] top-[52%]">
                <Scale className="h-4 w-4 text-emerald-600" />
              </OrbitChip>
              <OrbitChip label="Alerts" className="right-[3%] top-[48%]">
                <Bell className="h-4 w-4 text-sky-600" />
              </OrbitChip>
              <OrbitChip label="Upload" className="bottom-[10%] left-[16%]">
                <Upload className="h-4 w-4 text-violet-600" />
              </OrbitChip>
              <OrbitChip label="Signature" className="bottom-[12%] right-[16%]">
                <PenLine className="h-4 w-4 text-rose-600" />
              </OrbitChip>
              <OrbitChip label="Monitoring" className="bottom-[2%] left-1/2 hidden -translate-x-1/2 sm:flex">
                <Mail className="h-4 w-4 text-orange-500" />
              </OrbitChip>

              {/* Center notification stack */}
              <div className="absolute left-1/2 top-1/2 w-[300px] -translate-x-1/2 -translate-y-1/2 space-y-2.5 text-left sm:w-[330px]">
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
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/40">Words to send</p>
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
            <p className="text-center text-[12px] text-foreground/40">Built for the people who receive the paper</p>
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
                  body: "Findings quote the exact language they came from. What the model cannot support, it says unknown — never a confident guess.",
                },
                {
                  icon: <PenLine className="h-4 w-4 text-[var(--burgundy)]" />,
                  title: "Words you can actually send",
                  body: "Every real risk comes with sendable language — staged payments, capped revisions, a revised clause. Copy it straight from the report.",
                },
                {
                  icon: <ShieldCheck className="h-4 w-4 text-[var(--burgundy)]" />,
                  title: "Rules overrule the AI",
                  body: "Each finding passes a deterministic rule check before it reaches you. If the AI and the rules disagree, the rules win.",
                },
                {
                  icon: <Bell className="h-4 w-4 text-[var(--burgundy)]" />,
                  title: "Sign here, stay guarded",
                  body: "Both sides sign in one workspace. Renewals, notice windows, and obligations stay tracked, with email alerts before they matter.",
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
            <p className="mx-auto mt-3 max-w-[54ch] text-center text-[14px] leading-relaxed text-foreground/55">
              Upload the contract, push back with the right words, sign, and stay
              guarded — three steps, one place, nothing to learn.
            </p>
            {/* Connected stepper: the process drawn as motion, not cards.
                Desktop shows three nodes joined by arrows with a loop-back
                for the re-check (push back → they revise → re-check is a real
                cycle, and the differentiator). Mobile collapses to a vertical
                timeline with the same spine — no fake geometry. */}
            <div className="mt-10 hidden md:block" aria-label="How Dealenz works">
              <ol className="grid grid-cols-3 items-stretch gap-0">
                {steps.map((s, i) => (
                  <li key={s.n} className="relative flex">
                    <div className="flex-1 px-2 text-center">
                      <span
                        className={`mx-auto flex h-10 w-10 items-center justify-center rounded-full text-[15px] font-bold ${
                          i === 1 ? "bg-[var(--burgundy)] text-white" : "border border-border bg-card text-foreground"
                        }`}
                      >
                        {s.n}
                      </span>
                      <h3 className="mt-4 text-[17px] font-semibold tracking-[-0.01em]">{s.title}</h3>
                      <p className="mx-auto mt-2 max-w-[32ch] text-[13px] leading-relaxed text-foreground/60">{s.body}</p>
                    </div>
                    {i < steps.length - 1 && (
                      <ArrowRight aria-hidden className="absolute -right-3 top-4 h-5 w-5 text-foreground/30" />
                    )}
                  </li>
                ))}
              </ol>
              <div className="relative mt-2 h-16" aria-hidden>
                <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 16" preserveAspectRatio="none">
                  <defs>
                    <marker id="recheck-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                      <path d="M0,0 L6,3 L0,6 Z" fill="var(--burgundy)" />
                    </marker>
                  </defs>
                  <path
                    d="M 50,1 C 42,15 24,15 17,2"
                    fill="none"
                    stroke="var(--burgundy)"
                    strokeOpacity="0.55"
                    strokeWidth="0.6"
                    strokeDasharray="2 1.4"
                    markerEnd="url(#recheck-arrow)"
                  />
                </svg>
                <p className="absolute inset-x-0 top-9 text-center text-[11px] font-medium text-[var(--burgundy)]">
                  They revise — re-check the redline before you sign
                </p>
              </div>
            </div>
            <ol className="mt-10 space-y-0 md:hidden" aria-label="How Dealenz works">
              {steps.map((s) => (
                <li key={s.n} className="relative flex gap-4 pb-8 pl-1 last:pb-0">
                  <span aria-hidden className="absolute bottom-0 left-[15px] top-9 w-px bg-border last:hidden" />
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-[13px] font-bold text-primary-foreground">
                    {s.n}
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <h3 className="text-[16px] font-semibold tracking-[-0.01em]">{s.title}</h3>
                    <p className="mt-1 text-[13px] leading-relaxed text-foreground/60">{s.body}</p>
                    {s.n === "2" && (
                      <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[var(--burgundy)]/10 px-3 py-1 text-[11px] font-medium text-[var(--burgundy)]">
                        <RotateCcw className="h-3 w-3" />
                        They revise? Re-check before you sign
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-[20px] border border-border bg-card p-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/40">Words to send</p>
                <p className="mt-2 text-[15px] leading-relaxed">&ldquo;Please cap revisions at two rounds. Extra rounds will be billed at my standard rate.&rdquo;</p>
                <p className="mt-2 text-[11px] text-foreground/40">Illustrated example · from an unlimited-revisions finding</p>
              </div>
              <div className="rounded-[20px] border border-border bg-primary p-5 text-primary-foreground">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary-foreground/50">Evidence</p>
                <p className="mt-2 text-[15px] font-semibold leading-snug">Payment is due before you have leverage to enforce it.</p>
                <p className="mt-3 rounded-xl bg-primary-foreground/[0.07] px-3.5 py-3 text-[12px] leading-relaxed text-primary-foreground/80">
                  Clause 4.2: full payment on signing, delivery within 60 days.
                </p>
                <p className="mt-2 text-[11px] text-primary-foreground/40">Illustrated example · deterministic rule, quoted source</p>
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
                  {["Flagged", "Pushback", "Guarded"].map((t, i) => (
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
                <h2 className="mt-5 max-w-[20ch] text-[28px] font-semibold leading-tight tracking-[-0.03em] sm:text-[34px]">
                  Move faster with the whole deal in view
                </h2>
                <p className="mt-3 max-w-[46ch] text-[14px] leading-relaxed text-foreground/55">
                  Flags, counter-words, signatures, and deadlines live on one
                  timeline. Nothing slips between the report and the handshake.
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
              <div className="space-y-2.5">
                <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-[0_16px_40px_-16px_rgba(0,0,0,0.2)]">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--burgundy)] text-[12px] font-bold text-white">AK</span>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold">Protection package ready</p>
                    <p className="truncate text-[12px] text-foreground/50">Revised clause 4.2 is ready to send.</p>
                  </div>
                </div>
                <div className="ml-8 flex items-center gap-2.5 rounded-2xl border border-border bg-card p-4 shadow-[0_16px_40px_-16px_rgba(0,0,0,0.2)]">
                  <CircleAlert className="h-4 w-4 shrink-0 text-amber-700" />
                  <p className="text-[13px]">Renewal in 21 days — alert scheduled</p>
                </div>
                <div className="ml-16 flex items-center gap-2.5 rounded-2xl border border-border bg-card p-4 shadow-[0_16px_40px_-16px_rgba(0,0,0,0.2)]">
                  <Mail className="h-4 w-4 shrink-0 text-[var(--burgundy)]" />
                  <p className="text-[13px]">Signed by both sides — document locked</p>
                </div>
                <p className="pl-16 pt-1 text-[11px] text-foreground/40">Illustrated example · signing and monitoring</p>
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
            <div className="mt-12 grid gap-8 sm:grid-cols-3">
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
                <div key={f.title} className="rounded-[20px] border border-border bg-card p-6">
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
                <p className="mt-3 max-w-[46ch] text-[14px] leading-relaxed text-foreground/55">
                  No new platform to live in. The tool meets the deal where it
                  already lives — your inbox, their signature, your lawyer.
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
              <ul className="space-y-3">
                {[
                  {
                    icon: <Mail className="h-4 w-4 text-white" />,
                    bg: "bg-[#EA4335]",
                    name: "Gmail",
                    body: "Deadline alerts land in your inbox before they matter. Connect once, in Settings.",
                  },
                  {
                    icon: <PenLine className="h-4 w-4 text-primary-foreground" />,
                    bg: "bg-primary",
                    name: "Counterparty signing link",
                    body: "The other side signs through a secure link — no account needed on their end.",
                  },
                ].map((r) => (
                  <li key={r.name} className="flex items-start gap-3.5 rounded-2xl border border-border bg-card p-4">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${r.bg}`}>
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
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
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
                <div key={f.title} className="rounded-[20px] border border-border bg-background p-6">
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
                No subscriptions, no tiers, no feature gates. 10 signup credits
                to start — every analysis after that costs 5 credits.
              </p>
            </div>
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-[20px] border border-border bg-card p-6 shadow-sm">
                <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-foreground/40">Free</p>
                <p className="mt-2 text-4xl font-semibold tracking-tight">$0</p>
                <ul className="mt-5 space-y-2 text-[13px] text-foreground/60">
                  <li>10 signup credits — first two analyses free</li>
                  <li>All four document types on freelance deals</li>
                </ul>
                <Link href="/register" className="mt-6 flex w-full items-center justify-center rounded-full border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-foreground/[0.03]">
                  Get started free
                </Link>
              </div>
              {CREDIT_PACKAGES.filter((p) => p.active).map((p) => (
                <div key={p.id} className="rounded-[20px] border border-border bg-card p-6 shadow-sm">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-foreground/40">{p.credits} credits</p>
                  <p className="mt-2 text-4xl font-semibold tracking-tight">{formatPrice(p.prices.USD, "USD")}</p>
                  <p className="mt-1 text-[13px] text-foreground/55">{p.id === "starter" ? "A deal or two" : p.id === "standard" ? "A busy month" : "Steady deal flow"}</p>
                  <ul className="mt-3 space-y-1 text-[12px] text-foreground/55">
                    {packageValueLines(p.credits).map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                  <p className="mt-4 text-[13px] text-foreground/60">One-time top-up. No subscription.</p>
                  <Link href="/register" className="mt-5 flex w-full items-center justify-center rounded-full bg-[var(--burgundy)] px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90">
                    Buy {p.credits} credits
                  </Link>
                </div>
              ))}
            </div>
            <p className="mt-4 text-center text-[12px] text-foreground/45">Prices in USD, plus tax at checkout. An account is required before purchase.</p>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="border-t border-border bg-card">
          <div className="mx-auto max-w-[680px] px-6 py-16 lg:py-24">
            <h2 className="text-center text-[28px] font-semibold tracking-[-0.03em] sm:text-[36px]">
              Common questions
            </h2>
            <div className="mt-10 space-y-3">
              {faqs.map((faq) => (
                <details
                  key={faq.q}
                  className="group rounded-[16px] border border-border bg-card p-5 shadow-sm transition-colors open:shadow-md"
                >
                  <summary className="cursor-pointer list-none text-[15px] font-semibold [&::-webkit-details-marker]:hidden">
                    <span className="flex items-center justify-between gap-4">
                      {faq.q}
                      <span className="text-foreground/30 transition-transform duration-300 group-open:rotate-45">+</span>
                    </span>
                  </summary>
                  <p className="mt-2.5 text-[14px] leading-relaxed text-foreground/60">{faq.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="bg-card px-6 pb-16 lg:px-8 lg:pb-24">
          <div className="mx-auto max-w-[1280px] rounded-[28px] bg-[var(--burgundy)] px-6 py-16 text-center text-white lg:py-20">
            <h2 className="mx-auto max-w-[20ch] text-[30px] font-semibold leading-[1.05] tracking-[-0.03em] sm:text-[42px]">
              Upload your next contract.
            </h2>
            <p className="mx-auto mt-3 max-w-[48ch] text-[15px] text-white/70">
              You do not need to know where to start. Upload the paper — leave with the pushback words.
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
                The counterparty-side loop for people who receive paper: what to
                push back on, in your words. Sign here. Stay guarded.
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
                <li><a href="mailto:support@dealenz.com" className="text-white/70 transition-colors hover:text-white">Contact</a></li>
              </ul>
            </nav>
            <nav aria-label="Resources">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-foreground/40">Resources</p>
              <ul className="mt-4 space-y-2.5 text-[13px]">
                <li><Link href="/help" className="text-white/70 transition-colors hover:text-white">Help center</Link></li>
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
              <p className="text-[12px] text-primary-foreground/40">© 2026 Dealenz</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
