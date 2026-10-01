"use client"

import { useState } from "react"
import { Loader2, PencilLine } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ReviseDealInputProps {
  auditId: string
  threadId: string
  initialText: string
  // Called after the input is saved and a fresh analysis plan is awaiting
  // approval, so the parent can refresh plans and messages.
  onPlanReady: () => void
  onError: (message: string) => void
}

/**
 * Revise deal input affordance: the missing door to redline re-checks.
 * Edits the audit's raw input through updateAudit, then stages a fresh
 * analysis plan (approval still happens explicitly in the plan UI — this
 * component never executes anything itself).
 */
export function ReviseDealInput({ auditId, threadId, initialText, onPlanReady, onError }: ReviseDealInputProps) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState(initialText)
  const [saving, setSaving] = useState(false)

  const openEditor = () => {
    setText(initialText)
    setOpen(true)
  }

  const unchanged = text.trim() === initialText.trim()

  async function handleSave() {
    const revised = text.trim()
    if (!revised || unchanged || saving) return
    setSaving(true)
    try {
      const { updateAudit } = await import("@/app/audit/[id]/actions")
      await updateAudit(auditId, { raw_input: revised })
      const { createDealAnalysisPlan, requestApproval } = await import("@/lib/work/actions")
      const created = await createDealAnalysisPlan({ conversationId: threadId, dealId: auditId })
      if (!created.ok) {
        onError(created.error)
        return
      }
      const appr = await requestApproval(created.planId)
      if (!appr.ok) {
        onError(appr.error)
        return
      }
      setOpen(false)
      onPlanReady()
    } catch {
      // Fixed friendly message: raw action errors cross the boundary as
      // opaque digests, so the thrown text is never shown.
      onError("We couldn't save the revised input. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={openEditor}
        aria-expanded={open}
        className="inline-flex items-center gap-1 rounded-full border bg-muted px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground hover:bg-muted/80"
      >
        <PencilLine className="h-3 w-3" />
        <span>Revise input</span>
      </button>
      {open && (
        <div className="mt-2 rounded-2xl border border-border bg-card p-4" aria-label="Revise deal input">
          <p className="text-sm text-muted-foreground">
            Edit the deal text, then approve the fresh analysis to see what changed: resolved, still open, and new findings.
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            disabled={saving}
            aria-label="Revised deal input"
            className="mt-3 min-h-[160px] w-full resize-y rounded-xl border border-input bg-background px-3 py-2 text-sm leading-relaxed outline-none placeholder:text-muted-foreground/60 disabled:opacity-60"
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Saving stages a new analysis plan. Nothing runs until you approve it.
            </p>
            <div className="flex shrink-0 gap-2">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={() => void handleSave()} disabled={saving || !text.trim() || unchanged}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save & plan re-check
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
