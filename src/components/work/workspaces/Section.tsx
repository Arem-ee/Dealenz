"use client"

import type { ReactNode } from "react"

// Quiet section primitive for workspaces: hierarchy and spacing carry the
// structure, not cards-in-cards. Matches the restrained work-surface voice.
export function Section({ title, hint, action, children }: {
  title: string
  hint?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="border-b border-border/40 px-4 py-4 sm:px-5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}
