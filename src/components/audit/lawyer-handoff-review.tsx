"use client"

import { useState, useMemo } from "react"
import { Shield, FileText, AlertTriangle, Loader2, ExternalLink, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { createConsultationRequest } from "@/app/audit/[id]/consultation-actions"
import type { HandoffPackage } from "@/lib/consultation/handoff"

export function LawyerHandoffReview({
  handoff,
  auditId,
  onClose,
  onSubmitted,
}: {
  handoff: HandoffPackage
  auditId: string
  onClose: () => void
  onSubmitted: (status: string) => void
}) {
  const [note, setNote] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const criticalFindings = useMemo(() => handoff.findings.filter((f) => f.severity === "critical"), [handoff.findings])
  const importantFindings = useMemo(() => handoff.findings.filter((f) => f.severity === "material" || f.severity === "attention"), [handoff.findings])

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)
    try {
      const res = await createConsultationRequest(auditId, note, handoff as unknown as Record<string, unknown>)
      onSubmitted(res.status)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit request")
      setSubmitting(false)
    }
  }

  const jurisdictionLabel = handoff.deal.jurisdiction.country + (handoff.deal.jurisdiction.region ? ` — ${handoff.deal.jurisdiction.region}` : "")
  const hasMissing = handoff.missingInformation.length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-card p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold">Have a lawyer review this deal</h2>
            <p className="mt-1 text-xs text-muted-foreground">Dealenz has organized the deal, identified material issues, and prepared protection context for review. The lawyer receives structured context — not just raw text.</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-4 space-y-4 text-xs">
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="font-medium">Deal — what will be shared</p>
            <p className="mt-1">
              <span className="font-medium">Type:</span> {handoff.deal.dealType} · <span className="font-medium">Jurisdiction:</span> {jurisdictionLabel}
              {hasMissing && <span className="ml-2 text-warning-foreground">Missing: {handoff.missingInformation.slice(0, 4).join(", ")}{handoff.missingInformation.length > 4 ? "…" : ""}</span>}
            </p>
            {handoff.deal.title && <p className="text-muted-foreground">{handoff.deal.title}</p>}
          </div>

          <div>
            <h3 className="font-semibold">Key issues — important / critical findings</h3>
            {handoff.findings.length === 0 ? (
              <p className="mt-1 text-muted-foreground">No critical findings were raised for this deal. All checked terms appear addressed, but a lawyer can still confirm.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {[...criticalFindings, ...importantFindings].slice(0, 5).map((f) => (
                  <li key={f.ruleKey} className="rounded border p-2">
                    <p className="font-medium">
                      {f.severity}: {f.summary}
                    </p>
                    {f.guidance && <p className="text-muted-foreground">{f.guidance}</p>}
                    {f.evidence.slice(0, 1).map((e) => (
                      <p key={e.id} className="mt-1 text-muted-foreground">
                        “{e.quote}” — {e.observationKey}
                      </p>
                    ))}
                  </li>
                ))}
                {handoff.findings.length > 5 && <p className="text-muted-foreground">+{handoff.findings.length - 5} more findings included in the package.</p>}
              </ul>
            )}
          </div>

          <div>
            <h3 className="font-semibold">Protection — what to negotiate</h3>
            {handoff.protectionIntents.length === 0 ? (
              <p className="mt-1 text-muted-foreground">No protection priorities were raised.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {handoff.protectionIntents.slice(0, 6).map((intent) => (
                  <li key={intent.id} className="rounded border p-2">
                    <p className="font-medium">
                      {intent.title} — <span className="capitalize">{intent.priority}</span>
                    </p>
                    <p>{intent.recommendation}</p>
                    <p className="text-muted-foreground">{intent.rationale}</p>
                    {intent.legalContext && (
                      <p className="mt-1">
                        Legal: {intent.legalContext.title} — {intent.legalContext.section}{" "}
                        {intent.legalContext.url && (
                          <a href={intent.legalContext.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                            <ExternalLink className="ml-1 inline h-3 w-3" />
                          </a>
                        )}
                      </p>
                    )}
                    {intent.variables.length > 0 && <p className="text-warning-foreground">Needs input: {intent.variables.join(", ")} — UNKNOWN</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 className="font-semibold">Evidence & legal context</h3>
            <p className="mt-1">
              {handoff.evidence.length} evidence {handoff.evidence.length === 1 ? "item" : "items"} · {handoff.legalCitations.length} legal citation{handoff.legalCitations.length === 1 ? "" : "s"}
            </p>
            {handoff.evidence.slice(0, 2).map((e) => (
              <p key={e.id} className="mt-1 text-muted-foreground">
                “{e.quote}” — {e.observationKey} ({e.location.kind})
              </p>
            ))}
            {handoff.legalCitations.slice(0, 2).map((c) => (
              <div key={c.sourceId} className="mt-1 rounded border p-2">
                <p className="font-medium">
                  {c.title} — {c.section}
                </p>
                <p className="text-muted-foreground">“{c.passage}”</p>
                {c.url && (
                  <a href={c.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                    {c.url}
                  </a>
                )}
                <p className="text-muted-foreground">
                  {c.jurisdiction} · Tier {c.authorityTier} · {c.effectiveStatus} · retrieved {c.retrievedAt.slice(0, 10)}
                </p>
              </div>
            ))}
            {handoff.legalCitations.length === 0 && <p className="mt-1 text-muted-foreground">No verified legal sources matched this deal — honest limitation, not invented law. The lawyer will still receive deal facts and findings.</p>}
          </div>

          <div>
            <h3 className="font-semibold">Document</h3>
            {handoff.documentDraft ? (
              <div className="mt-1 rounded border p-2">
                <p className="font-medium flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5" />
                  {handoff.documentDraft.title} — {handoff.documentDraft.familyId}
                </p>
                <p className="text-muted-foreground">Missing: {handoff.documentDraft.missingVariables.length > 0 ? handoff.documentDraft.missingVariables.join(", ") : "none"}</p>
                <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-muted-foreground">{handoff.documentDraft.markdown.slice(0, 400)}…</p>
                <p className="mt-1 text-[11px] text-muted-foreground">Drafting assistance, not a determination of enforceability.</p>
              </div>
            ) : (
              <p className="mt-1 text-muted-foreground">No document draft yet — the lawyer will still receive findings, protection plan, and legal context. You can generate a draft from the Documents section.</p>
            )}
          </div>

          {hasMissing && (
            <div className="flex items-start gap-2 rounded-lg bg-warning/10 border border-warning/25 p-2 text-warning-foreground">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <p>Missing information will be shared as UNKNOWN (e.g. {handoff.missingInformation.slice(0, 3).join(", ")}). We never invent these values.</p>
            </div>
          )}

          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="font-medium flex items-center gap-2">
              <Shield className="h-3.5 w-3.5" />
              What the lawyer receives
            </p>
            <p className="mt-1 text-muted-foreground">Structured snapshot: deal type, jurisdiction, facts, findings with evidence, risk, protection intents, selected clauses, document draft (if any), legal citations/provenance, missing information, and your note. No re-analysis. Evidence and veracity (VERIFIED/SUPPORTED/STALE/UNVERIFIED/NOT_FOUND/CONFLICTING) are preserved.</p>
          </div>

          <div>
            <label htmlFor="handoff-note" className="font-medium">
              Add a note for the lawyer (optional)
            </label>
            <Textarea id="handoff-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="e.g. I'm worried about the IP clause and vesting. This is a US Delaware C-Corp, not Nigeria." className="mt-1" />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-2 text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={handleSubmit} disabled={submitting} className="flex-1">
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Shield className="mr-2 h-4 w-4" />}
              Submit for lawyer review
            </Button>
            <Button variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
          </div>
          <p className="text-center text-[11px] text-muted-foreground">Dealenz does not provide legal advice. A lawyer has not yet reviewed this deal. Submitting creates a consultation request (or waitlist if no lawyer is available).</p>
        </div>
      </div>
    </div>
  )
}
