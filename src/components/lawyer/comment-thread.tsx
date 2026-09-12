"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { addLawyerComment } from "@/app/lawyer/actions"

export interface ThreadComment {
  id: string
  author_role: string
  target_type: string
  target_key: string | null
  body: string
  status: string
  provenance: string
  created_at: string
}

// Review discussion thread. Comments attach to deal objects (finding,
// clause, document, question…); provenance (lawyer vs client) is always
// shown and never mixed. Lawyer opinions stay opinions: they never become
// system facts, rule results, or legal sources.
export function CommentThread({ requestId, comments }: { requestId: string; comments: ThreadComment[] }) {
  const router = useRouter()
  const [body, setBody] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAdd() {
    if (!body.trim()) return
    setBusy(true)
    setError(null)
    try {
      await addLawyerComment(requestId, { targetType: "general", body: body.trim() })
      setBody("")
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add comment")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">Review discussion</h3>
      {comments.length === 0 && (
        <p className="text-xs text-muted-foreground">No comments yet. Notes you add here are visible to the client with lawyer provenance.</p>
      )}
      <ul className="space-y-3">
        {comments.map((c) => (
          <li key={c.id} className="rounded-lg border border-border/60 bg-card p-3">
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${c.provenance === "lawyer" ? "bg-info/10 text-info" : "bg-muted text-muted-foreground"}`}>
                {c.provenance === "lawyer" ? "Lawyer review" : "Client"}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {c.target_type}{c.target_key ? ` · ${c.target_key}` : ""} · {new Date(c.created_at).toLocaleString()} · {c.status}
              </span>
            </div>
            <p className="mt-2 text-sm whitespace-pre-wrap">{c.body}</p>
          </li>
        ))}
      </ul>
      <div className="space-y-2">
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add a review note for the client…" rows={3} />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <Button size="sm" disabled={busy || !body.trim()} onClick={() => void handleAdd()}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Add note
        </Button>
      </div>
    </div>
  )
}
