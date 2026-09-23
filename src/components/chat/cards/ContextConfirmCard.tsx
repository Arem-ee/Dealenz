"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ChevronDown } from "lucide-react"
import { optionLabel } from "@/lib/context/options"

export interface ConfirmField {
  key: string
  label: string
  value: string
  confidence: number
  options?: string[] | null
}

// One question at a time, in the quiet interrogation-panel pattern: a small
// "N of M questions" header, the question in semibold, radio rows only when
// the field has a closed vocabulary, a free-text row otherwise, and a
// Dismiss/Submit footer. Options advance on Submit (never on tap), so a
// mis-tap cannot answer for the user.
export function ContextConfirmCard({ payload, onConfirm }: { payload: Record<string, unknown>; onConfirm: (corrections: Record<string, string>) => void }) {
  const fields = (payload.fields as ConfirmField[] | undefined) ?? []
  const [step, setStep] = useState(0)
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [customOpen, setCustomOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

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

  const submit = () => {
    // Empty submit records nothing: an unanswered question is a skip, and
    // the needs-input resume path re-asks only what is still missing.
    if (!options || current.trim().length > 0) {
      advance(current.trim().length > 0 ? { ...edits, [field.key]: current.trim() } : edits, safeStep + 1)
    } else if (customOpen) {
      advance(edits, safeStep + 1)
    }
  }

  const skip = () => {
    advance(edits, safeStep + 1)
  }

  const dismiss = () => {
    onConfirm(edits)
  }

  const back = () => {
    setCustomOpen(false)
    setStep(Math.max(0, safeStep - 1))
  }

  const canSubmit = !options || current.trim().length > 0 || customOpen

  return (
    <div className="rounded-xl border bg-card">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        className="flex w-full items-center justify-between gap-2 px-4 pt-3 text-left"
      >
        <p className="text-[13px] font-semibold tabular-nums" aria-live="polite">
          {safeStep + 1} of {fields.length} questions
        </p>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${collapsed ? "-rotate-90" : ""}`} />
      </button>

      {!collapsed && (
        <div className="px-4 pb-4">
          <p className="mt-2 text-[15px] font-semibold leading-snug">{field.label}</p>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {options ? "Select one answer" : field.value ? `We guessed ${field.value} — confirm or correct it` : "Type your answer"}
          </p>

          {options ? (
            <div className="mt-3 space-y-2" role="radiogroup" aria-label={field.label}>
              {options.map((opt) => {
                const selected = current === opt
                return (
                  <button
                    key={opt}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => {
                      setEdits((s) => ({ ...s, [field.key]: opt }))
                      setCustomOpen(false)
                    }}
                    className={`flex w-full items-center gap-3 rounded-lg border px-3.5 py-2.5 text-left text-sm transition-colors ${
                      selected ? "border-burgundy bg-burgundy/[0.06]" : "border-input bg-background hover:bg-muted/50"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                        selected ? "border-burgundy" : "border-muted-foreground/40"
                      }`}
                    >
                      {selected && <span className="h-2 w-2 rounded-full bg-burgundy" />}
                    </span>
                    <span className="font-medium">{optionLabel(opt)}</span>
                  </button>
                )
              })}
              {!customOpen ? (
                <button
                  type="button"
                  onClick={() => setCustomOpen(true)}
                  className="flex w-full items-center gap-3 rounded-lg border border-input bg-background px-3.5 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted/50"
                >
                  <span aria-hidden className="h-4 w-4 shrink-0 rounded-full border border-muted-foreground/40" />
                  <span>Type your own answer</span>
                </button>
              ) : (
                <input
                  aria-label={`${field.label} (custom)`}
                  placeholder="Type your answer"
                  value={current}
                  onChange={(e) => setEdits((s) => ({ ...s, [field.key]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submit()
                  }}
                  className="h-11 w-full rounded-lg border border-input bg-background px-3.5 text-sm"
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
                if (e.key === "Enter") submit()
              }}
              className="mt-3 h-11 w-full rounded-lg border border-input bg-background px-3.5 text-sm"
            />
          )}

          <div className="mt-4 flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={dismiss}>
              Dismiss
            </Button>
            {safeStep > 0 && (
              <Button size="sm" variant="ghost" onClick={back} className="text-muted-foreground">
                Back
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={skip} className="text-muted-foreground">
              Skip
            </Button>
            <span className="flex-1" />
            <Button size="sm" onClick={submit} disabled={!canSubmit}>
              {isLast ? "Submit" : "Continue"}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
