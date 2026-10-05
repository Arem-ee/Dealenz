import { createClient } from "@/lib/supabase/server"
import { DealRepo } from "@/components/home/deal-repo"
import { buildRepoRows } from "@/lib/deals/repo"
import type { RuleResult } from "@/lib/rules/result"

export const dynamic = "force-dynamic"

interface AuditRow {
  id: string
  title: string | null
  deal_type: string | null
  updated_at: string
  structured_data: { deterministicFindings?: unknown } | null
}

interface VersionRow {
  audit_id: string
  status: string | null
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return <div />

  const [{ data: auditRows }, { data: versionRows }] = await Promise.all([
    supabase
      .from("audits")
      .select("id, title, deal_type, updated_at, structured_data")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(200),
    supabase
      .from("document_versions")
      .select("audit_id, status")
      .eq("user_id", user.id),
  ])

  // Shared leg: deals shared with the caller's groups union in read-only.
  // Bounded and additive; failure degrades to owned rows only.
  let sharedAudits: AuditRow[] = []
  let sharedVersions: VersionRow[] = []
  try {
    const { sharedAuditIds } = await import("@/lib/deals/shares")
    const ids = await sharedAuditIds(supabase, user.id)
    if (ids.length > 0) {
      const [{ data: sharedAuditRows }, { data: sharedVersionRows }] = await Promise.all([
        supabase.from("audits").select("id, title, deal_type, updated_at, structured_data").in("id", ids.slice(0, 100)),
        supabase.from("document_versions").select("audit_id, status").in("audit_id", ids.slice(0, 100)).limit(500),
      ])
      sharedAudits = ((sharedAuditRows ?? []) as unknown as AuditRow[]).filter((a) => !(auditRows ?? []).some((o) => (o as AuditRow).id === a.id))
      const ownedAuditIds = new Set(((auditRows ?? []) as unknown as AuditRow[]).map((a) => a.id))
      sharedVersions = ((sharedVersionRows ?? []) as unknown as VersionRow[]).filter((v) => !ownedAuditIds.has(v.audit_id))
    }
  } catch {
    // Owned rows already loaded; shared legs are additive.
  }

  const ownedAudits = ((auditRows ?? []) as unknown as AuditRow[])
  const audits = [...ownedAudits, ...sharedAudits].map((a) => {
    const raw = a.structured_data?.deterministicFindings
    return {
      id: a.id,
      title: a.title?.trim() ? a.title : "Untitled",
      dealType: a.deal_type ?? "generic",
      updatedAt: a.updated_at,
      findings: (Array.isArray(raw) ? raw : []) as RuleResult[],
    }
  })
  const versions = [...((versionRows ?? []) as unknown as VersionRow[]), ...sharedVersions].map((v) => ({
    auditId: v.audit_id,
    status: v.status,
  }))

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <DealRepo rows={buildRepoRows(audits, versions)} />
    </div>
  )
}
