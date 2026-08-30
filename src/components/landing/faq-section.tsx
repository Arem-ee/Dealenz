import { SectionWrapper, BodyText } from "@/components/landing/primitives"

const faqs = [
  {
    q: "What file types can I use?",
    a: "PDF, DOCX, and TXT files, plus pasted text or a guided form.",
  },
  {
    q: "Does Dealenz give legal advice?",
    a: "No. Dealenz identifies business risk and drafts practical documents. You should review contracts with your lawyer before signing.",
  },
  {
    q: "Can clients sign documents?",
    a: "Yes. Generated documents include a secure link. Clients read and accept in their browser. The signature is recorded in the audit timeline.",
  },
  {
    q: "Is my data used to train AI models?",
    a: "No. Your deal data stays in your account and is never used to train or fine-tune models.",
  },
  {
    q: "What happens if the AI misses something?",
    a: "The risk report shows you what it found and why. You review everything before sending documents. The final call is yours.",
  },
  {
    q: "Can I export documents?",
    a: "Yes. You can export any generated document as PDF at any time.",
  },
]

export function FAQSection() {
  return (
    <SectionWrapper width="medium" className="py-16 sm:py-24">
      <div className="space-y-8">
        {faqs.map((faq) => (
          <div key={faq.q}>
            <p className="text-sm font-semibold">{faq.q}</p>
            <BodyText muted className="mt-1">{faq.a}</BodyText>
          </div>
        ))}
      </div>
    </SectionWrapper>
  )
}
