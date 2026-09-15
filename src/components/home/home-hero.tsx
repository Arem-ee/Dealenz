"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowUp, FileUp, MessageCircle, Sparkles, Loader2, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { askQuestionAction } from "@/app/ask/actions"
import { getConsultantEntryPricing, type ConsultantEntryPricing } from "@/app/consultant/actions"
import { createHomeDeal } from "@/app/dashboard/home-actions"
import { publicErrorMessage } from "@/lib/safe-error"

function looksLikeQuestion(text: string): boolean {
  const t = text.trim().toLowerCase()
  if (!t) return false
  if (t.endsWith("?")) return true
  if (t.startsWith("what ") || t.startsWith("can you") || t.startsWith("could you") || t.startsWith("explain") || t.startsWith("how ") || t.startsWith("why ") || t.startsWith("should i")) return true
  if (t.includes("what is") || t.includes("what does") || t.includes("explain this") || t.includes("can you explain")) return true
  return false
}

const EXAMPLES = [
  "I'm about to sign a freelance contract for $4,000.",
  "My landlord sent me this amendment.",
  "Can you explain this indemnity clause?",
]

const JURISDICTIONS = [
  "United States",
  "United Kingdom",
  "Germany",
  "France",
  "Netherlands",
  "Nigeria",
]

export function HomeHero({ onExample }: { onExample?: (text: string) => void }) {
  const router = useRouter()
  const [value, setValue] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [jurisdiction, setJurisdiction] = useState("")
  const [choosingJurisdiction, setChoosingJurisdiction] = useState(false)
  const [pricing, setPricing] = useState<ConsultantEntryPricing | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const hasContent = value.trim().length > 0
  const isDealPath = hasContent && !looksLikeQuestion(value)

  useEffect(() => {
    if (!isDealPath) {
      setPricing(null)
      return
    }
    const current = value
    const timer = setTimeout(() => {
      void getConsultantEntryPricing(current)
        .then((result) => setPricing(result))
        .catch(() => setPricing(null))
    }, 400)
    return () => clearTimeout(timer)
  }, [value, isDealPath])

  async function handleSubmit() {
    const text = value.trim()
    if (!text || sending) return
    setSending(true)
    setError(null)
    const isQuestion = looksLikeQuestion(text)
    try {
      if (isQuestion) {
        const res = await askQuestionAction({ text, idempotencyKey: crypto.randomUUID() })
        const id = (res as { conversationId?: string }).conversationId
        if (id) router.push(`/ask?conversation=${encodeURIComponent(id)}`)
        else router.push("/ask")
      } else {
        const { id } = await createHomeDeal(text, jurisdiction || undefined)
        router.push(`/audit/${id}`)
      }
    } catch (err) {
      setError(publicErrorMessage(err, "We couldn't start that. Please try again."))
      setSending(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      void handleSubmit()
    }
  }

  return (
    <div className="mx-auto max-w-[720px] w-full">
      <div className="text-center">
        <h1 className="text-[2rem] sm:text-[2.5rem] font-semibold tracking-tight text-foreground leading-tight">
          What are you working on?
        </h1>
        <p className="mt-2 text-sm sm:text-base text-muted-foreground">
          Bring what you are dealing with and Dealenz will point to what matters.
        </p>
      </div>

      <div className="mt-7 rounded-2xl border border-border/60 bg-card shadow-raised overflow-hidden">
        <div className="p-4 sm:p-5">
          <label htmlFor="home-input" className="sr-only">Tell Dealenz what you are dealing with</label>
          <textarea
            id="home-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tell Dealenz what you're dealing with..."
            rows={3}
            aria-label="Tell Dealenz what you're dealing with"
            className="w-full min-h-[88px] resize-none bg-transparent text-base leading-relaxed placeholder:text-muted-foreground/60 outline-none"
          />
        </div>

        <div className="flex items-center gap-2 px-3 py-3 border-t border-border/60 bg-muted/20">
          <input ref={fileRef} type="file" className="hidden" accept=".pdf,.docx,.txt" onChange={() => {
            const f = fileRef.current?.files?.[0]
            if (f) router.push("/audit/new")
          }} />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            aria-label="Add a document"
            className="inline-flex items-center gap-1.5 rounded-full border border-input bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <FileUp className="h-3.5 w-3.5" />
            Add a document
          </button>
          <span className="hidden sm:inline-flex items-center gap-1 text-xs text-muted-foreground/60">
            <Sparkles className="h-3 w-3" />
            Enter to send · Shift+Enter for new line
          </span>
          <div className="ml-auto flex items-center gap-2">
            {isDealPath && pricing ? (
              <span className="text-xs text-muted-foreground" aria-live="polite">
                {pricing.cost === 0
                  ? "Free"
                  : pricing.isFree
                    ? `Free first turn · ${pricing.freeTurnsRemaining} of ${pricing.freeTurnsLimit} left`
                    : `First turn: ${pricing.cost} credit${pricing.cost === 1 ? "" : "s"} · free turns used`}
              </span>
            ) : null}
            {error && <span role="alert" className="text-xs text-destructive max-w-[180px] truncate">{error}</span>}
            <Button
              size="icon"
              onClick={handleSubmit}
              disabled={!hasContent || sending}
              aria-label={sending ? "Working" : "Send to Dealenz"}
              className="h-9 w-9 rounded-full"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => setValue(ex)}
            className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            {ex}
          </button>
        ))}
        <button
          type="button"
          onClick={() => router.push("/ask")}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <MessageCircle className="h-3 w-3" />
          Just asking
        </button>
      </div>

      <div className="mt-2 flex justify-center">
        {choosingJurisdiction ? (
          <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            <span>Jurisdiction:</span>
            <select
              value={jurisdiction}
              onChange={(e) => {
                setJurisdiction(e.target.value)
                setChoosingJurisdiction(false)
              }}
              onBlur={() => setChoosingJurisdiction(false)}
              autoFocus
              className="h-7 rounded-md border border-input bg-card px-2 text-xs text-foreground outline-none"
            >
              <option value="">Auto-detect</option>
              {JURISDICTIONS.map((j) => (
                <option key={j} value={j}>
                  {j}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <button
            type="button"
            onClick={() => setChoosingJurisdiction(true)}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground/70 hover:text-foreground transition-colors"
          >
            <MapPin className="h-3 w-3" />
            Jurisdiction: {jurisdiction || "auto-detect"} · change
          </button>
        )}
      </div>

      <p className="mt-4 text-center text-xs text-muted-foreground/70">
        Dealenz routes your input to the right workflow. No credits used until you analyze or ask deeply.
      </p>
    </div>
  )
}
