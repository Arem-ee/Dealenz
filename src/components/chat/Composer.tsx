"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowUp, FileUp, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { useAiConsent } from "@/hooks/use-ai-consent"
import { classifyInput } from "@/lib/chat/classifier"
import { priceForOperation } from "@/lib/credits/pricing"
import { UPLOAD_CREDITS } from "@/lib/credits/pricing"
import { setPendingFile } from "@/lib/pending-file"
import { askQuestionAction } from "@/app/ask/actions"
import { AiConsentModal } from "@/components/ai-consent-modal"

interface ComposerProps {
  threadId?: string | null
  auditId?: string | null
  onMessageSent?: () => void
  // Prefilled text from the work surface (e.g. "Ask about this finding").
  // Applied when the key changes so repeated asks with new text re-apply.
  prefill?: { text: string; key: number } | null
}

export function Composer({ threadId, auditId, onMessageSent, prefill }: ComposerProps) {
  const router = useRouter()
  const [value, setValue] = useState("")
  const [sending, setSending] = useState(false)
  const [showConsentModal, setShowConsentModal] = useState(false)
  const [pendingText, setPendingText] = useState<string | null>(null)
  const [pendingHasDocument, setPendingHasDocument] = useState(false)
  const { showError } = useToast()
  const { consented: aiConsented, consenting, grant: grantConsent } = useAiConsent()
  const fileRef = useRef<HTMLInputElement>(null)
  const [pendingFile, setPendingFileLocal] = useState<File | null>(null)
  const hasContent = value.trim().length > 0 || !!pendingFile
  // Pre-send estimate, mirrored from Ask: greetings are free, questions
  // price by operation size. Deal and action outcomes price downstream
  // (analysis allowance, plan approval, document costs), so no number is
  // shown rather than a wrong one.
  const estimate = (() => {
    const text = value.trim() || (pendingFile ? `Document: ${pendingFile.name}` : "")
    if (!text) return null
    try {
      const { outcome, operation } = classifyInput(text, !!pendingFile)
      if (outcome === "greeting") return 0
      if (outcome === "question") return priceForOperation(operation)
      return null
    } catch {
      return null
    }
  })()

  const [ephemeral, setEphemeral] = useState<Array<{ role: "user" | "assistant"; content: string }>>([])
  // Work-surface asks (e.g. "Ask about this finding") land in the box.
  // Applied during render by comparing keys, the React-endorsed pattern for
  // syncing state from props, so no effect and no cascading renders.
  const [appliedPrefillKey, setAppliedPrefillKey] = useState<number | null>(null)
  if (prefill && prefill.text && prefill.key !== appliedPrefillKey) {
    setAppliedPrefillKey(prefill.key)
    setValue(prefill.text)
  }

  async function doSend(text: string, hasDocument: boolean, file?: File | null): Promise<boolean> {
    const { outcome } = classifyInput(text, hasDocument)
    if (outcome === "greeting" || outcome === "question") {
      const res = await askQuestionAction({
        text,
        auditId: outcome === "question" ? auditId || undefined : undefined,
        conversationId: outcome === "question" ? threadId || undefined : undefined,
        idempotencyKey: crypto.randomUUID(),
      })
      if (res.type === "error") {
        handleActionError(res.error, text, hasDocument)
        return false
      }
      const id = res.conversationId
      if (!threadId && id) router.push(`/chat/${id}`)
      else if (!id && res.type === "answer") {
        // Free inline answer (e.g. greeting): no thread was created, so show
        // the exchange ephemerally instead of navigating anywhere.
        setEphemeral((prev) => [...prev.slice(-3), { role: "user", content: text }, { role: "assistant", content: res.text }])
      } else onMessageSent?.()
      return true
    }
    if (outcome === "deal") {
      if (threadId && auditId) {
        // Paper-in first: the file's bytes must land before any plan runs,
        // or analysis would read only the filename. Fail closed here.
        if (file) {
          const { uploadAndAttachFile } = await import("@/lib/files/attach")
          const attached = await uploadAndAttachFile(auditId, file)
          if (!attached.ok) {
            handleActionError(attached.error, text, hasDocument)
            return false
          }
        }
        const { postRichMessage } = await import("@/lib/chat/actions")
        const posted = await postRichMessage(threadId, { type: "text", payload: {}, content: text, role: "user" })
        if (!posted.ok) {
          handleActionError(posted.error, text, hasDocument)
          return false
        }
        // Work-first: create bounded analysis plan (0 credits, 5/day limit) and request approval instead of direct analysis
        const { createDealAnalysisPlan, requestApproval } = await import("@/lib/work/actions")
        const created = await createDealAnalysisPlan({ conversationId: threadId, dealId: auditId })
        if (!created.ok) {
          handleActionError(created.error, text, hasDocument)
          return false
        }
        const appr = await requestApproval(created.planId)
        if (!appr.ok) {
          handleActionError(appr.error, text, hasDocument)
          return false
        }
        onMessageSent?.()
        return true
      }
      const { createDealThread } = await import("@/lib/chat/actions")
      const created = await createDealThread(text)
      if (!created.ok) {
        handleActionError(created.error, text, hasDocument)
        return false
      }
      if (file) {
        const { uploadAndAttachFile } = await import("@/lib/files/attach")
        const attached = await uploadAndAttachFile(created.auditId, file)
        if (!attached.ok) {
          // Thread exists with the staged message, but no analysis runs on
          // a bare filename: surface the reason and keep input staged so
          // the user can paste the text instead.
          handleActionError(attached.error, text, hasDocument)
          return false
        }
      }
      const { createDealAnalysisPlan, requestApproval } = await import("@/lib/work/actions")
      const planRes = await createDealAnalysisPlan({ conversationId: created.threadId, dealId: created.auditId })
      if (!planRes.ok) {
        handleActionError(planRes.error, text, hasDocument)
        return false
      }
      const appr = await requestApproval(planRes.planId)
      if (!appr.ok) {
        handleActionError(appr.error, text, hasDocument)
        return false
      }
      router.push(`/chat/${created.threadId}`)
      return true
    }
    if (outcome === "action") {
      if (auditId && threadId) {
        const lower = text.toLowerCase()
        const { postRichMessage } = await import("@/lib/chat/actions")
        if (lower.includes("lawyer") || lower.includes("attorney")) {
          const posted = await postRichMessage(threadId, { type: "text", payload: {}, content: text, role: "user" })
          if (!posted.ok) {
            handleActionError(posted.error, text, hasDocument)
            return false
          }
          const { createConsultationRequest } = await import("@/app/audit/[id]/consultation-actions")
          const request = await createConsultationRequest(auditId, text)
          if (!request.success) {
            // Never confirm a request that was not stored.
            handleActionError(request.error ?? "We couldn't request lawyer review. Please try again.", text, hasDocument)
            return false
          }
          const confirmed = await postRichMessage(threadId, { type: "text", payload: { threadId, auditId, link: `/review/${auditId}?threadId=${threadId}` }, content: `Lawyer review requested — [Open case file](/review/${auditId}?threadId=${threadId})` })
          if (!confirmed.ok) {
            handleActionError(confirmed.error, text, hasDocument)
            return false
          }
          onMessageSent?.()
          return true
        }
        const posted = await postRichMessage(threadId, { type: "text", payload: {}, content: text, role: "user" })
        if (!posted.ok) {
          handleActionError(posted.error, text, hasDocument)
          return false
        }
        const { generateDocumentAndPost } = await import("@/lib/chat/actions")
        const generated = await generateDocumentAndPost(threadId, auditId, {})
        if (!generated.ok) {
          handleActionError(generated.error, text, hasDocument)
          return false
        }
        onMessageSent?.()
        return true
      }
      const res = await askQuestionAction({
        text,
        auditId: auditId || undefined,
        conversationId: threadId || undefined,
        idempotencyKey: crypto.randomUUID(),
      })
      if (res.type === "error") {
        handleActionError(res.error, text, hasDocument)
        return false
      }
      const id = res.conversationId
      if (!threadId && id) router.push(`/chat/${id}`)
      else onMessageSent?.()
      return true
    }
    // Unreachable: classifyInput covers every outcome. Fail closed (keep input).
    return false
  }

  function handleActionError(message: string, text: string, hasDocument: boolean) {
    if (message === "CONSENT_REQUIRED") {
      setPendingText(text)
      setPendingHasDocument(hasDocument)
      setShowConsentModal(true)
      return
    }
    // Real server message, surfaced as a toast (never a minified digest).
    showError(message)
  }

  async function reportSubmitFailure(err: unknown) {
    const msg = err instanceof Error ? err.message : String(err ?? "")
    try {
      // Anything below the action layer (expired session, redirect to login
      // followed by an unparseable page, network drop) arrives here without a
      // real message. If the browser holds no session, say so plainly.
      const { createClient } = await import("@/lib/supabase/client")
      const { data } = await createClient().auth.getSession()
      if (!data.session) {
        showError("Your session expired. Please sign in again.")
        router.push("/login")
        return
      }
    } catch {
      // Session probe failed — fall through to the raw message.
    }
    showError(msg || "We couldn't send that. Please try again.")
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
    try {
      const sent = await doSend(text, hasDocument, pendingFile)
      if (sent) {
        setValue("")
        setPendingFileLocal(null)
        setPendingFile(null)
      }
    } catch (err) {
      await reportSubmitFailure(err)
    } finally {
      setSending(false)
    }
  }

  async function handleConsentConfirm() {
    const ok = await grantConsent()
    if (!ok) {
      showError("Failed to save consent. Please try again — server did not confirm.")
      return
    }
    setShowConsentModal(false)
    const text = pendingText
    const hasDoc = pendingHasDocument
    setPendingText(null)
    if (text) {
      setSending(true)
      try {
        const sent = await doSend(text, hasDoc, pendingFile)
        if (sent) {
          setValue("")
          setPendingFileLocal(null)
          setPendingFile(null)
        }
      } catch (err) {
        await reportSubmitFailure(err)
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
      {ephemeral.length > 0 && (
        <div className="mb-3 space-y-2" aria-live="polite">
          {ephemeral.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={
                  m.role === "user"
                    ? "max-w-[85%] rounded-2xl bg-primary px-4 py-2.5 text-sm leading-relaxed text-primary-foreground"
                    : "max-w-[85%] rounded-2xl bg-muted px-4 py-2.5 text-sm leading-relaxed"
                }
              >
                <p className="whitespace-pre-wrap">{m.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}
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
              <button
                type="button"
                aria-label="Remove attached document"
                onClick={() => { setPendingFileLocal(null); setPendingFile(null) }}
                className="ml-1 -mr-1 rounded-full p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <span aria-hidden>×</span>
              </button>
            </div>
          )}
          <label htmlFor="composer-input" className="sr-only">Message Dealenz</label>
          <textarea
            id="composer-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Paste their contract or describe the deal…"
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
            title={`PDF, DOCX, or TXT — uploading a document costs ${UPLOAD_CREDITS} credits`}
            className="inline-flex items-center gap-1.5 rounded-full border border-input bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <FileUp className="h-3.5 w-3.5" />
            Add a document
          </button>
          <span className="hidden sm:inline-flex items-center gap-1 text-xs text-muted-foreground/60">Enter to send · Shift+Enter for new line</span>
          {estimate !== null && (
            <span className="hidden sm:inline text-xs text-muted-foreground/60">
              {estimate === 0 ? (
                "Free to send"
              ) : (
                <>Estimated cost: {estimate} credit{estimate === 1 ? "" : "s"} · <Link href="/billing" className="underline underline-offset-2 hover:text-foreground">Billing</Link></>
              )}
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
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
