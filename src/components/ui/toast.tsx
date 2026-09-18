"use client"

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react"
import { AlertCircle, CheckCircle2, X } from "lucide-react"
import { cn } from "@/lib/utils"

export interface ToastItem {
  id: number
  title: string
  description?: string
  tone: "error" | "success" | "info"
}

interface ToastContextValue {
  toast: (item: Omit<ToastItem, "id">) => void
  showError: (message: string, title?: string) => void
  showSuccess: (message: string, title?: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const TONE_STYLE: Record<ToastItem["tone"], string> = {
  error: "border-destructive/40 bg-card text-foreground",
  success: "border-emerald-500/40 bg-card text-foreground",
  info: "border-border bg-card text-foreground",
}

function ToastIcon({ tone }: { tone: ToastItem["tone"] }) {
  if (tone === "error") return <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
  if (tone === "success") return <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
  return null
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(1)
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const toast = useCallback(
    (item: Omit<ToastItem, "id">) => {
      const id = nextId.current++
      setItems((prev) => [...prev.slice(-3), { ...item, id }])
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), item.tone === "error" ? 9000 : 5000)
      )
    },
    [dismiss]
  )

  const showError = useCallback(
    (message: string, title = "Something went wrong") => {
      toast({ title, description: message, tone: "error" })
    },
    [toast]
  )

  const showSuccess = useCallback(
    (message: string, title = "Done") => {
      toast({ title, description: message, tone: "success" })
    },
    [toast]
  )

  const value = useMemo(() => ({ toast, showError, showSuccess }), [toast, showError, showSuccess])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 left-1/2 z-[100] flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4 sm:left-auto sm:right-4 sm:translate-x-0 sm:px-0"
      >
        {items.map((t) => (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            className={cn(
              "pointer-events-auto flex items-start gap-2.5 rounded-xl border bg-card p-3.5 shadow-lg",
              TONE_STYLE[t.tone]
            )}
          >
            <ToastIcon tone={t.tone} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-snug">{t.title}</p>
              {t.description ? (
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{t.description}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="rounded p-0.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error("useToast must be used inside ToastProvider")
  return ctx
}
