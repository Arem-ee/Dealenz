import Link from "next/link"

export const metadata = {
  title: "Privacy",
}

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="pt-2 text-base font-semibold text-foreground">{children}</h2>
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          Back to Dealenz
        </Link>
        <h1 className="mt-8 text-3xl font-semibold">Privacy</h1>
        <p className="mt-2 text-xs text-muted-foreground">Last updated: September 2026</p>
        <div className="mt-6 space-y-5 text-sm leading-7 text-muted-foreground">
          <p>
            Dealenz is the data controller for your account. If you have any privacy question —
            including what is held about you — write to{" "}
            <a href="mailto:support@dealenz.com" className="font-medium text-foreground hover:underline">
              support@dealenz.com
            </a>
            .
          </p>

          <H>What we collect</H>
          <p>
            <strong className="font-semibold text-foreground">Account data:</strong> your email address,
            sign-in records, and any business profile details you choose to add (name, entity,
            address, rates). <strong className="font-semibold text-foreground">Deal content:</strong> the
            contracts, descriptions, files, and messages you submit, plus the analyses, documents,
            and signatures produced from them. <strong className="font-semibold text-foreground">Payment
            data:</strong> purchases are processed by Paddle as merchant of record — we see what you
            bought and what it cost, never your card numbers. <strong className="font-semibold text-foreground">Connected
            accounts:</strong> if you connect Gmail, we can read the threads you choose to import and
            send the alerts you ask for, nothing else. <strong className="font-semibold text-foreground">Operational
            metadata:</strong> error reports and usage counters (for example AI token counts per
            operation). These never contain your deal text.
          </p>

          <H>A note on other people&apos;s information</H>
          <p>
            Contracts routinely contain third-party personal data: counterparty names, email
            addresses, salaries, equity terms. By uploading such material you confirm you have a
            lawful basis to share it with us for analysis — typically your legitimate interest in
            reviewing a deal you are party to. Only upload material you are authorized to process,
            and avoid including sensitive information the review does not need.
          </p>

          <H>How we use it, and on what basis</H>
          <p>
            We use your data to operate your account and provide the features you ask for:
            analysis, documents, sharing, signing, monitoring, and billing. Where data protection
            law requires a lawful basis (including the EU and UK GDPR), those bases are performance
            of our contract with you, your consent (for example AI analysis of what you submit and
            Gmail access you connect), and our legitimate interests in running a secure, working
            product. You can withdraw consent at any time by deleting the relevant content or your
            account, or disconnecting Gmail in Settings.
          </p>

          <H>Who processes it</H>
          <p>
            Your data lives in our EU-hosted database (Supabase, EU West) and is served through
            our hosting provider (Vercel). Deal content you submit for analysis is transmitted to
            our AI processing provider (OpenRouter), which routes it to the underlying model
            provider to produce that analysis. Payments run through Paddle. Email sending and
            Gmail access run through Google, only where you enable them. Each processes data only
            to provide its part of the service, under agreements that forbid any other use. We do
            not sell your data, and we do not use it for advertising.
          </p>

          <H>How long we keep it</H>
          <p>
            We keep your account data for as long as your account exists. Delete your account at
            any time from Settings → Delete account and everything in it is erased from our live
            systems immediately. Download a copy of everything first from Settings → Privacy, and
            delete individual deals any time from your dashboard deals table — you never have to
            erase everything to remove one sensitive deal. Encrypted provider backups age out on
            the provider&apos;s own schedule after that. We keep malfunction and billing records
            only as long as needed for security, troubleshooting, and legal obligations.
          </p>

          <H>Your rights</H>
          <p>
            You can access, correct, export, or delete your data — most of it directly in the
            product, the rest by writing to support@dealenz.com. Where the law gives you rights of
            objection or restriction, or the right to complain to your supervisory authority, those
            apply in full. We answer privacy requests within one month.
          </p>

          <H>International transfers</H>
          <p>
            Our database is hosted in the EU. AI processing and some infrastructure operate in the
            United States under our providers&apos; contractual safeguards. By using Dealenz you
            understand deal content you submit may be processed there to produce your analysis.
          </p>

          <H>Security</H>
          <p>
            Access is scoped so accounts can only ever read their own data; all traffic is
            encrypted in transit and storage is encrypted at rest by our providers. No system is
            impregnable: if a breach exposes your data we will notify you and the relevant
            authority without undue delay, as the law requires.
          </p>

          <H>Cookies</H>
          <p>
            Sign-in relies on session cookies. Dealenz does not use advertising trackers.
          </p>

          <H>Minors</H>
          <p>
            Dealenz is for users aged 18 and over. We do not knowingly collect data from children.
          </p>

          <H>Changes</H>
          <p>
            If this policy changes materially we will update the date above and, where the law
            requires it, notify you in the product before the change takes effect.
          </p>
        </div>
      </div>
    </main>
  )
}
