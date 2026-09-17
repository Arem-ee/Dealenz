"use client"

import { useState } from "react"
import { Shield, Loader2, AlertCircle, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { createConsultationRequest } from "@/app/audit/[id]/consultation-actions"

interface EscalationCardProps {
  auditId: string
  dealType?: "freelance" | "generic" | "lease" | "purchase_sale" | "employment" | "founder" | "partnership"
  riskLevel?: "Low" | "Medium" | "High" | "Critical" | null
}

export function LawyerEscalationCard({ auditId, riskLevel }: EscalationCardProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ status: string } | null>(null)
  const [note, setNote] = useState("")

  async function handleRequest() {
    setLoading(true)
    setError(null)
    try {
      const result = await createConsultationRequest(auditId, note)
      if (!result.success || !result.status) {
        setError(result.error ?? "Failed to request consultation")
      } else {
        setSuccess({ status: result.status })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to request consultation")
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="rounded-xl border border-success/25 bg-success/[0.04] p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success/10">
            <CheckCircle2 className="h-5 w-5 text-success" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {success.status === "waitlist" ? "Added to Waitlist" : "Request Submitted"}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {success.status === "waitlist"
                ? "The lawyer network is launching soon. We'll notify you when a lawyer is available to review your deal."
                : "A lawyer will review your deal and reach out shortly."}
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.location.reload()}
              className="mt-3 text-muted-foreground hover:text-foreground"
            >
              Close
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Shield className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold">Want a real lawyer to look at this?</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Our AI analysis catches most risks, but a qualified attorney can give you
            personalized advice and negotiate on your behalf.
          </p>

          <div className="mt-4 space-y-3">
            <Textarea
              placeholder="e.g. I'm worried about the IP clause and want a lawyer to review it before I sign..."
              value={note}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNote(e.target.value)}
              rows={3}
              className="w-full"
            />

            <Button
              onClick={handleRequest}
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Request Lawyer Review"
              )}
            </Button>

            {error && (
              <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              {riskLevel === "High" || riskLevel === "Critical"
                ? "High-risk deals benefit most from attorney review."
                : "A lawyer can help you negotiate better terms and protect your interests."}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}