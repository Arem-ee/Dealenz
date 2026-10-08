import Link from "next/link"
import { notFound } from "next/navigation"
import { Logo } from "@/components/logo"
import { audienceLabel } from "@/lib/guests/grants"
import { getGuestPortal } from "@/app/guest/[token]/actions"
import { GuestPortalView } from "@/app/guest/[token]/guest-portal-view"

export const dynamic = "force-dynamic"

// Public guest door: token-gated, no account. One external surface for
// every audience — the grant types the visitor (employee / supplier /
// customer) and scopes exactly what they may do. Readers read; the single
// primary uploader per deal uploads redlines back staged.
export default async function GuestTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const portal = await getGuestPortal(token)
  if (!portal) notFound()

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link href="/" aria-label="Dealenz home">
            <Logo />
          </Link>
          <p className="text-xs text-muted-foreground">
            Shared with you as {audienceLabel(portal.audience).toLowerCase()}
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <h1 className="text-xl font-bold tracking-tight">{portal.dealTitle}</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {portal.scope === "uploader" && portal.isPrimaryOwner
            ? "Review the documents and upload your redlines back — they stage for the owner, never straight into the deal."
            : "Review the shared documents. This link is scoped to this deal only."}
          {portal.expiresAt
            ? ` Access ends ${new Date(portal.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}.`
            : ""}
        </p>
        <GuestPortalView token={token} portal={portal} />
      </main>
    </div>
  )
}
