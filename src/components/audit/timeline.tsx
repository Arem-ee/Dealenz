"use client"

import { cn } from "@/lib/utils"

export interface TimelineEvent {
  id: string
  type: "deal_created" | "input_added" | "risk_analyzed" | "document_generated" | "document_sent" | "document_viewed" | "document_signed"
  label: string
  description?: string
  timestamp: string
  dealId?: string
  dealTitle?: string
}

const eventIcons: Record<TimelineEvent["type"], string> = {
  deal_created: "●",
  input_added: "→",
  risk_analyzed: "◆",
  document_generated: "◇",
  document_sent: "○",
  document_viewed: "◎",
  document_signed: "✓",
}

interface TimelineProps {
  events: TimelineEvent[]
  className?: string
}

export function Timeline({ events, className }: TimelineProps) {
  const sorted = [...events].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )

  if (sorted.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-muted-foreground">
        No activity yet.
      </div>
    )
  }

  return (
    <div className={cn("space-y-0", className)}>
      {sorted.map((event, i) => (
        <div key={event.id} className="flex gap-3 pb-5 last:pb-0 relative">
          {/* Timeline line */}
          {i < sorted.length - 1 && (
            <div className="absolute left-[11px] top-5 bottom-0 w-px bg-border" />
          )}
          {/* Dot */}
          <div className={cn(
            "shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border",
            event.type === "deal_created" && "bg-primary/10 border-primary/20 text-primary",
            event.type === "risk_analyzed" && "bg-risk-medium/10 border-risk-medium/20 text-risk-medium",
            event.type === "document_generated" && "bg-info/10 border-info/20 text-info",
            event.type === "document_signed" && "bg-success/10 border-success/20 text-success",
            !["deal_created", "risk_analyzed", "document_generated", "document_signed"].includes(event.type) && "bg-muted border-border/60 text-muted-foreground"
          )}>
            {eventIcons[event.type]}
          </div>
          {/* Content */}
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">{event.label}</p>
              {event.dealTitle && (
                <span className="text-xs text-muted-foreground/60 truncate">
                  {event.dealTitle}
                </span>
              )}
            </div>
            {event.description && (
              <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
            )}
            <p className="text-[10px] text-muted-foreground/50 mt-0.5">
              {new Date(event.timestamp).toLocaleString(undefined, {
                month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
              })}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
