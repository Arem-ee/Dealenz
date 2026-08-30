"use client"

import { cn } from "@/lib/utils"

type DraftState = "generating" | "ai-draft" | "reviewed" | "confirmed"

interface DraftBadgeProps {
  state: DraftState
  className?: string
}

const labels: Record<DraftState, string> = {
  generating: "Generating...",
  "ai-draft": "AI draft",
  reviewed: "Reviewed",
  confirmed: "Confirmed",
}

export function DraftBadge({ state, className }: DraftBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
        state === "generating" && "bg-blue-50 text-blue-700 animate-pulse",
        state === "ai-draft" && "bg-violet-50 text-violet-700",
        state === "reviewed" && "bg-cyan-50 text-cyan-700",
        state === "confirmed" && "bg-emerald-50 text-emerald-700",
        className
      )}
    >
      {state === "generating" && (
        <span className="h-1 w-1 rounded-full bg-blue-500 animate-pulse" />
      )}
      {state === "ai-draft" && (
        <span className="h-1 w-1 rounded-full bg-violet-500" />
      )}
      {state === "reviewed" && (
        <span className="h-1 w-1 rounded-full bg-cyan-500" />
      )}
      {state === "confirmed" && (
        <span className="h-1 w-1 rounded-full bg-emerald-500" />
      )}
      {labels[state]}
    </span>
  )
}
