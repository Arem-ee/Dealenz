import Link from "next/link"

export const metadata = {
  title: "Terms",
}

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="pt-2 text-base font-semibold text-foreground">{children}</h2>
}

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          Back to Dealenz
        </Link>
        <h1 className="mt-8 text-3xl font-semibold">Terms</h1>
        <p className="mt-2 text-xs text-muted-foreground">Last updated: September 2026</p>
        <div className="mt-6 space-y-5 text-sm leading-7 text-muted-foreground">
          <H>What Dealenz is</H>
          <p>
            Dealenz is an audit and document drafting tool for anyone reviewing an agreement. It
            helps identify risk and generate working drafts where that is the right next step for
            the deal you are looking at.
          </p>

          <H>Not legal advice</H>
          <p>
            Dealenz does not provide legal advice, does not replace professional legal review, and
            does not guarantee client payment, signature, or project outcome. For high-stakes
            agreements, have a qualified professional review the final document.
          </p>

          <H>Who can use it</H>
          <p>
            You must be 18 or over and provide accurate account information. One account per
            person; you are responsible for activity under your credentials.
          </p>

          <H>Credits and payment</H>
          <p>
            Dealenz is free to start: new accounts receive 10 credits, enough for two full
            analyses. Further work — analyses (5 each), answers, drafts, uploads, signature
            sends — consumes credits, which can be topped up in one-time credit packs inside the app. There are no subscriptions.
            Credits never expire. Failed operations do not consume credits. A purchase counts once
            our payment provider&apos;s verified settlement lands it in your balance; returning
            from checkout alone means nothing. If a purchase does not land in your balance, write
            to support and it will be put right.
          </p>

          <H>Refunds</H>
          <p>
            Because credits are digital goods delivered instantly, contact support within 14 days
            of purchase for a refund of credits you have not used. Credits already consumed by
            completed operations are not refundable. Refunded credits are removed from your
            balance when the refund settles.
          </p>

          <H>Your content, your responsibility</H>
          <p>
            You own what you upload and what Dealenz generates for you; you grant us only the
            license needed to store it, transmit it to our subprocessors, and operate the
            product. You are responsible for reviewing all generated documents before sending
            them, for having permission to upload and share everything you submit, and for
            confirming that your use complies with your client agreements and applicable
            obligations — including the privacy rights of any third party named in your deals
            (see Privacy). Do not upload material you do not have permission to process or
            share, send bulk unsolicited messages, or use Dealenz for anything unlawful.
          </p>

          <H>Counterparties</H>
          <p>
            When you invite someone to sign through a Dealenz link, you confirm you may lawfully
            share the document with them and contact them about it. Counterparties sign without
            needing an account; their signature data is processed as described in Privacy.
          </p>

          <H>Suspension and termination</H>
          <p>
            Accounts used for abuse, unlawful activity, or endangering the service may be
            suspended or terminated. If you believe that happened in error, write to support and
            a human will review it. You can leave at any time by deleting your account, which
            erases your data as described in Privacy; unused credit packs are refunded under the
            policy above.
          </p>

          <H>Liability</H>
          <p>
            To the extent permitted by law, Dealenz liability is limited to the fees you paid in
            the twelve months before the claim. Nothing here limits liability that cannot legally
            be limited.
          </p>

          <H>Changes</H>
          <p>
            These terms may change as the product evolves; material changes will be dated above
            and, where the law requires it, notified in the product. Continued use after a change
            means you accept the updated terms.
          </p>
        </div>
      </div>
    </main>
  )
}
