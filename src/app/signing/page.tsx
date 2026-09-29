import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { cn } from "@/lib/utils"
import { StandaloneContractForm } from "@/components/signing/standalone-contract-form"
import { ResendButton } from "@/components/signing/resend-button"
import { ReassignButton } from "@/components/signing/reassign-button"

export const dynamic = "force-dynamic"

interface SigningRow {
  signerId: string
  name: string
  email: string
  partyLabel: string
  status: string
  signedAt: string | null
  createdAt: string | null
  expiresAt: string | null
  auditId: string
  auditTitle: string
}

type QueueFilter = "all" | "needs-me" | "waiting" | "done"

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

function isOwner(label: string): boolean {
  return label === "owner" || label === "Owner"
}

function queueOf(row: SigningRow): Exclude<QueueFilter, "all"> {
  if (row.status === "signed") return "done"
  if (row.status === "declined" || row.status === "revoked" || row.status === "expired") return "done"
  if (isOwner(row.partyLabel)) return "needs-me"
  return "waiting"
}

function pillTone(status: string): string {
  if (status === "signed") return "bg-emerald-500/10 text-emerald-700"
  if (status === "declined" || status === "revoked" || status === "expired") return "bg-muted text-muted-foreground"
  return "bg-amber-500/10 text-amber-700"
}

function pillLabel(row: SigningRow): string {
  if (row.status === "signed") return "signed"
  if (row.status === "declined" || row.status === "revoked" || row.status === "expired") return row.status
  if (isOwner(row.partyLabel)) return "needs you"
  return "waiting"
}

function waitingDays(iso: string | null): number | null {
  if (!iso) return null
  const d = new Date(iso).getTime()
  if (Number.isNaN(d)) return null
  return Math.max(0, Math.floor((Date.now() - d) / 86400000))
}

function expiresInDays(iso: string | null): number | null {
  if (!iso) return null
  const d = new Date(iso).getTime()
  if (Number.isNaN(d)) return null
  return Math.ceil((d - Date.now()) / 86400000)
}

