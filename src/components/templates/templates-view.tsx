"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { FilePlus2, Loader2, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/components/ui/toast"
import { createFromTemplate, listTemplates, type TemplateOption } from "@/app/(app)/templates/actions"

const DEAL_TYPES = ["Founder", "Partnership", "Purchase/Sale", "Lease", "Employment", "Freelance"]

// Templates: standard contracts, one click to a first draft. Each card mints
// a deal + workspace thread + version 1, then lands there for blanks/review.
export function TemplatesView() {
  const router = useRouter()
  const { showError } = useToast()
  const [dealType, setDealType] = useState<string>("All")
  const [templates, setTemplates] = useState<TemplateOption[] | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  useEffect(() => {
    let live = true
    listTemplates(dealType === "All" ? undefined : dealType)
      .then((res) => {
        if (!live) return
        if (!res.ok) {
          showError(res.error, "Templates failed to load")
          setTemplates([])
          return
        }
        setTemplates(res.templates)
      })
      .catch(() => {
        if (!live) return
        showError("Templates failed to load")
        setTemplates([])
      })
    return () => {
      live = false
    }
  }, [dealType, showError])

  const visible = useMemo(() => templates ?? [], [templates])
  const [language, setLanguage] = useState("en")

  function create(familyId: string) {
    setPendingId(familyId)
    startTransition(async () => {
      try {
        const res = await createFromTemplate({ familyId, language })
        if (!res.ok) {
          showError(res.error, "Template failed")
          setPendingId(null)
          return
        }
        if (res.languageFallbacks.length > 0) {
          showError(
            `${res.languageFallbacks.length} clause${res.languageFallbacks.length === 1 ? "" : "s"} rendered in English — no approved ${res.language.toUpperCase()} line yet.`,
            "Partial translation"
          )
        }
        router.push(`/chat/${res.threadId}`)
      } catch {
        showError("Template failed — please try again.")
        setPendingId(null)
      }
    })
  }

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col px-4 pb-6 sm:px-6">
      <div className="flex shrink-0 items-end justify-between gap-3 pb-4 pt-6">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-foreground">Templates</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Standard contracts, one click to a first draft.
          </p>
        </div>
        <span className="inline-flex h-9 shrink-0 items-center gap-1.5 bg-primary px-4 text-xs font-semibold text-primary-foreground">
          <Plus className="h-3.5 w-3.5" />
          New template
        </span>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-1.5 pb-4" aria-label="Filter by deal type">
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          Language
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            aria-label="Agreement language"
            className="h-7 border border-border bg-background px-1.5 text-xs text-foreground outline-none"
          >
            <option value="en">English</option>
            <option value="fr">Français</option>
            <option value="de">Deutsch</option>
          </select>
        </label>
        {["All", ...DEAL_TYPES].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setDealType(t)}
            aria-pressed={dealType === t}
            className={cn(
              "border px-2.5 py-1 text-xs font-medium transition-colors",
              dealType === t
                ? "border-foreground bg-muted font-semibold text-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {templates === null ? (
        <div className="border border-border px-4 py-12 text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">Loading templates.</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="border border-dashed px-4 py-12 text-center">
          <FilePlus2 className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">No templates for this type</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
            Try another deal type.
          </p>
        </div>
      ) : (
        <ul className="grid gap-px border border-border bg-border sm:grid-cols-2" aria-label="Standard templates">
          {visible.map((t) => {
            const pending = pendingId === t.id
            return (
              <li key={t.id} className="flex flex-col bg-background p-4">
                <p className="text-sm font-semibold text-foreground">{t.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t.description}</p>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {t.dealType.replace("_", " ")}
                  </span>
                  <button
                    type="button"
                    disabled={pending || pendingId !== null}
                    onClick={() => create(t.id)}
                    className="inline-flex h-8 items-center gap-1.5 bg-primary px-3 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FilePlus2 className="h-3.5 w-3.5" />}
                    {pending ? "Creating." : "Use template"}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
