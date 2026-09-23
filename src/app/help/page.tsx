import Link from "next/link"

export const metadata = {
  title: "Get help — Dealenz",
  description: "How to use Dealenz and where to get support.",
}

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
    a: "From a thread with an analyzed deal you can generate drafts. Values Dealenz already knows are filled in and labeled by source; anything inferred needs your confirmation. You approve the final draft.",
  },
  {
    q: "How does signing work?",
    a: "Open a draft in the Document Reader, add your counterparty (name + email), sign as owner first, then send. Both sides sign their own link; when everyone has signed, the document is marked executed and locked.",
  },
  {
    q: "When should a lawyer review my deal?",
    a: "For high-stakes deals (meaningful value or a hard-to-reverse consequence like an ownership change, uncapped liability, a personal guarantee, unclear dispute terms, or cross-border enforcement risk), take the final document to a lawyer of your own. Dealenz is not a law firm and does not provide legal advice.",
  },
  {
    q: "What do credits pay for?",
    a: "Credits pay for deal outcomes: analyses (5 each), Ask answers (2/6/25 by size), documents (proposal 10, scope 15, contract 20, checklist 10), uploads (5), signature sends (10) — never for a favorable answer. Greetings are always free, and your 10 signup credits cover your first two analyses.",
  },
]

export default function HelpPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="text-xl font-semibold tracking-tight">Get help</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Plain answers about using Dealenz. Anything else — write to{" "}
        <a href="mailto:support@dealenz.com" className="font-medium text-foreground hover:underline">
          support@dealenz.com
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
        <Link href="/dashboard" className="font-medium text-primary hover:underline">
          Open the Dashboard
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
