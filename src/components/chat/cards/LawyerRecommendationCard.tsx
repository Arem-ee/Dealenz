"use client"

import Link from "next/link"
import { Scale } from "lucide-react"
import { Button } from "@/components/ui/button"

export function LawyerRecommendationCard({ payload }: { payload: Record<string, unknown> }) {
  const reason = (payload.reason as string) ?? "Meaningful stakes and exposure pattern detected."

  return (
    <div className="rounded-xl border bg-amber-50 border-amber-200 p-4">
      <div className="flex items-start gap-2">
        <Scale className="h-4 w-4 text-amber-700 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium text-amber-900">
            Lawyer review is coming soon{" "}
            <span className="ml-1 rounded-full bg-amber-200/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900">
              Soon
            </span>
          </p>
          <p className="mt-1 text-xs text-amber-800">{reason}</p>
          <p className="mt-1 text-xs text-muted-foreground">In-app requests are paused until launch — nothing is charged. For high stakes, take the final document to a lawyer of your own.</p>
        </div>
      </div>
      <Button asChild size="sm" variant="outline" className="mt-3">
        <Link href="/dashboard">Continue in your dashboard</Link>
      </Button>
    </div>
  )
}
