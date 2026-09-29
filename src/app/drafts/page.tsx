import Link from "next/link"
import type { ReactNode } from "react"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { RestoreButton } from "@/components/drafts/restore-button"

export const dynamic = "force-dynamic"

interface DraftRow {
  id: string
  auditId: string
  auditTitle: string
  documentType: string
  versionNumber: number
  generationMethod: string | null
  status: string | null
  createdAt: string
  changeSummary: string | null
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const diff = Math.floor((Date.now() - d.getTime()) / 86400000)
  if (diff <= 0) return "Today"
  if (diff === 1) return "Yesterday"
  if (diff < 7) return `${diff}d ago`
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function versionStatus(version: DraftRow): { label: string; tone: string } {
  const s = version.status ?? ""
  if (s === "fully_signed" || s === "locked") return { label: "signed", tone: "bg-emerald-500/10 text-emerald-700" }
  if (s === "superseded") return { label: "superseded", tone: "bg-muted text-muted-foreground" }
  if (s === "owner_signed" || s === "counterparty_pending" || s === "sent" || s === "ready_to_sign" || s === "ready_to_send") {
    return { label: "in signing", tone: "bg-amber-500/10 text-amber-700" }
  }
  return { label: "draft", tone: "bg-muted text-muted-foreground" }
}

function VersionRow({ version, auditId, restore }: { version: DraftRow; auditId: string; restore?: ReactNode }) {
  const st = versionStatus(version)
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 transition-colors hover:bg-muted/40">
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${st.tone}`}>
        {st.label}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">
          <span className="capitalize">{version.documentType.replaceAll("_", " ")}</span>
          {" "}v{version.versionNumber}
        </span>
        <span className="mt-0.5 block text-[11px] text-muted-foreground">
          {[version.generationMethod, formatDate(version.createdAt)].filter(Boolean).join(" · ")}
        </span>
        {version.changeSummary && (
          <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
            Why: {version.changeSummary}
          </span>
        )}
      </span>
      {restore}
      <Link
        href={`/document/${auditId}?v=${version.id}`}
        className="shrink-0 text-xs font-medium text-primary"
      >
        Open
      </Link>
    </div>
  )
}

// Drafts: every generated document across deals, newest first. Generation
// stays where it happens (threads, plans); this page is the shelf, not a
// second generator — each row links to its deal's document reader.
export default async function DraftsPage({ searchParams }: { searchParams?: Promise<{ q?: string; s?: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  const params = (await searchParams) ?? {}
  const query = (params.q ?? "").trim().toLowerCase()
  const statusFilter = (params.s === "draft" || params.s === "signing" || params.s === "signed" || params.s === "superseded" ? params.s : "all") as "all" | "draft" | "signing" | "signed" | "superseded"

  let drafts: DraftRow[] = []
  let loadError: string | null = null
  let capped = false
  try {
    const { data: versions } = await supabase
      .from("document_versions")
      .select("id, audit_id, document_type, version_number, generation_method, status, created_at, provenance")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50)
    const rows = ((versions ?? []) as Array<{
      id: string; audit_id: string; document_type: string; version_number: number;
      generation_method: string | null; status: string | null; created_at: string;
      provenance: Record<string, unknown> | null;
    }>)
    capped = rows.length >= 50
    const auditIds = [...new Set(rows.map((r) => String(r.audit_id)).filter(Boolean))]
    let titleByAudit = new Map<string, string>()
    if (auditIds.length > 0) {
      const { data: audits } = await supabase
        .from("audits")
        .select("id, title")
        .eq("user_id", user.id)
        .in("id", auditIds)
      titleByAudit = new Map(((audits ?? []) as Array<{ id: string; title: string }>).map((a) => [String(a.id), String(a.title || "Untitled deal")]))
    }
    drafts = rows.map((r) => ({
      id: String(r.id),
      auditId: String(r.audit_id),
      auditTitle: titleByAudit.get(String(r.audit_id)) ?? "Untitled deal",
      documentType: String(r.document_type ?? "document"),
      versionNumber: typeof r.version_number === "number" ? r.version_number : 0,
      generationMethod: typeof r.generation_method === "string" ? r.generation_method : null,
      status: typeof r.status === "string" ? r.status : null,
      createdAt: String(r.created_at ?? ""),
      changeSummary: typeof r.provenance?.change_summary === "string" && r.provenance.change_summary.trim() ? r.provenance.change_summary.slice(0, 140) : null,
    }))
  } catch {
    // A failed load is an error state with retry — never the empty state.
    loadError = "We couldn't load your drafts. Please try again."
  }

  const visible = drafts.filter((d) => {
    if (statusFilter !== "all") {
      const label = versionStatus(d).label
      const key = label === "in signing" ? "signing" : label
      if (key !== statusFilter) return false
    }
    if (!query) return true
    return `${d.auditTitle} ${d.documentType}`.toLowerCase().includes(query)
  })
  // Group by deal: one row per document was version-bloat (5 regenerations =
  // 5 rows). Latest version leads; older ones sit in a native expander.
  const groups = new Map<string, { title: string; auditId: string; versions: DraftRow[] }>()
  for (const d of visible) {
    const g = groups.get(d.auditId) ?? { title: d.auditTitle, auditId: d.auditId, versions: [] as DraftRow[] }
    g.versions.push(d)
    groups.set(d.auditId, g)
  }
  const dealCount = groups.size
  const statusCounts = {
    draft: drafts.filter((d) => versionStatus(d).label === "draft").length,
    signing: drafts.filter((d) => versionStatus(d).label === "in signing").length,
    signed: drafts.filter((d) => versionStatus(d).label === "signed").length,
    superseded: drafts.filter((d) => versionStatus(d).label === "superseded").length,
  }
  function draftsHref(s: string, q: string): string {
    const sp = new URLSearchParams({ ...(s === "all" ? {} : { s }), ...(q ? { q } : {}) })
    const str = sp.toString()
    return str ? `/drafts?${str}` : "/drafts"
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-background">
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--burgundy)]">Your work, ready to send</p>
        <h1 className="mt-1.5 text-[28px] font-semibold leading-tight tracking-[-0.01em]">Drafts</h1>

        {loadError ? (
          <div className="mt-6 rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-center" role="alert">
            <p className="text-sm font-medium">{loadError}</p>
            <Link href="/drafts" className="mt-3 inline-flex h-9 items-center rounded-full bg-primary px-4 text-xs font-medium text-primary-foreground hover:opacity-90">
              Retry
            </Link>
          </div>
        ) : drafts.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed p-6 text-center">
            <p className="text-sm font-medium">No drafts yet</p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
              Analyze a deal and generate a proposal, contract, or agreement — every draft lands here.
            </p>
            <Link href="/dashboard" className="mt-3 inline-flex h-9 items-center rounded-full bg-primary px-4 text-xs font-medium text-primary-foreground hover:opacity-90">
              Analyze a deal
            </Link>
          </div>
        ) : (
          <>
            <form method="get" action="/drafts" className="mt-6 flex items-center gap-2">
              <input
                type="search"
                name="q"
                defaultValue={query}
                placeholder="Search deals or document types…"
                aria-label="Search drafts"
                className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm"
              />
              {statusFilter !== "all" && <input type="hidden" name="s" value={statusFilter} />}
              <Link href="/dashboard" className="inline-flex h-9 shrink-0 items-center rounded-full bg-primary px-4 text-xs font-medium text-primary-foreground hover:opacity-90">
                New draft
              </Link>
            </form>
            <div className="mt-3 flex flex-wrap gap-1" role="group" aria-label="Status filter">
              {(["all", "draft", "signing", "signed", "superseded"] as const).map((v) => (
                <Link
                  key={v}
                  href={draftsHref(v, query)}
                  aria-current={statusFilter === v ? "true" : undefined}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${statusFilter === v ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {v === "all" ? `All · ${drafts.length}` : v === "signing" ? `In signing · ${statusCounts.signing}` : v === "draft" ? `Draft · ${statusCounts.draft}` : v === "signed" ? `Signed · ${statusCounts.signed}` : `Superseded · ${statusCounts.superseded}`}
                </Link>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {visible.length} document{visible.length === 1 ? "" : "s"} across {dealCount} deal{dealCount === 1 ? "" : "s"}
              {capped ? " — showing the 50 most recent" : ""}.
            </p>
            {visible.length === 0 ? (
              <p className="mt-6 text-center text-sm text-muted-foreground">No drafts match.</p>
            ) : (
            <ul className="mt-4 space-y-4">
              {[...groups.values()].map((g) => (
                <li key={g.auditId}>
                  <p className="px-1 pb-1.5 text-[13px] font-semibold">
                    {g.title}{" "}
                    <span className="font-normal text-muted-foreground">
                      · {g.versions.length} version{g.versions.length === 1 ? "" : "s"}
                    </span>
                  </p>
                  <ul className="space-y-2">
                    <li><VersionRow version={g.versions[0]!} auditId={g.auditId} /></li>
                    {g.versions.length > 1 && (
                      <li>
                        <details>
                          <summary className="cursor-pointer px-1 py-1 text-xs font-medium text-muted-foreground hover:text-foreground">
                            Older versions ({g.versions.length - 1})
                          </summary>
                          <ul className="mt-1 space-y-2">
                            {g.versions.slice(1).map((v) => (
                              <li key={v.id}><VersionRow version={v} auditId={g.auditId} restore={<RestoreButton auditId={g.auditId} versionId={v.id} versionNumber={v.versionNumber} />} /></li>
                            ))}
                          </ul>
                        </details>
                      </li>
                    )}
                  </ul>
                </li>
              ))}
            </ul>
            )}
          </>
        )}
      </div>
    </div>
  )
}
