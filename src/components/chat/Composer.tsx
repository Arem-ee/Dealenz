"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowUp, FileUp, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAiConsent } from "@/hooks/use-ai-consent"
import { classifyInput } from "@/lib/chat/classifier"
import { setPendingFile } from "@/lib/pending-file"
import { askQuestionAction } from "@/app/ask/actions"
import { createHomeDeal } from "@/app/dashboard/home-actions"
import { publicErrorMessage } from "@/lib/safe-error"
import { AiConsentModal } from "@/components/ai-consent-modal"
import { createDealThread, analyzeAndPostRisk, generateDocumentAndPost } from "@/lib/chat/actions"

interface ComposerProps {
  threadId?: string | null
  auditId?: string | null
  onMessageSent?: () => void
}

export function Composer({ threadId, auditId, onMessageSent }: ComposerProps) {
  const router = useRouter()
  const [value, setValue] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showConsentModal, setShowConsentModal] = useState(false)
  const [pendingText, setPendingText] = useState<string | null>(null)
  const [pendingHasDocument, setPendingHasDocument] = useState(false)
  const { consented: aiConsented, consenting, grant: grantConsent } = useAiConsent()
  const fileRef = useRef<HTMLInputElement>(null)
  const [pendingFile, setPendingFileLocal] = useState<File | null>(null)
  const hasContent = value.trim().length > 0 || !!pendingFile

  async function doSend(text: string, hasDocument: boolean) {
    const { outcome } = classifyInput(text, hasDocument)
    try {
      if (outcome === "greeting") {
        const res = await askQuestionAction({ text, idempotencyKey: crypto.randomUUID() })
        const id = (res as { conversationId?: string }).conversationId
        if (!threadId && id) router.push(`/chat/${id}`)
        else onMessageSent?.()
        return
      }
      if (outcome === "question") {
        const res = await askQuestionAction({
          text,
          auditId: auditId || undefined,
          conversationId: threadId || undefined,
          idempotencyKey: crypto.randomUUID(),
        })
        const id = (res as { conversationId?: string }).conversationId
        if (!threadId && id) router.push(`/chat/${id}`)
        else onMessageSent?.()
        return
      }
      if (outcome === "deal") {
        if (threadId && auditId) {
          const { analyzeAndPostRisk: postRisk } = await import("@/lib/chat/actions")
          // Append deal content as user message already handled by doSend? For existing thread, post and analyze
          const { postRichMessage } = await import("@/lib/chat/actions")
          await postRichMessage(threadId, { type: "text", payload: {}, content: text, role: "user" })
          await postRisk(threadId, auditId)
          onMessageSent?.()
          return
        }
        const { threadId: newThreadId, auditId: newAuditId } = await createDealThread(text)
        await analyzeAndPostRisk(newThreadId, newAuditId)
        router.push(`/chat/${newThreadId}`)
        return
      }
      if (outcome === "action") {
        if (auditId && threadId) {
          const lower = text.toLowerCase()
          if (lower.includes("lawyer") || lower.includes("attorney") || lower.includes("review")) {
            const { postRichMessage } = await import("@/lib/chat/actions")
            await postRichMessage(threadId, { type: "text", payload: {}, content: text, role: "user" })
            const { createConsultationRequest } = await import("@/app/audit/[id]/consultation-actions")
            try {
              await createConsultationRequest(auditId, text)
            } catch {}
            const { postRichMessage: post } = await import("@/lib/chat/actions")
            await post(threadId, { type: "text", payload: { threadId, auditId, link: `/review/${auditId}?threadId=${threadId}` }, content: `Lawyer review requested — [Open case file](/review/${auditId}?threadId=${threadId})` })
            onMessageSent?.()
            return
          }
          const { postRichMessage } = await import("@/lib/chat/actions")
          await postRichMessage(threadId, { type: "text", payload: {}, content: text, role: "user" })
          await generateDocumentAndPost(threadId, auditId, {})
          onMessageSent?.()
          return
        }
        const res = await askQuestionAction({
          text,
          auditId: auditId || undefined,
          conversationId: threadId || undefined,
          idempotencyKey: crypto.randomUUID(),
        })
        const id = (res as { conversationId?: string }).conversationId
        if (!threadId && id) router.push(`/chat/${id}`)
        else onMessageSent?.()
        return
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : ""
      if (msg.includes("CONSENT_REQUIRED")) {
        setPendingText(text)
        setPendingHasDocument(hasDocument)
        setShowConsentModal(true)
        setSending(false)
        return
      }
      throw err
    }
  }

  async function handleSubmit() {
    const rawText = value.trim()
    if ((!rawText && !pendingFile) || sending) return
    const hasDocument = !!pendingFile
    const text = rawText || (pendingFile ? `Document: ${pendingFile.name}` : "")
    const { outcome } = classifyInput(text, hasDocument)
    const needsConsent = outcome !== "greeting"
    if (needsConsent && aiConsented === false) {
      setPendingText(text)
      setPendingHasDocument(hasDocument)
      setShowConsentModal(true)
      return
    }
    if (needsConsent && aiConsented === null) {
      const { getAiConsentStatus: fetchStatus } = await import("@/lib/ai-consent")
      const fresh = await fetchStatus().catch(() => false)
      if (!fresh) {
        setPendingText(text)
        setPendingHasDocument(hasDocument)
        setShowConsentModal(true)
        return
      }
    }
    setSending(true)
    setError(null)
    try {
      await doSend(text, hasDocument)
      setValue("")
      setPendingFileLocal(null)
      setPendingFile(null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg || "We couldn't send that. Please try again — " + msg)
    } finally {
      setSending(false)
    }
  }

  async function handleConsentConfirm() {
    const ok = await grantConsent()
    if (!ok) {
      setError("Failed to save consent. Please try again — server did not confirm.")
      return
    }
    setShowConsentModal(false)
    const text = pendingText
    const hasDoc = pendingHasDocument
    setPendingText(null)
    if (text) {
      setSending(true)
      setError(null)
      try {
        await doSend(text, hasDoc)
        setValue("")
        setPendingFileLocal(null)
        setPendingFile(null)
      } catch (err) {
        setError(publicErrorMessage(err, "We couldn't send that. Please try again."))
      } finally {
        setSending(false)
      }
    }
  }

  const handleConsentDismiss = () => {
    if (consenting) return
    setShowConsentModal(false)
    setPendingText(null)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      void handleSubmit()
    }
  }

  function handleFileDrop(file: File) {
    setPendingFile(file)
    setPendingFileLocal(file)
  }

  return (
    <>
      <div
        className="rounded-2xl border border-border/60 bg-card shadow-raised overflow-hidden"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          const f = e.dataTransfer.files?.[0]
          if (f) handleFileDrop(f)
        }}
      >
        <div className="p-3 sm:p-4">
          {pendingFile && (
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border bg-muted px-3 py-1 text-xs">
              <span className="truncate max-w-[200px]">{pendingFile.name}</span>
              <button type="button" onClick={() => { setPendingFileLocal(null); setPendingFile(null) }} className="ml-1 text-muted-foreground hover:text-foreground">×</button>
            </div>
          )}
          <label htmlFor="composer-input" className="sr-only">Message Dealenz</label>
          <textarea
            id="composer-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question or paste a deal..."
            rows={3}
            aria-label="Message Dealenz"
            className="w-full min-h-[72px] resize-none bg-transparent text-sm leading-relaxed placeholder:text-muted-foreground/60 outline-none"
          />
        </div>
        <div className="flex items-center gap-2 px-3 py-2.5 border-t border-border/60 bg-muted/20">
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept=".pdf,.docx,.txt"
            onChange={() => {
              const f = fileRef.current?.files?.[0]
              if (f) handleFileDrop(f)
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            aria-label="Add a document"
            className="inline-flex items-center gap-1.5 rounded-full border border-input bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <FileUp className="h-3.5 w-3.5" />
            Add a document
          </button>
          <span className="hidden sm:inline-flex items-center gap-1 text-xs text-muted-foreground/60">Enter to send · Shift+Enter for new line</span>
          <div className="ml-auto flex items-center gap-2">
            {error && <span role="alert" className="text-xs text-destructive max-w-[180px] truncate">{error}</span>}
            <Button size="icon" onClick={() => void handleSubmit()} disabled={!hasContent || sending} aria-label={sending ? "Sending" : "Send"} className="h-8 w-8 rounded-full">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
      <AiConsentModal open={showConsentModal} consenting={consenting} onConsent={() => void handleConsentConfirm()} onClose={handleConsentDismiss} />
    </>
  )
}
