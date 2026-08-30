"use client"

import { MessageSquare } from "lucide-react"

interface NegotiationPointsProps {
  points: string[]
}

export function NegotiationPointsView({ points }: NegotiationPointsProps) {
  if (!points || points.length === 0) {
    return (
      <div className="rounded-xl border border-border/60 bg-card p-6 text-center">
        <p className="text-sm text-muted-foreground">No negotiation points were generated for this agreement. Try adding more detail and running the analysis again.</p>
      </div>
    )
  }
  return (
    <div className="rounded-xl border border-border/60 bg-card p-6">
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Questions to raise before signing</h3>
      </div>
      <ul className="space-y-3">
        {points.map((p, i) => (
          <li key={i} className="flex items-start gap-2 text-sm leading-relaxed">
            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
            <span className="text-foreground">{p}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
