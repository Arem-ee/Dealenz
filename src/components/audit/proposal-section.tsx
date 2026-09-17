"use client"

import { useState } from "react"
import { Loader2, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { generateProposalForAudit } from "@/app/audit/[id]/proposal-actions"

export function ProposalSection({ auditId }: { auditId: string }) {
  const [proposal, setProposal] = useState<string | null>(null)
  const [evaluation, setEvaluation] = useState<{ gaps: string[] } | null>(null)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGenerate() {
    setGenerating(true)
    setError(null)
    try {
      const res = await generateProposalForAudit(auditId)
      if (!res.success) throw new Error(res.error)
      setProposal(res.proposal)
      setEvaluation(res.evaluation)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed")
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="rounded-xl border bg-card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Proposal</h3>
      </div>
      {!proposal ? (
        <Button onClick={handleGenerate} disabled={generating}>
          {generating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Generate proposal
        </Button>
      ) : (
        <div className="prose prose-sm max-w-none whitespace-pre-wrap border rounded-lg p-4 bg-muted/30">{proposal}</div>
      )}
      {evaluation && evaluation.gaps.length > 0 && (
        <div className="text-xs text-muted-foreground border rounded-lg p-3">
          <p className="font-medium">Unresolved</p>
          <ul className="list-disc pl-4 mt-1">
            {evaluation.gaps.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
