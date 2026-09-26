import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

interface SigningRow {
  signerId: string
  name: string
  partyLabel: string
  status: string
  signedAt: string | null
  auditId: string
  auditTitle: string
}

function formatDate(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const diff = Math.floor((Date.now() - d.getTime()) / 86400000)
  if (diff <= 0) return "Today"
  if (diff === 1) return "Yesterday"
  if (diff < 7) return `${diff}d ago`
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

// Signing: every signature ceremony in flight across deals, action-first.
// Pending signers sort above completed ones; each row links to its deal's
// document reader where the signing happens.
export default async function SigningPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  let rows: SigningRow[] = []
  try {
    const { data: audits } = await supabase
      .from("audits")
      .select("id, title")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(100)
    const auditList = ((audits ?? []) as Array<{ id: string; title: string }>)
    const titleByAudit = new Map(auditList.map((a) => [String(a.id), String(a.title || "Untitled deal")]))
    const auditIds = [...titleByAudit.keys()]
    if (auditIds.length > 0) {
      const { data: signers } = await supabase
        .from("document_signers")
        .select("id, name, party_label, status, signed_at, audit_id")
        .in("audit_id", auditIds)
        .order("created_at", { ascending: false })
        .limit(100)
      rows = ((signers ?? []) as Array<{
        id: string; name: string; party_label: string; status: string; signed_at: string | null; audit_id: string;
      }>).map((s) => ({
        signerId: String(s.id),
        name: String(s.name || "Signer"),
        partyLabel: String(s.party_label ?? "signer"),
        status: String(s.status ?? "pending"),
        signedAt: s.signed_at ? String(s.signed_at) : null,
        auditId: String(s.audit_id),
        auditTitle: titleByAudit.get(String(s.audit_id)) ?? "Untitled deal",
      }))
      rows.sort((a, b) => (a.status === "signed" ? 1 : 0) - (b.status === "signed" ? 1 : 0))
    }
  } catch {
    rows = []
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-background">
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--burgundy)]">Signatures in flight</p>
        <h1 className="mt-1.5 text-[28px] font-semibold leading-tight tracking-[-0.01em]">Signing</h1>

        {rows.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed p-6 text-center">
            <p className="text-sm font-medium">Nothing to sign</p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
              When a document is ready, sign first as owner — then send it to your counterparty from the document page.
            </p>
            <Link href="/drafts" className="mt-3 inline-flex h-9 items-center rounded-full bg-primary px-4 text-xs font-medium text-primary-foreground hover:opacity-90">
              Go to drafts
            </Link>
          </div>
        ) : (
          <ul className="mt-6 space-y-2">
            {rows.map((r) => (
              <li key={r.signerId}>
                <Link
                  href={`/document/${r.auditId}`}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 transition-colors hover:bg-muted/40"
                >
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize",
                      r.status === "signed"
                        ? "bg-emerald-500/10 text-emerald-700"
                        : "bg-amber-500/10 text-amber-700"
                    )}
                  >
                    {r.status === "signed" ? "signed" : "waiting"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {r.name} <span className="font-normal text-muted-foreground">({r.partyLabel})</span>
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                      {r.auditTitle}{r.signedAt ? ` · signed ${formatDate(r.signedAt)}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-medium text-primary">Open</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
