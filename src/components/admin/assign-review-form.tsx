"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { assignLawyer } from "@/app/lawyer/actions"

interface AssignableLawyer {
  id: string
  full_name: string
}

// Admin-only assignment control: pairs one pending review with one verified
// lawyer. Rendered only on the admin page (which itself requires an admin
// session); the server action re-validates admin, lawyer, and transition.
export function AssignReviewForm({ requestId, lawyers }: { requestId: string; lawyers: AssignableLawyer[] }) {
  const router = useRouter()
  const [lawyerId, setLawyerId] = useState(lawyers[0]?.id ?? "")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (lawyers.length === 0) {
    return <p className="text-xs text-muted-foreground">No verified lawyers available.</p>
  }

  async function handleAssign() {
    if (!lawyerId) return
    setBusy(true)
    setError(null)
    try {
      await assignLawyer(requestId, lawyerId)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Assignment failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={lawyerId}
        onChange={(e) => setLawyerId(e.target.value)}
        className="h-8 rounded-md border border-input bg-background px-2 text-xs"
        aria-label="Assign verified lawyer"
      >
        {lawyers.map((l) => (
          <option key={l.id} value={l.id}>{l.full_name}</option>
        ))}
      </select>
      <Button size="sm" disabled={busy || !lawyerId} onClick={() => void handleAssign()}>
        {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
        Assign
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