// Signing: every signature ceremony in flight across deals, action-first.
// Pending signers sort above completed ones; each row links to its deal's
// document reader where the signing happens.
export default async function SigningPage({ searchParams }: { searchParams?: Promise<{ q?: string; f?: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  const params = (await searchParams) ?? {}
  const query = (params.q ?? "").trim().toLowerCase()
  const filter = (params.f === "needs-me" || params.f === "waiting" || params.f === "done" ? params.f : "all") as QueueFilter

  let rows: SigningRow[] = []
  let loadError: string | null = null
  let capped = false
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
        .select("id, name, email, party_label, status, signed_at, created_at, audit_id")
        .in("audit_id", auditIds)
        .order("created_at", { ascending: false })
        .limit(100)
      const list = ((signers ?? []) as Array<{
        id: string; name: string; email: string; party_label: string; status: string; signed_at: string | null; created_at: string | null; audit_id: string;
      }>)
      capped = list.length >= 100 || auditList.length >= 100
      // Expiry timestamps ride a separate best-effort query so the queue
      // keeps working before migration 00090 is applied.
      let expiryBySigner = new Map<string, string>()
      try {
        const signerIds = list.map((s) => String(s.id))
        if (signerIds.length > 0) {
          const { data: exp, error: expError } = await supabase
            .from("document_signers")
            .select("id, expires_at")
            .in("id", signerIds)
          if (!expError) {
            expiryBySigner = new Map(
              ((exp ?? []) as Array<{ id: string; expires_at: string | null }>)
                .filter((e) => e.expires_at)
                .map((e) => [String(e.id), String(e.expires_at)])
            )
          }
        }
      } catch {
        // Pre-migration: no expiry display, queue unaffected.
      }
      rows = list.map((s) => ({
        signerId: String(s.id),
        name: String(s.name || "Signer"),
        email: String(s.email || ""),
        partyLabel: String(s.party_label ?? "signer"),
        status: String(s.status ?? "pending"),
        signedAt: s.signed_at ? String(s.signed_at) : null,
        createdAt: s.created_at ? String(s.created_at) : null,
        expiresAt: expiryBySigner.get(String(s.id)) ?? null,
        auditId: String(s.audit_id),
        auditTitle: titleByAudit.get(String(s.audit_id)) ?? "Untitled deal",
      }))
      rows.sort((a, b) => (queueOf(a) === "done" ? 1 : 0) - (queueOf(b) === "done" ? 1 : 0))
    }
  } catch {
    // A failed load is an error state with retry — never the empty state.
    loadError = "We couldn't load your signing queue. Please try again."
  }

  const visible = rows.filter((r) => {
    if (filter !== "all" && queueOf(r) !== filter) return false
    if (!query) return true
    return `${r.name} ${r.email} ${r.auditTitle} ${r.partyLabel}`.toLowerCase().includes(query)
  })
  const needsMe = rows.filter((r) => queueOf(r) === "needs-me").length
  const waiting = rows.filter((r) => queueOf(r) === "waiting").length
  const done = rows.filter((r) => queueOf(r) === "done").length

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-background">
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--burgundy)]">Signatures in flight</p>
        <h1 className="mt-1.5 text-[28px] font-semibold leading-tight tracking-[-0.01em]">Signing</h1>

        {loadError ? (
          <div className="mt-6 rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-center" role="alert">
            <p className="text-sm font-medium">{loadError}</p>
            <Link href="/signing" className="mt-3 inline-flex h-9 items-center rounded-full bg-primary px-4 text-xs font-medium text-primary-foreground hover:opacity-90">
              Retry
            </Link>
          </div>
        ) : rows.length === 0 ? (
          <div className="mt-6 space-y-6">
            <div className="rounded-xl border border-dashed p-5 text-center">
              <p className="text-sm font-medium">Nothing to sign</p>
              <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
                When a document is ready, sign first as owner — then send it to your counterparty from the document page.
              </p>
              <Link href="/drafts" className="mt-3 inline-flex h-9 items-center rounded-full bg-primary px-4 text-xs font-medium text-primary-foreground hover:opacity-90">
                Go to drafts
              </Link>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Have the contract already?</p>
              <StandaloneContractForm mode="sign" />
            </div>
          </div>
        ) : (
          <>
            <form method="get" action="/signing" className="mt-6 flex flex-col gap-2 sm:flex-row">
              <input
                type="search"
                name="q"
                defaultValue={query}
                placeholder="Search name, email, or deal…"
                aria-label="Search signing queue"
                className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm"
              />
              <div className="flex gap-1" role="group" aria-label="Queue filter">
                {(["all", "needs-me", "waiting", "done"] as const).map((v) => (
                  <Link
                    key={v}
                    href={`/signing${v === "all" && !query ? "" : `?${new URLSearchParams({ ...(v === "all" ? {} : { f: v }), ...(query ? { q: query } : {}) }).toString()}`}`}
                    aria-current={filter === v ? "true" : undefined}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                      filter === v ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {v === "all" ? `All · ${rows.length}` : v === "needs-me" ? `Needs you · ${needsMe}` : v === "waiting" ? `Waiting · ${waiting}` : `Done · ${done}`}
                  </Link>
                ))}
              </div>
            </form>
            {capped && (
              <p className="mt-2 text-[11px] text-muted-foreground">Showing the 100 most recent — refine search to find older ceremonies.</p>
            )}
            {visible.length === 0 ? (
              <p className="mt-6 text-center text-sm text-muted-foreground">No ceremonies match.</p>
            ) : (
          <ul className="mt-4 space-y-2">
            {visible.map((r) => {
              const queue = queueOf(r)
              const age = queue === "done" ? null : waitingDays(r.createdAt)
              const expiring = queue === "done" ? null : expiresInDays(r.expiresAt)
              return (
              <li key={r.signerId} className="flex items-center gap-1 rounded-2xl border border-border bg-card transition-colors hover:bg-muted/40">
                <Link
                  href={`/document/${r.auditId}`}
                  className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3"
                >
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize",
                      pillTone(r.status)
                    )}
                  >
                    {pillLabel(r)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {r.name} <span className="font-normal text-muted-foreground">({r.partyLabel})</span>
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                      {r.auditTitle}{r.signedAt ? ` · signed ${formatDate(r.signedAt)}` : age !== null ? ` · waiting ${age}d` : ""}
                      {expiring !== null && expiring <= 0 && (
                        <span className="font-medium text-red-700"> · expired</span>
                      )}
                      {expiring !== null && expiring > 0 && expiring <= 7 && (
                        <span className="font-medium text-amber-700"> · expiring in {expiring}d</span>
                      )}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-medium text-primary">Open</span>
                </Link>
                {queue === "waiting" && r.email && (
                  <span className="flex shrink-0 items-center gap-1 pr-2">
                    <ResendButton auditId={r.auditId} name={r.name} email={r.email} />
                    <ReassignButton auditId={r.auditId} signerId={r.signerId} currentName={r.name} />
                  </span>
                )}
              </li>
              )
            })}
          </ul>
            )}
          </>
        )}
      </div>
    </div>
  )
}
