import { createClient } from "@/lib/supabase/server"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Scale, Clock, User, FileText } from "lucide-react"
import { SplitPane } from "@/components/split-pane"
import { getConsultationRequest } from "@/app/audit/[id]/consultation-actions"

export const dynamic = "force-dynamic"

export default async function LawyerReviewPage({ params, searchParams }: { params: Promise<{ auditId: string }>; searchParams: Promise<{ threadId?: string }> }) {
  const { auditId } = await params
  const { threadId } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: audit } = await supabase.from("audits").select("id, title, deal_type, status, created_at, raw_input").eq("id", auditId).eq("user_id", user.id).maybeSingle()
  if (!audit) notFound()

  const consultRes = await getConsultationRequest(auditId)
  const request = consultRes.success ? (consultRes.request as Record<string, unknown> | null) : null
  const status = (request?.status as string) ?? "none"
  const handoff = request?.handoff_snapshot as Record<string, unknown> | null

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-card">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center gap-3">
          {threadId ? (
            <Link href={`/chat/${threadId}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Back to thread
            </Link>
          ) : (
            <Link href={`/chat/${auditId}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Back to thread
            </Link>
          )}
          <span className="ml-auto text-xs text-muted-foreground">Case file</span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 space-y-6">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2"><Scale className="h-5 w-5 text-primary" /> Lawyer Review</h1>
          <p className="text-sm text-muted-foreground mt-1">Deal: {String((audit as { title?: unknown }).title ?? "")} · {String((audit as { deal_type?: unknown }).deal_type ?? "")}{(audit as { created_at?: unknown }).created_at ? ` · ${new Date(String((audit as { created_at?: unknown }).created_at)).toLocaleDateString()}` : ""}</p>
        </div>

        <SplitPane
          userId={user.id}
          paneKey="lawyer-review"
          defaultSplit={0.6}
          primary={
            <div className="space-y-4 p-1">
              <div className="rounded-xl border bg-card p-4">
                <h3 className="text-sm font-semibold flex items-center gap-2"><FileText className="h-4 w-4" /> Deal context</h3>
                <p className="mt-2  text-sm leading-relaxed whitespace-pre-wrap">{String((audit as { raw_input?: unknown }).raw_input ?? "").slice(0, 800) || "No deal text yet."}</p>
                {handoff && (
                  <div className="mt-3 rounded-lg bg-muted/30 p-3 text-xs">
                    <p className="font-medium">Handoff snapshot</p>
                    <pre className="mt-1 overflow-auto text-[11px]">{JSON.stringify(handoff, null, 2).slice(0, 2000)}</pre>
                  </div>
                )}
              </div>

              <div className="rounded-xl border bg-card p-4">
                <h3 className="text-sm font-semibold">Review status</h3>
                <p className="mt-1 text-xs text-muted-foreground">This case file tracks the lawyer review for this deal. Continue the discussion in your deal thread; status changes are recorded here.</p>
              </div>
            </div>
          }
          panel={
            <div className="space-y-4 p-1">
              <div className="rounded-xl border bg-card p-4">
                <h3 className="text-sm font-semibold flex items-center gap-2"><User className="h-4 w-4" /> Lawyer</h3>
                {request ? (
                  <div className="mt-2 space-y-1">
                    <p className="text-xs"><span className="text-muted-foreground">Status:</span> <span className="font-medium capitalize">{status}</span></p>
                    <p className="text-xs"><span className="text-muted-foreground">Requested:</span> {request.created_at ? new Date(String(request.created_at)).toLocaleString() : "—"}</p>
                    {(request as { request_note?: unknown }).request_note ? <p className="text-xs mt-2 rounded bg-muted p-2">{String((request as { request_note?: unknown }).request_note)}</p> : null}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">No lawyer assigned yet. This view will show the assigned lawyer, review status, and handoff once requested.</p>
                )}
                <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" /> {status === "none" ? "Not yet requested" : status === "waitlist" ? "Waiting for available lawyer" : "In review"}
                </div>
              </div>

              <div className="rounded-xl border bg-card p-4">
                <h3 className="text-sm font-semibold">Review status</h3>
                <p className="mt-1 text-xs text-muted-foreground">This review stays outside the chat. You will be notified when the lawyer responds. Return to the thread via Back to thread.</p>
              </div>
            </div>
          }
        />
      </main>
    </div>
  )
}
