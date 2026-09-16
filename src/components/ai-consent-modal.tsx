"use client"

import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

interface AiConsentModalProps {
  open: boolean
  onConsent: () => void
  onClose: () => void
  consenting: boolean
}

export function AiConsentModal({ open, onConsent, onClose, consenting }: AiConsentModalProps) {
  if (!open) return null
  const handleBackdrop = () => {
    if (consenting) return
    onClose()
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleBackdrop} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-consent-title"
        className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-lg"
      >
        <h2 id="ai-consent-title" className="text-base font-semibold">
          AI Analysis Consent
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Before analyzing your deal, please note that your project information (text and uploaded file
          contents) will be processed by Dealenz AI for this analysis. No data is stored or used beyond
          this analysis.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={consenting}>
            Cancel
          </Button>
          <Button onClick={onConsent} disabled={consenting}>
            {consenting && <Loader2 className="h-4 w-4 animate-spin" />}
            I Understand & Consent
          </Button>
        </div>
      </div>
    </div>
  )
}
