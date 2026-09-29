import Link from "next/link"

export const metadata = {
  title: "Security",
}

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="pt-2 text-base font-semibold text-foreground">{children}</h2>
}

export default function SecurityPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          Back to Dealenz
        </Link>
        <h1 className="mt-8 text-3xl font-semibold">Security</h1>
        <p className="mt-2 text-xs text-muted-foreground">Last updated: September 2026</p>
        <div className="mt-6 space-y-5 text-sm leading-7 text-muted-foreground">
          <H>How access is controlled</H>
          <p>
            Sign-in is email and password with email verification, Google OAuth, enterprise
            SSO (SAML/OIDC) for workspaces that configure it, and optional TOTP
            two-factor authentication in Settings. Every database table enforces
            owner-scoped row-level security, so application bugs cannot leak one
            customer&apos;s deals to another.
          </p>

          <H>How data is protected</H>
          <p>
            Databases are EU-hosted with AES-256 encryption at rest and TLS in transit.
            Secrets live in environment configuration, never in code. AI provider calls
            run server-side; browsers never hold provider keys. You can mask names,
            amounts, and counterparties in your browser before anything is sent.
          </p>

          <H>How actions stay auditable</H>
          <p>
            Signature ceremonies, version locks, redrafts, credit movements, and
            monitoring alerts are written to append-only records with content hashes.
            Invitation links are single-purpose tokens; signing binds the exact
            document version, and fully signed documents lock against edits.
          </p>

          <H>Certifications and review</H>
          <p>
            An independent SOC 2 Type II audit of our controls is in progress; this
            page will link the report when it lands. Enterprise customers receive a
            signed data processing agreement (see our{" "}
            <Link href="/dpa" className="underline underline-offset-2 hover:text-foreground">
              DPA
            </Link>
            ) and a live platform status at{" "}
            <Link href="/status" className="underline underline-offset-2 hover:text-foreground">
              /status
            </Link>
            . Security questions: contact us through the help center and we respond
            within two business days.
          </p>
        </div>
      </div>
    </main>
  )
}
