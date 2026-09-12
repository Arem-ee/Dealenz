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
        state === "generating" && "bg-info/10 text-info animate-pulse",
        state === "ai-draft" && "bg-info/10 text-info",
        state === "reviewed" && "bg-warning/15 text-warning-foreground",
        state === "confirmed" && "bg-success/10 text-success",
        className
      )}
    >
      {state === "generating" && (
        <span className="h-1 w-1 rounded-full bg-info animate-pulse" />
      )}
      {state === "ai-draft" && (
        <span className="h-1 w-1 rounded-full bg-info" />
      )}
      {state === "reviewed" && (
        <span className="h-1 w-1 rounded-full bg-warning" />
      )}
      {state === "confirmed" && (
        <span className="h-1 w-1 rounded-full bg-success" />
      )}
      {labels[state]}
    </span>
  )
}
