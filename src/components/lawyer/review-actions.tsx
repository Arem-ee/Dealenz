"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  acceptReview,
  declineReview,
  beginReview,
  completeReview,
} from "@/app/lawyer/actions"

// Lawyer lifecycle buttons. Every transition is validated server-side
// (actor + from-state); the UI only triggers intent.
export function ReviewLifecycleButtons({ requestId, status }: { requestId: string; status: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(label)
    setError(null)
    try {
      await fn()
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {status === "matched" && (
          <>
            <Button size="sm" disabled={busy !== null} onClick={() => void run("accept", () => acceptReview(requestId))}>
              {busy === "accept" ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Accept review
            </Button>
            <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void run("decline", () => declineReview(requestId))}>
              Decline
            </Button>
          </>
        )}
        {status === "accepted" && (
          <Button size="sm" disabled={busy !== null} onClick={() => void run("begin", () => beginReview(requestId))}>
            {busy === "begin" ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Begin review
          </Button>
        )}
        {(status === "accepted" || status === "in_progress" || status === "changes_requested" || status === "client_review") && (
          <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void run("complete", () => completeReview(requestId))}>
            Mark completed
          </Button>
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
