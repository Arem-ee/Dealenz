"use client"

import type { OpenItem } from "./types"

// Compact unresolved-items list shared by workspaces. Counts come from the
// same deterministic computation as the conversation column.
export function OpenItemsList({ items, counts }: {
  items: OpenItem[]
  counts: { total: number; critical: number; material: number; attention: number; informational: number }
}) {
  if (counts.total === 0) {
    return <p className="text-xs text-muted-foreground">No unresolved items. Everything found so far is accounted for.</p>
  }
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {counts.total} unresolved{counts.critical > 0 ? ` · ${counts.critical} fix before signing` : ""}{counts.material > 0 ? ` · ${counts.material} should fix` : ""}
      </p>
      {items.slice(0, 8).map((item) => (
        <div key={item.id} className="rounded-lg border px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium">{item.title}</span>
            <span className="text-[10px] uppercase text-muted-foreground">{item.severity}</span>
          </div>
          {item.summary && <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{item.summary}</p>}
        </div>
      ))}
      {items.length > 8 && (
        <p className="text-xs text-muted-foreground">Plus {items.length - 8} more in the conversation.</p>
      )}
    </div>
  )
}
