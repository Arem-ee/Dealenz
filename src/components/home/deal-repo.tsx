"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertTriangle, FileText, Plus, Trash2 } from "lucide-react"
import { getPendingDeal } from "@/lib/pending-deal"
import { deleteDeal } from "@/app/audit/[id]/actions"
import { useToast } from "@/components/ui/toast"

export interface DealRow {
  id: string
  title: string
  auditId: string | null
  updatedAt: string
  riskLevel?: string | null
  openIssues?: number | null
}

function formatDate(date: string): string {
  const d = new Date(date)
  const diff = Math.floor((Date.now() - d.getTime()) / 86400000)
  if (diff === 0) return "Today"
  if (diff === 1) return "Yesterday"
  if (diff < 7) return `${diff} days ago`
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function riskTone(level: string | null | undefined): string | null {
  if (!level) return null
  const l = level.toLowerCase()
  if (l === "high" || l === "critical") return "border-foreground bg-foreground text-background"
  if (l === "medium" || l === "material") return "border-border bg-muted text-foreground"
  if (l === "low") return "border-border text-muted-foreground"
  return null
}

function DeleteDealButton({ auditId, title }: { auditId: string; title: string }) {
  const router = useRouter()
  const { showError } = useToast()
  const [armed, setArmed] = useState(false)
  const [busy, setBusy] = useState(false)

  async function confirm() {
    setBusy(true)
    try {
      const res = await deleteDeal(auditId)
      if (!res.ok) {
        showError(res.error)
        setArmed(false)
        return
      }
      router.refresh()
    } catch {
      showError("We couldn't delete this deal. Please try again.")
      setArmed(false)
    } finally {
      setBusy(false)
    }
  }

  if (!armed) {
    return (
      <button
        type="button"
        onClick={() => setArmed(true)}
        aria-label={`Delete ${title || "untitled deal"}`}
        title="Delete this deal"
        className="flex h-8 w-8 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    )
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={() => void confirm()}
        aria-label={`Confirm deletion of ${title || "untitled deal"}`}
        className="bg-destructive px-2 py-1 text-[11px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "…" : "Delete?"}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => setArmed(false)}
        aria-label="Cancel deletion"
        className="px-1.5 py-1 text-[11px] text-muted-foreground hover:text-foreground"
      >
        Keep
      </button>
    </span>
  )
}

export function DealRepo({ deals, loadError }: {
  deals: DealRow[]
  loadError?: string | null
}) {
  const [query, setQuery] = useState("")
  const [hasPending] = useState(() => getPendingDeal() !== null)

  const q = query.trim().toLowerCase()
  const visible = q ? deals.filter((d) => (d.title || "").toLowerCase().includes(q)) : deals

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-5xl flex-col overflow-y-auto px-4 pb-6 sm:px-6">
      <div className="flex shrink-0 items-end justify-between gap-3 pb-4 pt-6">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-foreground">Home</h1>
          <p className="mt-0.5 text-[13px] text-foreground/50" aria-live="polite">
            {deals.length === 0 ? "No deals yet." : `${visible.length} of ${deals.length} shown.`}
          </p>
        </div>
        <Link
          href="/audit/new"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" />
          New deal
        </Link>
      </div>

      {deals.length > 0 && (
        <div className="shrink-0 pb-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search deals..."
            aria-label="Search deals"
            className="h-9 w-full rounded-full border border-input bg-background px-4 text-sm"
          />
        </div>
      )}

      {loadError && (
        <div role="alert" className="mb-3 flex shrink-0 items-start gap-2 border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>We couldn&apos;t load your deals. {loadError}</span>
        </div>
      )}

      {hasPending && (
        <Link
          href="/chat"
          className="mb-3 block shrink-0 rounded-xl border border-border bg-card px-4 py-3 text-xs transition-colors hover:bg-muted/40"
        >
          <span className="font-semibold">Your deal text is waiting.</span>{" "}
          <span className="text-muted-foreground">Continue where you left off →</span>
        </Link>
      )}

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed px-4 py-12 text-center">
          <FileText className="mx-auto h-6 w-6 text-muted-foreground/60" />
          <p className="mt-2 text-sm font-medium">{q ? "No deals match." : "No deals yet"}</p>
          {!q && (
            <>
              <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
                Paste your first contract, brief, or deal email — Dealenz will show you what to push back on before you sign.
              </p>
              <Link
                href="/audit/new"
                className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                <Plus className="h-3.5 w-3.5" />
                Start your first deal
              </Link>
            </>
          )}
        </div>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {visible.map((d) => {
            const tone = riskTone(d.riskLevel)
            const sub = [
              typeof d.openIssues === "number" && d.openIssues > 0 ? `${d.openIssues} open issues` : null,
              d.riskLevel ?? null,
              formatDate(d.updatedAt),
            ].filter(Boolean).join(" · ")
            return (
              <li key={d.id} className="flex items-center gap-3 bg-background px-1 py-3 transition-colors hover:bg-foreground/[0.02]">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground/70" />
                <Link href={`/chat/${d.id}`} className="min-w-0 flex-1" aria-label={`Open ${d.title || "Untitled deal"}`}>
                  <span className="block truncate text-sm font-medium">{d.title || "Untitled"}</span>
                  <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{sub}</span>
                </Link>
                {tone && d.riskLevel && (
                  <span className={`shrink-0 rounded-full border px-2 py-px text-[10px] font-medium ${tone}`}>
                    {d.riskLevel}
                  </span>
                )}
                {d.auditId && <DeleteDealButton auditId={d.auditId} title={d.title} />}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
