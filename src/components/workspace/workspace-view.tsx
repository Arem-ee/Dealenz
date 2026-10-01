"use client"

import { FileText } from "lucide-react"
import { Composer } from "@/components/workspace/composer"

// Deal workspace foreground: chat control on the left, AI work surface on
// the right. Single column on narrow screens, work cards stacking under
// the message that produced them. Classifier routing, analysis, drafts,
// and signing wire up when the workspace gets its functions.
export function WorkspaceView() {
  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <section aria-label="Conversation" className="relative flex min-h-0 min-w-0 flex-1 flex-col border-b border-border lg:border-b-0 lg:border-r">
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 pb-20 pt-12 text-center">
          <FileText className="h-6 w-6 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">Drop the paper here</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
            Attach the contract or Ask below — analysis lands on the right.
          </p>
        </div>
        <Composer />
      </section>
      <section aria-label="Work surface" className="hidden min-h-0 min-w-0 flex-[1.4] flex-col bg-muted/20 lg:flex">
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-12 text-center">
          <p className="text-sm font-medium">Work appears here</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
            Findings, drafts, redlines, and signatures — the artifact dominates, not the chat.
          </p>
        </div>
      </section>
    </div>
  )
}
