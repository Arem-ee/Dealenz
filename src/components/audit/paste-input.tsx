"use client"

import { Loader2, Check, AlertCircle } from "lucide-react"

interface PasteInputProps {
  value: string
  onChange: (text: string) => void
  saveState: "saved" | "unsaved" | "saving" | "error"
}

const MAX_CHARS = 50000

export function PasteInput({ value, onChange, saveState }: PasteInputProps) {
  const charCount = value.length

  const handleChange = (text: string) => {
    if (text.length <= MAX_CHARS) {
      onChange(text)
    }
  }

  const saveIcon = saveState === "saving" ? (
    <Loader2 className="h-3 w-3 animate-spin" />
  ) : saveState === "saved" ? (
    <Check className="h-3 w-3 text-green-600" />
  ) : saveState === "error" ? (
    <AlertCircle className="h-3 w-3 text-destructive" />
  ) : null

  const saveLabel = saveState === "saving" ? "Saving..." :
    saveState === "saved" ? "Saved" :
    saveState === "unsaved" ? "Unsaved changes" :
    "Save failed"

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Paste your content</label>
        <div className="flex items-center gap-2">
          {saveIcon && <span className="text-xs text-muted-foreground">{saveLabel}</span>}
          <span className={`text-xs ${charCount > MAX_CHARS * 0.9 ? "text-destructive" : "text-muted-foreground"}`}>
            {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()}
          </span>
        </div>
      </div>

      <textarea
        className="min-h-[300px] w-full rounded-md border border-input bg-transparent p-4 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
        placeholder="Paste a client brief, email thread, meeting transcript, contract, job post, or RFP content here..."
        value={value}
        onChange={(e) => handleChange(e.target.value)}
      />

      {!value && (
        <div className="flex flex-col items-center gap-2 py-12 text-center border border-dashed rounded-lg">
          <p className="text-sm text-muted-foreground">No content yet</p>
          <p className="text-xs text-muted-foreground">
            Paste client briefs, contracts, emails, transcripts, or job posts above
          </p>
        </div>
      )}

      {charCount >= MAX_CHARS && (
        <p className="text-xs text-destructive">
          Character limit reached
        </p>
      )}
    </div>
  )
}
