"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

export function ContextConfirmCard({ payload, onConfirm }: { payload: Record<string, unknown>; onConfirm: (corrections: Record<string, string>) => void }) {
  const fields = (payload.fields as Array<{ key: string; label: string; value: string; confidence: number }>) ?? []
  const [edits, setEdits] = useState<Record<string, string>>({})

  if (fields.length === 0) return null

  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-sm font-medium">Quick check — is this right?</p>
      <p className="mt-1 text-xs text-muted-foreground">We pulled these from what you shared. Confirm or fix just the ones that look wrong.</p>
      <div className="mt-3 space-y-2">
        {fields.map((f) => (
          <div key={f.key} className="flex items-center gap-2 rounded-lg border p-2.5">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium">{f.label}</p>
              <p className="text-xs text-muted-foreground truncate">{f.value || "Not sure yet — we'll flag it"}</p>
            </div>
            <input
              aria-label={`Correct ${f.label}`}
              placeholder="Correct if needed"
              value={edits[f.key] ?? ""}
              onChange={(e) => setEdits((s) => ({ ...s, [f.key]: e.target.value }))}
              className="h-7 w-32 rounded-md border bg-background px-2 text-xs"
            />
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <Button size="sm" onClick={() => onConfirm(edits)}>Yes, these look right</Button>
        <Button size="sm" variant="outline" onClick={() => onConfirm(edits)}>Confirm with edits</Button>
      </div>
    </div>
  )
}
