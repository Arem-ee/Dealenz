"use client"

import { useState, useMemo, useEffect } from "react"
import { Loader2, FileText, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { familiesForDealType } from "@/lib/documents/families"
import { generateBusinessOwnerDraft } from "@/app/audit/[id]/actions"
import { AiConsentModal } from "@/components/ai-consent-modal"
import { useAiConsent } from "@/hooks/use-ai-consent"
import type { DraftDocument } from "@/lib/documents/types"
import { renderMarkdown } from "@/lib/markdown"
import { LegalCitationLine } from "@/components/evidence/legal-citation-line"

export function BusinessOwnerDocumentSection({
  auditId,
  dealType,
  initialJurisdiction,
}: {
  auditId: string
  dealType: string
  initialJurisdiction?: string | null
}) {
  const families = useMemo(() => familiesForDealType(dealType), [dealType])
  const [familyId, setFamilyId] = useState<string>(families[0]?.id ?? "")
  const [jurisdiction, setJurisdiction] = useState<string>(initialJurisdiction ?? "")
  const [variables, setVariables] = useState<Record<string, string>>({})
  const [draft, setDraft] = useState<DraftDocument | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    if (initialJurisdiction && !jurisdiction) {
      setJurisdiction(initialJurisdiction)
    }
  }, [initialJurisdiction])
  const { consented: aiConsented, consenting, grant: grantConsent } = useAiConsent()
  const [showConsentModal, setShowConsentModal] = useState(false)
  const [pendingGenerate, setPendingGenerate] = useState(false)

  if (families.length === 0) return null

  const selectedFamily = families.find((f) => f.id === familyId) ?? families[0]
  const jurisdictionMissing = !jurisdiction.trim()
  const partnershipStructureMissing = dealType === "partnership" && !(variables.partnership_structure ?? "").trim()
  const canGenerate = !jurisdictionMissing && !partnershipStructureMissing

  async function doGenerate() {
    setGenerating(true)
    setError(null)
    setDraft(null)
    try {
      const res = await generateBusinessOwnerDraft(auditId, familyId, jurisdiction, variables)
      if (res.success && res.draft) {
        setDraft(res.draft)
      } else if (res.error?.includes("CONSENT_REQUIRED")) {
        setPendingGenerate(true)
        setShowConsentModal(true)
      } else {
        setError(res.error ?? "Generation failed")
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Generation failed"
      if (msg.includes("CONSENT_REQUIRED")) {
        setPendingGenerate(true)
        setShowConsentModal(true)
      } else {
        setError(msg)
      }
    } finally {
      setGenerating(false)
    }
  }

  async function handleGenerate() {
    if (aiConsented === false) {
      setPendingGenerate(true)
      setShowConsentModal(true)
      return
    }
    if (aiConsented === null) {
      const { getAiConsentStatus: fetchStatus } = await import("@/lib/ai-consent")
      const fresh = await fetchStatus().catch(() => false)
      if (!fresh) {
        setPendingGenerate(true)
        setShowConsentModal(true)
        return
      }
    }
    await doGenerate()
  }

  async function handleConsentConfirm() {
    const ok = await grantConsent()
    if (!ok) {
      setError("Failed to save consent. Please try again.")
      return
    }
    setShowConsentModal(false)
    if (pendingGenerate) {
      await doGenerate()
      setPendingGenerate(false)
    }
  }

  const handleConsentDismiss = () => {
    if (consenting) return
    setShowConsentModal(false)
    setPendingGenerate(false)
  }

  return (
    <div className="space-y-4 rounded-xl border border-border/60 bg-card p-5">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Create document</h3>
        <span className="rounded-full bg-info/10 px-2 py-0.5 text-[10px] font-medium text-info">International</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Select a document family and jurisdiction. Missing information stays as <code className="rounded bg-muted px-1">{"{{var}}"}</code> — we never invent it.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="family">Document family</Label>
          <select id="family" value={familyId} onChange={(e) => setFamilyId(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
            {families.map((f) => (
              <option key={f.id} value={f.id}>
                {f.title}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">{selectedFamily?.description}</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="jurisdiction">Jurisdiction — country <span className="text-destructive">*</span></Label>
          <select
            id="jurisdiction"
            value={jurisdiction}
            onChange={(e) => setJurisdiction(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            required
            aria-required="true"
          >
            <option value="">Select jurisdiction…</option>
            <option value="United States">United States</option>
            <option value="United Kingdom">United Kingdom</option>
            <option value="Germany">Germany</option>
            <option value="France">France</option>
            <option value="Netherlands">Netherlands</option>
            <option value="Nigeria">Nigeria</option>
            <option value="Testland">Testland — synthetic fixture (proves neutrality, no real coverage)</option>
          </select>
          <p className="text-xs text-muted-foreground">Jurisdiction is legally material and must be explicit. Testland has no real legal coverage.</p>
        </div>
      </div>

      <div className="space-y-3">
        <Label>Variables (leave blank if unknown)</Label>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="var-company">Company / partnership name</Label>
            <Input id="var-company" placeholder="e.g. Acme Ltd or Acme LLP" value={variables.company_name ?? ""} onChange={(e) => setVariables((v) => ({ ...v, company_name: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="var-founders">Founder / partner names</Label>
            <Input id="var-founders" placeholder="e.g. Alice, Bob" value={variables.founder_names ?? variables.partner_names ?? ""} onChange={(e) => setVariables((v) => ({ ...v, founder_names: e.target.value, partner_names: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="var-ownership">Ownership / profit split</Label>
            <Input id="var-ownership" placeholder="e.g. 60/40" value={variables.ownership_percentages ?? variables.profit_percentages ?? ""} onChange={(e) => setVariables((v) => ({ ...v, ownership_percentages: e.target.value, profit_percentages: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="var-vesting">Vesting period</Label>
            <Input id="var-vesting" placeholder="e.g. 4 years" value={variables.vesting_period ?? ""} onChange={(e) => setVariables((v) => ({ ...v, vesting_period: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="var-cliff">Cliff</Label>
            <Input id="var-cliff" placeholder="e.g. 12 months" value={variables.cliff ?? ""} onChange={(e) => setVariables((v) => ({ ...v, cliff: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="var-structure">Partnership structure (if partnership) <span className="text-destructive">*</span></Label>
            <select id="var-structure" value={variables.partnership_structure ?? ""} onChange={(e) => setVariables((v) => ({ ...v, partnership_structure: e.target.value }))} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" required aria-required="true">
              <option value="">Select structure…</option>
              <option value="UNKNOWN">UNKNOWN — ask for clarification</option>
              <option value="ordinary partnership">Ordinary partnership</option>
              <option value="LLP">LLP</option>
              <option value="LP">LP</option>
              <option value="company">Company</option>
            </select>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Unknown stays as <code>{"{{var}}"}</code>. Do not invent percentages, dates, or names.</p>
      </div>

      <Button onClick={handleGenerate} disabled={generating || !canGenerate} className="w-full sm:w-auto" title={!canGenerate ? "Select required fields above" : undefined}>
        {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
        Generate draft
      </Button>
      {!canGenerate && !generating && (
        <p className="text-xs text-muted-foreground">
          {jurisdictionMissing ? "Jurisdiction is required." : "Partnership structure is required."}
        </p>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-xs text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <AiConsentModal open={showConsentModal} consenting={consenting} onConsent={() => void handleConsentConfirm()} onClose={handleConsentDismiss} />

      {draft && (
        <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">{draft.title}</h4>
            <span className="text-xs text-muted-foreground">{draft.missingVariables.length} missing</span>
          </div>
          {draft.missingVariables.length > 0 && (
            <p className="text-xs text-warning-foreground">Missing: {draft.missingVariables.join(", ")} — UNKNOWN. Provide these to complete the draft.</p>
          )}
          <div className="prose prose-sm max-w-none rounded-lg border bg-card p-4">{renderMarkdown(draft.markdown)}</div>
          <div className="space-y-1 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Provenance</p>
            <p>
              {draft.provenance.dealType} · {draft.provenance.jurisdiction.country} · {draft.provenance.protectionIntents.length} intents · {draft.provenance.clauses.length} clauses · {draft.citations.length} citations
            </p>
            {draft.citations.slice(0, 2).map((c) => (
              <div key={c.sourceId}>
                <LegalCitationLine citation={c} />
              </div>
            ))}
            <p>This draft is drafting assistance, not a determination of enforceability.</p>
          </div>
        </div>
      )}
    </div>
  )
}
