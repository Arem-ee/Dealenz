"use client"

import Link from "next/link"
import { Scale } from "lucide-react"
import { Button } from "@/components/ui/button"

export function LawyerRecommendationCard({ payload }: { payload: Record<string, unknown> }) {
  const auditId = payload.auditId as string | undefined
  const threadId = payload.threadId as string | undefined
  const reason = (payload.reason as string) ?? "Meaningful stakes and exposure pattern detected."
  const href = auditId ? (threadId ? `/review/${auditId}?threadId=${threadId}` : `/review/${auditId}`) : "/review"

  return (
    <div className="rounded-xl border bg-amber-50 border-amber-200 p-4">
      <div className="flex items-start gap-2">
        <Scale className="h-4 w-4 text-amber-700 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium text-amber-900">Consider a lawyer review</p>
          <p className="mt-1 text-xs text-amber-800">{reason}</p>
          <p className="mt-1 text-xs text-muted-foreground">This is a recommendation, not a requirement. Many deals close without a lawyer, but this one has stakes that are hard to undo and an exposure that a review could clarify.</p>
        </div>
      </div>
      {auditId && (
        <Button asChild size="sm" className="mt-3">
          <Link href={href}>Open case file</Link>
        </Button>
      )}
    </div>
  )
}
