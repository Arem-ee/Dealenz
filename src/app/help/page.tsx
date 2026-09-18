import Link from "next/link"

export const metadata = {
  title: "Get help — Dealenz",
  description: "How to use Dealenz and where to get support.",
}

const FAQS = [
  {
    q: "What do I start with?",
    a: "Describe what you are working on in the chat box on Home — paste a contract, ask a question, or drop a file. Dealenz routes it: greetings get a free hello, questions get answers, deal content starts a thread.",
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
    a: "Ask for a lawyer review any time from chat by typing something like “get a lawyer on this”. Dealenz also suggests a review on its own, but only when a deal has both real stakes (meaningful value or a hard-to-reverse consequence like an ownership change) and a genuine exposure pattern (uncapped liability, a personal guarantee, unclear dispute terms on a valuable deal, or cross-border enforcement risk).",
  },
  {
    q: "What do credits pay for?",
    a: "Credits pay for computation (analysis, answers, drafts) — never for a favorable answer. Greetings are always free.",
  },
]

export default function HelpPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="text-xl font-semibold tracking-tight">Get help</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Plain answers about using Dealenz. Anything else — write to{" "}
        <span className="font-medium text-foreground">support@dealenz.com</span>.
      </p>
      <div className="mt-6 space-y-3">
        {FAQS.map((f) => (
          <div key={f.q} className="rounded-xl border bg-card p-4">
            <p className="text-sm font-medium">{f.q}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
          </div>
        ))}
      </div>
      <p className="mt-6 text-sm">
        <Link href="/dashboard" className="font-medium text-primary hover:underline">
          Back to Home
        </Link>
      </p>
    </div>
  )
}
