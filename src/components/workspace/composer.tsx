"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowUp, Loader2, Mic, MicOff, Plus, RotateCcw, X } from "lucide-react"
import { appendMaterial, askQuestion, attachFiles, createDeal, mintUploadUrls } from "@/app/(app)/chat/actions"
import {
  ACCEPT_STRING,
  MAX_INTAKE_FILES,
  validateStagedFile,
} from "@/lib/deals/intake"

export type ComposerMode =
  | { kind: "new" }
  | { kind: "thread"; threadId: string; auditId: string | null }

interface Staged {
  id: string
  file: File
  problem: string | null
  status: "staged" | "uploading" | "uploaded" | "attached" | "error"
  percent: number
  path: string | null
  error: string | null
}

function putWithProgress(url: string, file: File, onProgress: (pct: number) => void, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("PUT", url)
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream")
    signal.addEventListener("abort", () => xhr.abort(), { once: true })
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100)
        resolve()
      } else {
        reject(new Error(`Upload failed (HTTP ${xhr.status})`))
      }
    }
    xhr.onerror = () => reject(new Error("Upload failed — check your connection."))
    xhr.onabort = () => reject(new Error("Upload cancelled."))
    xhr.send(file)
  })
}

// Deal composer: attach (+) left, Ask center, mic plus send right, Model
// picker included. Text, staged files with real-byte progress and retry,
// then create (new deals) or append (threads). Nothing analyzes yet.
export function Composer({ mode }: { mode: ComposerMode }) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const [text, setText] = useState("")
  const [staged, setStaged] = useState<Staged[]>([])
  const [modelOpen, setModelOpen] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [listening, setListening] = useState(false)
  const [dictationUnsupported, setDictationUnsupported] = useState(false)
  const recognitionRef = useRef<{ stop: () => void } | null>(null)
  const modelWrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (modelWrapRef.current && !modelWrapRef.current.contains(e.target as Node)) setModelOpen(false)
    }
    document.addEventListener("pointerdown", onDown)
    return () => document.removeEventListener("pointerdown", onDown)
  }, [])

  useEffect(() => () => {
    try {
      recognitionRef.current?.stop()
    } catch {
      // Stopping an idle recognizer throws in some browsers; harmless.
    }
  }, [])

  const toggleDictation = () => {
    if (listening) {
      try {
        recognitionRef.current?.stop()
      } finally {
        setListening(false)
      }
      return
    }
    const SR = (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown })
      .SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
    if (typeof SR !== "function") {
      setDictationUnsupported(true)
      return
    }
    try {
      const rec = new (SR as new () => {
        lang: string
        interimResults: boolean
        onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
        onerror: (() => void) | null
        onend: (() => void) | null
        start: () => void
        stop: () => void
      })()
      rec.lang = "en-US"
      rec.interimResults = false
      let base = ""
      setText((t) => {
        base = t
        return t
      })
      rec.onresult = (e) => {
        const heard = Array.from(e.results)
          .map((r) => r[0]?.transcript ?? "")
          .join(" ")
          .trim()
        if (heard) setText(`${base}${base && !base.endsWith(" ") ? " " : ""}${heard}`)
      }
      rec.onerror = () => setListening(false)
      rec.onend = () => setListening(false)
      recognitionRef.current = rec
      rec.start()
      setListening(true)
    } catch {
      setDictationUnsupported(true)
    }
  }

  const stageFiles = (files: FileList | File[]) => {
    const list = [...files]
    setStaged((prev) => {
      const next = [...prev]
      for (const file of list) {
        const problem = validateStagedFile(
          { name: file.name, size: file.size, type: file.type },
          next.filter((s) => !s.problem).length
        )
        next.push({
          id: `${file.name}-${file.size}-${next.length}`,
          file,
          problem: problem?.message ?? null,
          status: problem ? "error" : "staged",
          percent: 0,
          path: null,
          error: problem?.message ?? null,
        })
      }
      return next.slice(0, MAX_INTAKE_FILES + 2)
    })
  }

  const removeStaged = (id: string) => {
    if (busy) return
    setStaged((prev) => prev.filter((s) => s.id !== id))
  }

  const retryFile = async (id: string) => {
    setStaged((prev) => prev.map((s) => (s.id === id ? { ...s, status: "staged" as const, percent: 0, error: null } : s)))
  }

  const canSend = !busy && (text.trim().length > 0 || staged.some((s) => !s.problem && (s.status === "staged" || s.status === "error" || s.status === "uploaded")))

  async function uploadStaged(auditId: string, items: Staged[], update: (id: string, patch: Partial<Staged>) => void) {
    const minted = await mintUploadUrls({
      auditId,
      files: items.map((s) => ({ name: s.file.name, size: s.file.size, mime: s.file.type })),
    })
    if (!minted.ok) throw new Error(minted.error)
    const byName = new Map(minted.uploads.map((u) => [u.name, u]))
    abortRef.current = new AbortController()
    await Promise.all(
      items.map(async (s) => {
        const slot = byName.get(s.file.name)
        if (!slot) throw new Error(`We couldn't stage "${s.file.name}".`)
        update(s.id, { status: "uploading", percent: 0, error: null })
        await putWithProgress(slot.signedUrl, s.file, (percent) => update(s.id, { percent }), abortRef.current!.signal)
        update(s.id, { status: "uploaded", percent: 100, path: slot.path })
      })
    )
    return items.map((s) => ({ name: s.file.name, path: byName.get(s.file.name)!.path }))
  }

  async function handleSend() {
    if (!canSend) return
    setError(null)
    setBusy(true)
    const update = (id: string, patch: Partial<Staged>) =>
      setStaged((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)))
    try {
      const ready = staged.filter((s) => !s.problem && s.status !== "attached")
      if (mode.kind === "new") {
        const body = text.trim() || `Review attached file(s): ${ready.map((s) => s.file.name).join(", ")}`
        const created = await createDeal({ text: body })
        if (!created.ok) throw new Error(created.error)
        if (ready.length > 0) {
          const paths = await uploadStaged(created.auditId, ready, update)
          const attached = await attachFiles({ auditId: created.auditId, files: paths })
          if (!attached.ok) throw new Error(attached.error)
          const failed = attached.results.filter((r) => !r.ok)
          setStaged((prev) =>
            prev.map((s) => {
              const r = attached.results.find((x) => x.name === s.file.name)
              if (!r) return s
              return r.ok
                ? { ...s, status: "attached" as const, percent: 100, error: null }
                : { ...s, status: "error" as const, error: r.error ?? "Couldn't be read." }
            })
          )
          if (failed.length > 0) {
            setError(failed.map((f) => f.error).join(" "))
          }
        }
        router.push(`/chat/${created.threadId}`)
        router.refresh()
      } else {
        if (!mode.auditId) throw new Error("That thread has no deal attached.")
        // Short turns Ask; long pastes are material (they also re-run analysis).
        if (ready.length === 0 && text.trim().length <= 500) {
          const asked = await askQuestion({ threadId: mode.threadId, text: text.trim() })
          if (!asked.ok) throw new Error(asked.error)
          setText("")
          router.refresh()
          return
        }
        if (text.trim()) {
          const appended = await appendMaterial({ threadId: mode.threadId, text: text.trim() })
          if (!appended.ok) throw new Error(appended.error)
        }
        if (ready.length > 0) {
          const paths = await uploadStaged(mode.auditId, ready, update)
          const attached = await attachFiles({ auditId: mode.auditId, files: paths })
          if (!attached.ok) throw new Error(attached.error)
          const failed = attached.results.filter((r) => !r.ok)
          setStaged((prev) =>
            prev.map((s) => {
              const r = attached.results.find((x) => x.name === s.file.name)
              if (!r) return s
              return r.ok
                ? { ...s, status: "attached" as const, percent: 100, error: null }
                : { ...s, status: "error" as const, error: r.error ?? "Couldn't be read." }
            })
          )
          if (failed.length > 0) {
            setError(failed.map((f) => f.error).join(" "))
          } else {
            setText("")
            setStaged([])
          }
        } else {
          setText("")
        }
        router.refresh()
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setError("Upload cancelled — staged files kept.")
      } else {
        setError(err instanceof Error ? err.message : "Something failed. Staged work kept — retry.")
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="absolute inset-x-3 bottom-3 border border-border bg-background px-3 py-2">
      {staged.length > 0 && (
        <ul className="mb-2 space-y-1.5 border-b border-border pb-2" aria-label="Staged files">
          {staged.map((s) => (
            <li key={s.id} className="flex items-center gap-2 text-xs">
              <span className="min-w-0 flex-1 truncate" title={s.file.name}>{s.file.name}</span>
              {s.status === "uploading" && (
                <span className="w-20 shrink-0 tabular-nums text-muted-foreground" aria-live="polite">{s.percent}%</span>
              )}
              {s.status === "uploaded" && <span className="shrink-0 text-muted-foreground">Uploaded</span>}
              {s.status === "attached" && <span className="shrink-0 text-muted-foreground">Attached</span>}
              {(s.status === "error" || s.problem) && (
                <span className="min-w-0 flex-1 truncate text-destructive">{s.error}</span>
              )}
              {s.status === "error" && !s.problem && (
                <button
                  type="button"
                  onClick={() => void retryFile(s.id)}
                  disabled={busy}
                  aria-label={`Retry ${s.file.name}`}
                  className="flex shrink-0 items-center gap-1 text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Retry
                </button>
              )}
              <button
                type="button"
                onClick={() => removeStaged(s.id)}
                disabled={busy}
                aria-label={`Remove ${s.file.name}`}
                className="shrink-0 text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="mb-2 border border-destructive/30 bg-destructive/5 px-2.5 py-2 text-xs text-destructive">
          {error}
        </p>
      )}
      <div
        className="flex items-center gap-1"
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          if (e.dataTransfer.files.length > 0) stageFiles(e.dataTransfer.files)
        }}
      >
        <input
          ref={fileRef}
          type="file"
          multiple
          accept={ACCEPT_STRING}
          className="sr-only"
          aria-label="Attach files"
          onChange={(e) => {
            if (e.target.files) stageFiles(e.target.files)
            e.target.value = ""
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          aria-label="Attach files"
          className={`flex h-8 w-8 shrink-0 items-center justify-center transition-colors disabled:opacity-50 ${dragOver ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Plus className="h-4 w-4" />
        </button>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              void handleSend()
            }
          }}
          disabled={busy}
          aria-label="Ask about the deal"
          placeholder="Ask"
          autoComplete="off"
          className="h-8 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:opacity-60"
        />
        <div className="relative shrink-0" ref={modelWrapRef}>
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
          onClick={toggleDictation}
          disabled={busy || dictationUnsupported}
          aria-label={listening ? "Stop dictation" : "Dictate"}
          title={dictationUnsupported ? "Dictation isn't supported in this browser" : "Dictate"}
          className={`flex h-8 w-8 shrink-0 items-center justify-center transition-colors disabled:opacity-50 ${listening ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={!canSend}
          aria-label={busy ? "Working" : "Send"}
          className="flex h-8 w-8 shrink-0 items-center justify-center bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}
