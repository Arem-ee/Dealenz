import { createClient } from "@/lib/supabase/server"
import { ErrorPanel } from "@/components/ui/error-panel"
import { HomeHero } from "@/components/home/home-hero"
import { HomeContinuation } from "@/components/home/home-continuation"
import { listConversations } from "@/lib/conversation/store"

export const dynamic = "force-dynamic"

type PageProps = { searchParams: Promise<{ error?: string }> }

function getRiskLevel(report: unknown): string | null {
  if (!report || typeof report !== "object") return null
  return (report as Record<string, unknown>).riskLevel as string | null
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const createError = sp.error === "create-failed"

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return <div />

  const [{ data: audits }, conversations] = await Promise.all([
    supabase
      .from("audits")
      .select("id, title, status, risk_report, updated_at, created_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(20),
    listConversations(supabase as never, user.id).catch(() => []),
  ])

  const allAudits = (audits ?? []) as Array<{
    id: string
    title: string
    status: string
    risk_report: unknown
    updated_at: string
    created_at: string
  }>

  const deals = allAudits
    .filter((a) => a.status !== "draft" || a.title !== "New Deal")
    .slice(0, 8)
    .map((a) => ({
      id: a.id,
      title: a.title,
      status: a.status,
      riskLevel: getRiskLevel(a.risk_report),
      updated_at: a.updated_at,
      created_at: a.created_at,
    }))

  const convItems = (conversations as Array<{ id: string; title: string; attached_audit_id: string | null; updated_at: string; created_at: string }>).map((c) => ({
    id: c.id,
    title: c.title,
    attachedAuditId: c.attached_audit_id,
    updatedAt: c.updated_at,
  }))

  return (
    <div className="min-h-[calc(100vh-3rem)] bg-background">
      <div className="px-4 sm:px-6 py-8 sm:py-12 max-w-6xl mx-auto">
        {createError && (
          <div className="mb-6 max-w-[720px] mx-auto">
            <ErrorPanel
              title="We couldn't create your deal."
              body="Your input is safe. Please try again — if this keeps happening, contact support."
              chargeNote="Nothing was charged for this attempt."
              retryLabel="Back to new deal"
              retryHref="/audit/new"
            />
          </div>
        )}

        <HomeHero />

        <HomeContinuation deals={deals} conversations={convItems} />
      </div>
    </div>
  )
}
