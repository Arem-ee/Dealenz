import Link from "next/link"

export const metadata = {
  title: "Terms",
}

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          Back to Dealenz
        </Link>
        <h1 className="mt-8 text-3xl font-semibold">Terms</h1>
        <div className="mt-6 space-y-5 text-sm leading-7 text-muted-foreground">
          <p>
            Dealenz is an audit and document drafting tool for anyone reviewing an agreement. It helps identify risk and generate working drafts where that is the right next step for the deal you are looking at.
          </p>
          <p>
            Dealenz does not provide legal advice, does not replace professional legal review, and does not guarantee client payment, signature, or project outcome.
          </p>
          <p>
            Dealenz is free to start: new accounts receive 10 credits and a daily analysis allowance. Deeper work — analyses, answers, drafts, uploads, signature sends, lawyer requests — consumes credits, which can be topped up in credit packs inside the app. Failed operations do not consume credits. If a purchase does not land in your balance, write to support and it will be put right.
          </p>
          <p>
            You are responsible for reviewing all generated documents before sending them to clients and for confirming that your use of Dealenz complies with your client agreements and applicable obligations.
          </p>
          <p>
            Do not use Dealenz to upload material you do not have permission to process or share, to send bulk unsolicited messages, or for anything unlawful. Accounts used for abuse may be suspended.
          </p>
          <p>
            To the extent permitted by law, Dealenz liability is limited to the fees you paid in the twelve months before the claim. These terms may change as the product evolves; continued use after a change means you accept the updated terms.
          </p>
        </div>
      </div>
    </main>
  )
}
