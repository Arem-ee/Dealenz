import Link from "next/link"
import { notFound } from "next/navigation"
import { Logo } from "@/components/logo"
import { getSignerView } from "@/app/sign/[token]/actions"
import { InviteeSignForm } from "@/app/sign/[token]/invitee-sign-form"

export const dynamic = "force-dynamic"

// Public ceremony door: token-gated, no account. Counterparties review
// and sign here; identity binds by invitation email server-side.
export default async function SignTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const view = await getSignerView(token)
  if (!view) notFound()

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link href="/" aria-label="Dealenz home">
            <Logo />
          </Link>
          <p className="text-xs tabular-nums text-muted-foreground">
            {view.signedSigners} of {view.totalSigners} signed
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {view.documentType.replace(/-/g, " ")} · v{view.versionNumber}
        </p>
        <h1 className="mt-1 text-xl font-bold tracking-tight">Review and sign</h1>

        {view.status === "signed" ? (
          <div className="mt-4 border border-border p-4" role="status">
            <p className="text-sm font-medium">Signed{view.signedAt ? ` on ${new Date(view.signedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : ""}.</p>
            <p className="mt-1 text-xs text-muted-foreground">This invitation is complete — nothing further needed.</p>
          </div>
        ) : view.status === "declined" || view.status === "revoked" ? (
          <div className="mt-4 border border-border p-4" role="status">
            <p className="text-sm font-medium">This invitation is no longer valid.</p>
            <p className="mt-1 text-xs text-muted-foreground">Contact the sender for a fresh link.</p>
          </div>
        ) : view.superseded ? (
          <div className="mt-4 border border-border p-4" role="status">
            <p className="text-sm font-medium">A newer version exists — signing is paused.</p>
            <p className="mt-1 text-xs text-muted-foreground">The sender will invite you to the new version. Don&apos;t sign this one.</p>
          </div>
        ) : (
          <div className="mt-4">
            <InviteeSignForm token={token} invitedName={view.name} invitedEmail={view.email} />
          </div>
        )}

        <section aria-label="Document" className="mt-6 border border-border">
          <p className="border-b border-border px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Document</p>
          <p className="whitespace-pre-wrap px-4 py-4 text-sm leading-relaxed">{view.content}</p>
        </section>
      </main>
    </div>
  )
}
