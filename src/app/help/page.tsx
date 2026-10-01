import Link from "next/link"
import { Logo } from "@/components/logo"

export const metadata = {
  title: "Get help — Dealenz",
  description: "How to use Dealenz and where to get support.",
}

export const dynamic = "force-dynamic"

const FAQS = [
  {
    q: "What do I start with?",
    a: "Describe what you are working on in the chat box on your Dashboard — paste a contract, ask a question, or drop a file. Dealenz routes it: greetings get a free hello, questions get answers, deal content starts a thread.",
  },
  {
    q: "What does a risk report mean?",
    a: "Dealenz checks your deal against deterministic rules and shows what needs attention, why it matters, and what to clarify — with the exact evidence it observed. Unknown stays unknown; nothing is presented as legal certainty.",
  },
  {
    q: "How do documents work?",
    a: "From a thread with an analyzed deal you can generate drafts. Values Dealenz already knows are filled in and labeled by source; anything inferred needs your confirmation. You approve the final draft. If the paper already exists — written elsewhere, received by email — add it from Signing instead: no analysis, no credits, and it becomes signable as your own version.",
  },
  {
    q: "How does signing work?",
    a: "Open a draft in the Document Reader, add your counterparty (name + email), draw or type your signature and sign as owner first, then send. Both sides sign their own link — no account needed on their end — and each signature carries its image. When everyone has signed, the document is marked executed, sealed against later edits, and locked. Paper signed elsewhere can be recorded from Signing so it stays tracked here too.",
  },
  {
    q: "When should a lawyer review my deal?",
    a: "For high-stakes deals (meaningful value or a hard-to-reverse consequence like an ownership change, uncapped liability, a personal guarantee, unclear dispute terms, or cross-border enforcement risk), take the final document to a lawyer of your own. Dealenz is not a law firm and does not provide legal advice.",
  },
  {
    q: "What do credits pay for?",
    a: "Credits pay for deal outcomes: analyses (5 each), Ask answers (quick questions 1, longer ones 2/6/25 by length — the quote is a ceiling and concise answers settle lower), documents (proposal 10, scope 15, contract 20, checklist 10), uploads (5), signature sends (10) — never for a favorable answer. Greetings are always free, and your 10 signup credits cover your first two analyses.",
  },
  {
    q: "How does Dealenz check its work?",
    a: "Every finding passes a deterministic rule check against rule packs built for your deal type, carries the exact clause it came from, and says unknown where the evidence runs out. The full method — pipeline, guardrails, and where human judgment takes over — is published on the methodology page, not as an accuracy score.",
  },
]

export default async function HelpPage() {
  return (
    <div className="h-full min-h-0 overflow-y-auto bg-background">
      <header className="border-b border-border/60">
        <nav aria-label="Primary" className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <Link href="/" aria-label="Dealenz home">
            <Logo />
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/login" className="rounded-full px-3 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground">
              Sign in
            </Link>
            <Link href="/register" className="rounded-full bg-primary px-4 py-1.5 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90">
              Get started free
            </Link>
          </div>
        </nav>
      </header>
      <HelpContent />
    </div>
  )
}

function HelpContent() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="text-xl font-semibold tracking-tight">Get help</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Plain answers about using Dealenz. Anything else — write to{" "}
        <a href="mailto:dealenz.help@gmail.com" className="font-medium text-foreground hover:underline">
          dealenz.help@gmail.com
        </a>.
      </p>
      <div className="mt-6 space-y-3">
        {FAQS.map((f) => (
          <div key={f.q} className="rounded-xl border bg-card p-4">
            <p className="text-sm font-medium">{f.q}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <Link href="/" className="font-medium text-primary hover:underline">
          Back to home
        </Link>
        <Link href="/methodology" className="font-medium text-primary hover:underline">
          How Dealenz checks its work
        </Link>
        <Link href="/register" className="font-medium text-primary hover:underline">
          Create an account
        </Link>
        <Link href="/#pricing" className="font-medium text-primary hover:underline">
          See credit prices
        </Link>
      </div>
    </div>
  )
}
