"use client"

import { FlaskConical, Plus } from "lucide-react"

// Prompt Lab foreground: layout and states only. Saved, versioned prompts
// with run history and test runs wire up when the tab gets its functions.
export function LabView() {
  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col overflow-y-auto px-4 pb-6 sm:px-6">
      <div className="flex shrink-0 items-end justify-between gap-3 pb-4 pt-6">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-foreground">Prompt Lab</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Saved prompts, tested before they touch a deal.
          </p>
        </div>
        <span className="inline-flex h-9 shrink-0 items-center gap-1.5 bg-primary px-4 text-xs font-semibold text-primary-foreground opacity-40" aria-disabled="true">
          <Plus className="h-3.5 w-3.5" />
          New prompt
        </span>
      </div>

      <section aria-label="Saved prompts" className="shrink-0">
        <h2 className="text-sm font-semibold">Saved prompts</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Versioned, reusable, with run history each.
        </p>
        <div className="mt-2 border border-dashed px-4 py-10 text-center">
          <FlaskConical className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">No saved prompts yet</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
            Prompts save here with versions and history. Saving and versioning wire up with this tab&apos;s functions.
          </p>
        </div>
      </section>

      <section aria-label="Test run" className="mt-6 shrink-0">
        <h2 className="text-sm font-semibold">Test run</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Try a prompt against sample input before trusting it.
        </p>
        <div className="mt-2 border border-dashed px-4 py-10 text-center">
          <p className="text-sm font-medium">Pick a prompt to run</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
            Test runs wire up with this tab&apos;s functions.
          </p>
        </div>
      </section>
    </div>
  )
}
