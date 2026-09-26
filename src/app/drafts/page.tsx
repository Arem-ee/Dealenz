import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

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

// Drafts: every generated document across deals, newest first. Generation
// stays where it happens (threads, plans); this page is the shelf, not a
// second generator — each row links to its deal's document reader.
export default async function DraftsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  let drafts: DraftRow[] = []
  try {
    const { data: versions } = await supabase
      .from("document_versions")
      .select("id, audit_id, document_type, version_number, generation_method, status, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50)
    const rows = ((versions ?? []) as Array<{
      id: string; audit_id: string; document_type: string; version_number: number;
      generation_method: string | null; status: string | null; created_at: string;
    }>)
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
    }))
  } catch {
    drafts = []
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-background">
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--burgundy)]">Your work, ready to send</p>
        <h1 className="mt-1.5 text-[28px] font-semibold leading-tight tracking-[-0.01em]">Drafts</h1>

        {drafts.length === 0 ? (
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
          <ul className="mt-6 space-y-2">
            {drafts.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/document/${d.auditId}`}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 transition-colors hover:bg-muted/40"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      <span className="capitalize">{d.documentType.replaceAll("_", " ")}</span>
                      {" "}v{d.versionNumber} · {d.auditTitle}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      {[d.generationMethod, formatDate(d.createdAt)].filter(Boolean).join(" · ") || d.status || ""}
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
