import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { WorkspaceClient } from "@/components/audit/workspace-client"

export const dynamic = "force-dynamic"

interface AuditPageProps {
  params: Promise<{ id: string }>
}

export default async function AuditPage({ params }: AuditPageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  if (!user.email_confirmed_at) {
    redirect("/dashboard")
  }

  const { id } = await params

  const { data: audit } = await supabase
    .from("audits")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single()

  if (!audit) {
    notFound()
  }

  const { data: rawEvents } = await supabase
    .from("activity_events")
    .select("id, event_type, payload, created_at")
    .eq("user_id", user.id)
    .eq("audit_id", id)
    .order("created_at", { ascending: false })
    .limit(100)

  const activityEvents = (rawEvents ?? []).map((e) => ({
    id: e.id as string,
    event_type: e.event_type as string,
    payload: (e.payload as Record<string, unknown>) ?? {},
    created_at: e.created_at as string,
  }))

  const { count: versionCount } = await supabase
    .from("document_versions")
    .select("id", { count: "exact", head: true })
    .eq("audit_id", id)
    .eq("user_id", user.id)

  return (
    <WorkspaceClient
      audit={audit}
      userId={user.id}
      activityEvents={activityEvents}
      hasVersions={(versionCount ?? 0) > 0}
    />
  )
}
