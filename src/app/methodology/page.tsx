import Link from "next/link"

export const metadata = {
  title: "How Dealenz checks its work — methodology",
  description:
    "The review pipeline behind every Dealenz report: extraction, deterministic rules, quoted evidence, abstention, and where human judgment takes over.",
}

const steps = [
  {
    n: "01",
    title: "Read everything",
    body: "Your contract text or file is extracted in full — every clause, not a summary. Nothing is skipped to save computation, and what cannot be read is reported as unread, never filled in.",
  },
  {
    n: "02",
    title: "Check against the rule packs",
    body: "Findings pass a deterministic check against rule packs built for your deal type — freelance, lease, partnership, employment, founder, purchase, and MSA terms. These packs ship inside the product, so you never have to write a playbook to get a governed review.",
  },
  {
    n: "03",
    title: "Quote the evidence",
    body: "Every finding carries the exact clause it came from. You can verify each one yourself against your paper, which is the entire point: trust comes from checkability, not from our confidence.",
  },
  {
    n: "04",
    title: "Say unknown",
    body: "Where the evidence does not support a conclusion, the report says unknown. An inconclusive answer is a correct answer; a confident guess is a defect, and the pipeline treats it as one.",
  },
  {
    n: "05",
    title: "Hand over judgment",
    body: "Drafted replies arrive as proposals to accept, edit, or skip — never instructions. For high-value contracts or anything genuinely complex, the report points you to a qualified lawyer, and the handoff file carries the findings with it.",
  },
]

const label: Array<[string, string]> = [
  ["Models", "Third-party frontier models through private endpoints. We operate no training runs on customer data, and providers are contractually barred from training on it."],
  ["Training data", "Never yours. Rule packs are built by our team from contract practice, not from customer documents."],
  ["Guardrails", "Deterministic rule checks dispose; model output proposes. Validation rejects empty, multi-question, and unevidenced answers before delivery, with at most one repair attempt."],
  ["Human control", "Every draft is accept, edit, or skip. Every signing needs a human hand. High-stakes matters route to your lawyer, not to more computation."],
  ["Scores", "We publish this method, not an accuracy percentage. Published percentages grade vendors' own checklists under their own grading; what you can hold us to is stronger — every claim quoted, every unknown admitted."],
]

export default function MethodologyPage() {
  return (
    <div className="min-h-screen bg-card text-foreground">
      <main className="mx-auto max-w-3xl px-6 py-16 lg:py-24">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground/40">Methodology</p>
        <h1 className="mt-3 max-w-[24ch] text-[32px] font-semibold leading-tight tracking-[-0.03em] sm:text-[44px]">
          How Dealenz checks its work
        </h1>
        <p className="mt-5 max-w-[62ch] text-[15px] leading-relaxed text-foreground/60">
          This page describes the review pipeline behind every report: what the software does,
          what constrains it, and where it stops and hands judgment to you. It is a description
          of machinery, not a marketing claim — every statement here maps to code you could audit.
        </p>

        <ol className="mt-12 divide-y divide-border border-y border-border">
          {steps.map((s) => (
            <li key={s.n} className="flex items-baseline gap-5 py-7 sm:gap-8">
              <span aria-hidden className="shrink-0 text-[13px] font-semibold tabular-nums text-foreground/30">
                {s.n}
              </span>
              <div className="min-w-0">
                <h2 className="text-[19px] font-semibold tracking-[-0.01em] sm:text-[21px]">{s.title}</h2>
                <p className="mt-1.5 max-w-[62ch] text-[14px] leading-relaxed text-foreground/60">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <h2 className="mt-16 text-[24px] font-semibold tracking-[-0.02em] sm:text-[28px]">AI nutrition label</h2>
        <p className="mt-3 max-w-[62ch] text-[14px] leading-relaxed text-foreground/60">
          The facts a careful buyer asks for, in one place. If any row changes materially, this page changes with it.
        </p>
        <dl className="mt-8 divide-y divide-border border-y border-border">
          {label.map(([term, def]) => (
            <div key={term} className="grid gap-1 py-5 sm:grid-cols-[180px_1fr] sm:gap-6">
              <dt className="text-[14px] font-semibold">{term}</dt>
              <dd className="max-w-[62ch] text-[14px] leading-relaxed text-foreground/60">{def}</dd>
            </div>
          ))}
        </dl>

        <p className="mt-10 max-w-[62ch] text-[13px] leading-relaxed text-foreground/55">
          Dealenz generates AI-assisted recommendations and document drafts. These are not legal
          services or legal advice. Review important agreements with a qualified professional.{" "}
          <Link href="/privacy" className="font-medium text-foreground underline decoration-foreground/20 underline-offset-4 hover:decoration-foreground/40">
            Privacy policy
          </Link>
        </p>
      </main>
    </div>
  )
}
