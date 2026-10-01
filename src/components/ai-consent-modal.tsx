"use client"

import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

interface AiConsentModalProps {
  open: boolean
  onConsent: () => void
  onClose: () => void
  consenting: boolean
}

// Inline consent panel (no popup): renders in-flow where the action was
// triggered. Same gate, same copy — the overlay is gone.
export function AiConsentModal({ open, onConsent, onClose, consenting }: AiConsentModalProps) {
  if (!open) return null
  return (
    <div className="rounded-none border border-border bg-card p-5" aria-label="AI analysis consent">
      <h2 className="text-base font-semibold">
        AI Analysis Consent
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Before analyzing your deal, please note that your project information (text and uploaded file
        contents) will be processed by Dealenz AI for this analysis. No data is stored or used beyond
        this analysis.
      </p>
      <div className="mt-5 flex justify-end gap-3">
        <Button variant="outline" onClick={onClose} disabled={consenting}>
          Cancel
        </Button>
        <Button onClick={onConsent} disabled={consenting}>
          {consenting && <Loader2 className="h-4 w-4 animate-spin" />}
          I Understand & Consent
        </Button>
      </div>
    </div>
  )
}
