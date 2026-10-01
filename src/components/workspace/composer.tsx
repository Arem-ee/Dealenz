"use client"

import { useState } from "react"
import { ArrowUp, Mic, Plus } from "lucide-react"

// Deal composer, per approved layout: attach left, deal-framed prompt
// center, mic plus send right. Model choice lives here per enterprise
// spec — verdicts stay rule-determined and the active model is logged
// on every finding, so model choice can never buy a PASS.
export function Composer() {
  const [modelOpen, setModelOpen] = useState(false)

  return (
    <div className="shrink-0 border-t border-border bg-background p-3">
      <div className="flex items-center gap-1 border border-border bg-background px-2 py-2">
        <button
          type="button"
          aria-label="Attach files"
          className="flex h-8 w-8 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
        >
          <Plus className="h-4 w-4" />
        </button>
        <input
          aria-label="Describe the deal"
          placeholder="Paste the contract, or say what happened…"
          autoComplete="off"
          className="h-8 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setModelOpen((v) => !v)}
            aria-expanded={modelOpen}
            aria-label="Choose model"
            className="flex h-8 items-center px-2 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
          >
            Model
            <span aria-hidden className="ml-1 text-[10px]">▾</span>
          </button>
          {modelOpen && (
            <div className="absolute bottom-full right-0 z-50 mb-1.5 w-44 border border-border bg-background" aria-label="Model options">
              <p className="px-3 py-2 text-[13px] font-medium">Auto <span className="text-muted-foreground">(recommended)</span></p>
              <p className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">More models wire up with functions.</p>
            </div>
          )}
        </div>
        <button
          type="button"
          aria-label="Dictate"
          className="flex h-8 w-8 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
        >
          <Mic className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Send"
          className="flex h-8 w-8 shrink-0 items-center justify-center bg-primary text-primary-foreground transition-opacity hover:opacity-90"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
