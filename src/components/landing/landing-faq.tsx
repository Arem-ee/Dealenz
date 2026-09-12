const faqs = [
  {
    q: "What kinds of deals can Dealenz look at?",
    a: "Pretty much anything. Freelance contracts, leases, partnership agreements, purchase agreements, whatever you're actually dealing with. Dealenz looks at what's really in front of you instead of forcing it into some template that doesn't fit.",
  },
  {
    q: "Is this a replacement for a lawyer?",
    a: "No. Dealenz helps you catch problems before they become legal problems. For high-value contracts or anything complex, still have a lawyer review the final document. The AI disclaimer is in every contract for a reason.",
  },
  {
    q: "What AI does it use?",
    a: "Dealenz AI for analysis and document generation, with a rule-based engine that validates the output. Two layers, not one.",
  },
  {
    q: "What if it misses something?",
    a: "It will sometimes. The report tells you what it found and why, so you can judge whether it makes sense for your situation. That is why the documents say to review before use.",
  },
  {
    q: "Who can see my deals?",
    a: "Only you. Every deal is scoped to your account and is not used to train any model.",
  },
  {
    q: "What happens when a client signs?",
    a: "Their name, email, and the timestamp are recorded. The status updates in your workspace and an activity event is logged.",
  },
  {
    q: "Is the free tier a trial?",
    a: "No. It is the product with a daily limit. No credit card required to start.",
  },
]

export function LandingFAQ() {
  return (
    <section className="bg-white px-6 py-24 sm:py-32">
      <div className="mx-auto max-w-[680px]">
        <p className="text-3xl font-semibold tracking-tight text-[#1a0f0f] sm:text-4xl">Common questions.</p>
        <div className="mt-14 space-y-10">
          {faqs.map((faq) => (
            <div key={faq.q} className="rounded-xl border border-black/[0.04] bg-[#fdfaf7] p-5">
              <p className="text-base font-semibold text-[#1a0f0f]">{faq.q}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
