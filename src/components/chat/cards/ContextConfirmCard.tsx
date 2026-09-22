"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { optionLabel } from "@/lib/context/options"

export interface ConfirmField {
  key: string
  label: string
  value: string
  confidence: number
  options?: string[] | null
}

// One question at a time. The old card dumped every missing field with a
// text box each, which read as an interrogation; fields with a closed,
// schema-validated vocabulary now render as native option buttons instead
// of asking the user to type a value we would then reject.
export function ContextConfirmCard({ payload, onConfirm }: { payload: Record<string, unknown>; onConfirm: (corrections: Record<string, string>) => void }) {
  const fields = (payload.fields as ConfirmField[] | undefined) ?? []
  const [step, setStep] = useState(0)
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [customOpen, setCustomOpen] = useState(false)

  if (fields.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-4">
        <p className="text-sm font-medium">Context looks complete</p>
        <p className="mt-1 text-xs text-muted-foreground">Nothing needs confirming before analysis runs.</p>
        <div className="mt-3">
          <Button size="sm" onClick={() => onConfirm({})}>Looks good</Button>
        </div>
      </div>
    )
  }

  const safeStep = Math.min(step, fields.length - 1)
  const field = fields[safeStep]
  const options = Array.isArray(field.options) && field.options.length > 0 ? field.options : null
  const current = edits[field.key] ?? ""
  const isLast = safeStep === fields.length - 1

  const advance = (nextEdits: Record<string, string>, nextStep: number) => {
    setEdits(nextEdits)
    setCustomOpen(false)
    if (nextStep >= fields.length) {
      onConfirm(nextEdits)
    } else {
      setStep(nextStep)
    }
  }

  const choose = (value: string) => {
    const next = { ...edits, [field.key]: value }
    advance(next, safeStep + 1)
  }

  const skip = () => {
    advance(edits, safeStep + 1)
  }

  const back = () => {
    setCustomOpen(false)
    setStep(Math.max(0, safeStep - 1))
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium">Quick check</p>
        <p className="shrink-0 text-[11px] tabular-nums text-muted-foreground" aria-live="polite">
          {safeStep + 1} of {fields.length}
        </p>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-black/[0.07]" aria-hidden>
        <div
          className="h-full rounded-full bg-burgundy transition-all"
          style={{ width: `${Math.round(((safeStep + 1) / fields.length) * 100)}%` }}
        />
      </div>

      <p className="mt-3 text-[13px] font-medium">{field.label}</p>
      {field.value ? (
        <p className="mt-0.5 text-xs text-muted-foreground">We guessed: {field.value}</p>
      ) : (
        <p className="mt-0.5 text-xs text-muted-foreground">We could not tell from what you shared.</p>
      )}

      {options ? (
        <div className="mt-3" role="group" aria-label={field.label}>
          <div className="flex flex-wrap gap-2">
            {options.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => choose(opt)}
                aria-pressed={current === opt}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                  current === opt
                    ? "border-burgundy bg-burgundy text-white"
                    : "border-input bg-background hover:bg-muted"
                }`}
              >
                {optionLabel(opt)}
              </button>
            ))}
          </div>
          {!customOpen ? (
            <button
              type="button"
              onClick={() => setCustomOpen(true)}
              className="mt-2 text-xs font-medium text-muted-foreground underline-offset-2 hover:underline"
            >
              None of these — let me type it
            </button>
          ) : (
            <input
              aria-label={`${field.label} (custom)`}
              placeholder="Type your answer"
              value={current}
              onChange={(e) => setEdits((s) => ({ ...s, [field.key]: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === "Enter") advance({ ...edits }, safeStep + 1)
              }}
              className="mt-2 h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs"
            />
          )}
        </div>
      ) : (
        <input
          aria-label={field.label}
          placeholder={field.value ? `Confirm or correct: ${field.value}` : "Type your answer"}
          defaultValue={field.value}
          onChange={(e) => setEdits((s) => ({ ...s, [field.key]: e.target.value }))}
          onKeyDown={(e) => {
            if (e.key === "Enter") advance({ ...edits }, safeStep + 1)
          }}
          className="mt-3 h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs"
        />
      )}

      <div className="mt-4 flex items-center gap-2">
        {safeStep > 0 && (
          <Button size="sm" variant="outline" onClick={back}>
            Back
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={skip}>
          Skip
        </Button>
        <span className="flex-1" />
        {customOpen || !options ? (
          <Button
            size="sm"
            onClick={() => advance({ ...edits }, safeStep + 1)}
          >
            {isLast ? "Confirm" : "Continue"}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
