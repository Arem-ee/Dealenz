import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Timeline, type TimelineEvent } from "@/components/audit/timeline"

export const dynamic = "force-dynamic"

const TYPE_LABELS: Record<string, string> = {
  deal_created: "Deal created",
  input_added: "Client brief added",
  analysis_started: "Risk analysis started",
  analysis_completed: "Risk analysis completed",
  analysis_failed: "Risk analysis failed",
  documents_generated: "Protection package generated",
  status_changed: "Status changed",
  title_changed: "Title changed",
  file_attached: "File attached",
  risk_flag_raised: "Risk flag raised",
  checklist_item_updated: "Checklist item updated",
}

const TYPE_MAP: Record<string, TimelineEvent["type"]> = {
  deal_created: "deal_created",
  input_added: "input_added",
  analysis_started: "risk_analyzed",
  analysis_completed: "risk_analyzed",
  analysis_failed: "risk_analyzed",
  documents_generated: "document_generated",
  status_changed: "deal_created",
  title_changed: "deal_created",
  file_attached: "input_added",
  document_viewed: "document_generated",
  document_reviewed: "document_generated",
  risk_flag_raised: "risk_analyzed",
  checklist_item_updated: "document_generated",
}

export default async function ActivityPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: eventsData } = await supabase
    .from("activity_events")
    .select("id, event_type, payload, audit_id, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50)

  const all = eventsData ?? []

  const events: TimelineEvent[] = all.map((e) => {
    const payload = e.payload as Record<string, unknown> ?? {}
    return {
      id: e.id,
      type: TYPE_MAP[e.event_type] ?? "deal_created",
      label: TYPE_LABELS[e.event_type] ?? e.event_type,
      description: payload.score ? `Score ${payload.score}/100 — ${payload.riskLevel}` : undefined,
      timestamp: e.created_at,
      dealId: e.audit_id ?? undefined,
      dealTitle: payload.title as string | undefined,
    }
  })

  return (
    <div className="px-4 sm:px-6 py-5 sm:py-7 max-w-3xl mx-auto">
      <div>
        <h1 className="text-lg font-semibold">Activity</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Every event across all your deals
        </p>
      </div>

      <div className="mt-6">
        {events.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="text-sm font-medium">Nothing&apos;s happened yet.</p>
            <p className="text-xs text-muted-foreground max-w-sm">
              Once you start a deal, every step gets logged here automatically —
              useful if a client ever disputes what was agreed.
            </p>
          </div>
        ) : (
          <Timeline events={events} />
        )}
      </div>
    </div>
  )
}
