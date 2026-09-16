import Link from "next/link"
import { redirect } from "next/navigation"
import { FileText, ArrowRight, Archive, Shapes } from "lucide-react"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

interface DocVersion {
  audit_id: string
  document_type: string
  version_number: number
  content: string | null
  generation_method: string | null
  created_at: string
}

interface AuditRow {
  id: string
  title: string
  status: string
  created_at: string
}

export default async function VaultPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  if (!user.email_confirmed_at) redirect("/dashboard")

  const [{ data: audits }, { data: docs }] = await Promise.all([
    supabase.from("audits").select("id, title, status, created_at").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(20),
    supabase.from("document_versions").select("audit_id, document_type, version_number, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(30),
  ])

  const allAudits = (audits ?? []) as AuditRow[]
  const versions = (docs ?? []) as DocVersion[]
  const auditTitle = new Map(allAudits.map((a) => [a.id, a.title]))

  return (
    <div className="px-4 sm:px-6 py-6 sm:py-8 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Archive className="h-5 w-5 text-muted-foreground" />
            Vault
          </h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-xl">
            Every document tied to a deal — source, drafts, risk snapshots, and handoff — in one place. No data rooms, just the deal you are on.
          </p>
        </div>
        <Link href="/audit/new" className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
          New deal
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/templates" className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
          <Shapes className="h-3.5 w-3.5" />
          New from template
        </Link>
        <Link href="/deals" className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
          View deals
        </Link>
      </div>

      {versions.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center">
          <Archive className="mx-auto h-6 w-6 text-muted-foreground/40" />
          <h2 className="mt-3 text-sm font-semibold">No documents yet</h2>
          <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
            Upload a source, run risk analysis, and generate drafts. They will appear here versioned and ready to share or finalize.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <Link href="/audit/new" className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
              New deal
            </Link>
            <Link href="/templates" className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted transition-colors">
              <Shapes className="h-3.5 w-3.5" />
              New from template
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          {Object.entries(
            versions.reduce<Record<string, DocVersion[]>>((acc, v) => {
              const key = v.audit_id
              if (!acc[key]) acc[key] = []
              acc[key].push(v)
              return acc
            }, {})
          ).slice(0, 8).map(([auditId, list]) => (
            <section key={auditId} className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <Link href={`/audit/${auditId}`} className="text-sm font-medium hover:underline">
                  {auditTitle.get(auditId) ?? auditId.slice(0, 8)}
                </Link>
                <Link href={`/audit/${auditId}`} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                  Open deal <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              <ul className="mt-3 space-y-1.5">
                {list.slice(0, 6).map((d) => (
                  <li key={`${d.audit_id}-${d.document_type}-${d.version_number}`} className="flex items-center gap-2 text-sm">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="capitalize">{d.document_type.replace(/_/g, " ")}</span>
                    <span className="text-xs text-muted-foreground">v{d.version_number}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{new Date(d.created_at).toLocaleDateString()}</span>
                    <span className="text-[10px] rounded-full bg-muted px-1.5 py-0.5 font-medium text-muted-foreground capitalize">{d.generation_method ?? "draft"}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
