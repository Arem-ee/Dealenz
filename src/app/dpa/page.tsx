import Link from "next/link"

export const metadata = {
  title: "Data Processing Agreement",
}

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="pt-2 text-base font-semibold text-foreground">{children}</h2>
}

export default function DpaPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          Back to Dealenz
        </Link>
        <h1 className="mt-8 text-3xl font-semibold">Data Processing Agreement</h1>
        <p className="mt-2 text-xs text-muted-foreground">Last updated: September 2026</p>
        <div className="mt-6 space-y-5 text-sm leading-7 text-muted-foreground">
          <p>
            This page summarizes how Dealenz processes customer data. Enterprise
            customers receive a signed copy on request before procurement review.
            Nothing here is legal advice; the signed agreement governs.
          </p>

          <H>Roles and subject matter</H>
          <p>
            The customer is the controller of deal content (contracts, counterparty
            details, uploaded files). Dealenz acts as processor, handling that content
            only to provide analysis, drafting, signing, monitoring, and support.
          </p>

          <H>Subprocessors</H>
          <p>
            Infrastructure and model providers with data access: Supabase (Postgres,
            Auth, storage; EU region), the configured AI providers used for
            extraction and synthesis, Paddle (software billing, merchant of record),
            Gmail API scopes granted by the customer (read threads, send alerts),
            and Vercel (hosting). The live list is confirmed in each signed DPA.
          </p>

          <H>Security measures</H>
          <p>
            AES-256 encryption at rest, TLS in transit, owner-scoped row-level
            security on every table, least-privilege service functions, SSO/SAML and
            TOTP two-factor authentication, immutable signature and version audit
            records. See <Link href="/security" className="underline underline-offset-2 hover:text-foreground">/security</Link> for
            the current posture and SOC 2 Type II audit status.
          </p>

          <H>Retention and deletion</H>
          <p>
            Deal content is kept until the owner deletes the deal or the account.
            Deleting a deal removes its files, threads, documents, and monitoring
            state; deleting the account erases everything via Settings. Billing
            records and provider backups age out on their own schedules.
          </p>

          <H>International transfers and breach notice</H>
          <p>
            Primary processing and storage are in the EU. Where a subprocessor
            processes data elsewhere, transfers rely on that provider&apos;s adequacy
            coverage or standard contractual clauses. Breach notification follows
            GDPR timelines: without undue delay and within 72 hours where required.
          </p>
        </div>
      </div>
    </main>
  )
}
