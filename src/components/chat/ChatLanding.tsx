"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertTriangle, Plus, Trash2 } from "lucide-react"
import { getPendingDeal } from "@/lib/pending-deal"
import { deleteDeal } from "@/app/audit/[id]/actions"
import { useToast } from "@/components/ui/toast"
import { CapabilityStrip } from "@/components/home/CapabilityStrip"
import { NewDealComposer } from "@/components/chat/NewDealComposer"

interface ThreadItem {
  id: string
  title: string
  auditId: string | null
  updatedAt: string
  status?: string | null
  riskLevel?: string | null
  overallScore?: number | null
  openIssues?: number | null
  resolvedCount?: number | null
  topCategories?: Array<{ label: string; count: number }>
}

export interface DeadlineItem {
  id: string
  auditId: string
  title: string
  dueDate: string
  href: string
}

export interface PortfolioSummary {
  totalOpen: number
  openDeals: number
  avgScore: number | null
  ratedCount: number
  topCategories: Array<{ label: string; count: number }>
}

function formatDate(date: string): string {
  const d = new Date(date)
  const diff = Math.floor((Date.now() - d.getTime()) / 86400000)
  if (diff === 0) return "Today"
  if (diff === 1) return "Yesterday"
  if (diff < 7) return `${diff} days ago`
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function riskPill(level: string | null | undefined): string | null {
  if (!level) return null
  const l = level.toLowerCase()
  if (l === "high" || l === "critical") return "border-red-500/30 bg-red-500/5 text-red-700"
  if (l === "medium" || l === "material") return "border-amber-500/30 bg-amber-500/5 text-amber-700"
  if (l === "low") return "border-border bg-muted/50 text-muted-foreground"
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
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
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
        className="rounded-lg bg-destructive px-2 py-1 text-[11px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "…" : "Delete?"}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => setArmed(false)}
        aria-label="Cancel deletion"
        className="rounded-lg px-1.5 py-1 text-[11px] text-muted-foreground hover:text-foreground"
      >
        Keep
      </button>
    </span>
  )
}

const LOOP_STEPS = [
  { n: "1", title: "Describe", body: "Drop in their contract or explain the situation." },
  { n: "2", title: "Understand", body: "See where the risk sits, with the clause it came from." },
  { n: "3", title: "Push back", body: "Get the exact words to send back." },
  { n: "4", title: "Sign & stay covered", body: "Both sides sign here; deadlines stay tracked." },
]

function todayLabel(): string {
  return new Date().toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" })
}

export function ChatLanding({ threads, loadError, deadlines, setupNeeded = false }: {
  threads: ThreadItem[]
  loadError?: string | null
  deadlines?: DeadlineItem[]
  setupNeeded?: boolean
}) {
  const [hasPending] = useState(() => getPendingDeal() !== null)
  const [setupDismissed, setSetupDismissed] = useState(() => {
    try {
      return window.localStorage.getItem("dealenz.welcome.dismissed") === "1"
    } catch {
      return false
    }
  })
  const upcoming = (deadlines ?? []).slice(0, 5)

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col overflow-y-auto px-4 pb-6 sm:px-6">
      <div className="flex shrink-0 items-end justify-between gap-3 pb-3 pt-4">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-foreground">Deal analysis</h1>
          <p className="mt-0.5 text-[13px] text-foreground/50">Take control of your deals today.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden text-xs text-foreground/50 sm:inline">{todayLabel()}</span>
          <Link
            href="/audit/new"
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-burgundy px-3.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" />
            New deal
          </Link>
        </div>
      </div>

      <div className="shrink-0 pb-3">
        <NewDealComposer />
      </div>

      <div className="shrink-0 pb-5">
        <CapabilityStrip />
      </div>

      {loadError && (
        <div role="alert" className="mb-3 flex shrink-0 items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>We couldn&apos;t load your deals. {loadError}</span>
        </div>
      )}

      {hasPending && (
        <Link
          href="/chat"
          className="mb-3 block shrink-0 rounded-2xl border border-border bg-card px-4 py-3 text-xs transition-colors hover:bg-muted/40"
        >
          <span className="font-semibold">Your deal text is waiting.</span>{" "}
          <span className="text-muted-foreground">Continue where you left off →</span>
        </Link>
      )}

      {setupNeeded && !setupDismissed && (
        <div className="mb-3 flex shrink-0 items-center gap-3 rounded-2xl border border-burgundy/20 bg-burgundy/[0.04] px-4 py-3">
          <p className="min-w-0 flex-1 text-xs leading-relaxed">
            <span className="font-semibold">2 minutes, pays off in every deal.</span>{" "}
            <span className="text-muted-foreground">Add your name and country once — documents carry them, questions drop.</span>
          </p>
          <Link
            href="/welcome"
            className="shrink-0 rounded-full bg-burgundy px-3.5 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
          >
            Set up
          </Link>
          <button
            type="button"
            onClick={() => {
              try {
                window.localStorage.setItem("dealenz.welcome.dismissed", "1")
              } catch {
                // Preference simply does not persist.
              }
              setSetupDismissed(true)
            }}
            aria-label="Dismiss setup suggestion"
            className="shrink-0 rounded-full px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            Later
          </button>
        </div>
      )}

      {upcoming.length > 0 && (
        <section aria-label="Upcoming deadlines" className="mb-5 shrink-0 rounded-2xl border border-border bg-card p-4">
          <p className="text-[13px] font-semibold">Upcoming</p>
          <ul className="mt-2 divide-y divide-border/60">
            {upcoming.map((d) => (
              <li key={d.id}>
                <Link href={d.href} className="group flex items-baseline justify-between gap-3 py-1.5">
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium group-hover:underline">{d.title}</span>
                  <span className="shrink-0 text-[11px] tabular-nums text-foreground/50">
                    {new Date(d.dueDate + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {threads.length > 0 && (
        <section aria-label="Your deals" className="shrink-0">
          <p className="px-1 pb-2 text-[13px] font-semibold">Your deals</p>
          <ul className="overflow-hidden rounded-2xl border border-border bg-card divide-y divide-border/60">
            {threads.map((t) => {
              const pill = riskPill(t.riskLevel)
              const sub = [
                typeof t.openIssues === "number" && t.openIssues > 0 ? `${t.openIssues} open` : null,
                t.riskLevel ?? null,
                formatDate(t.updatedAt),
              ].filter(Boolean).join(" · ")
              return (
                <li key={t.id} className="flex items-center gap-2 px-4 py-2.5 transition-colors hover:bg-foreground/[0.02]">
                  <Link href={`/chat/${t.id}`} className="min-w-0 flex-1" aria-label={`Open ${t.title || "Untitled deal"}`}>
                    <span className="block truncate text-sm font-medium">{t.title || "Untitled"}</span>
                    <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{sub}</span>
                  </Link>
                  {pill && t.riskLevel && (
                    <span className={`shrink-0 rounded-full border px-1.5 py-px text-[10px] font-medium ${pill}`}>
                      {t.riskLevel}
                    </span>
                  )}
                  {t.auditId && <DeleteDealButton auditId={t.auditId} title={t.title} />}
                </li>
              )
            })}
          </ul>
          {threads.length >= 30 && (
            <p className="px-1 pt-2 text-[11px] text-muted-foreground">Showing the 30 most recent.</p>
          )}
        </section>
      )}

      {threads.length === 0 && !loadError && (
        <div className="pb-4">
          <div className="grid gap-2 px-2 sm:grid-cols-2 lg:grid-cols-4">
            {LOOP_STEPS.map((s) => (
              <div key={s.n} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <p className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                  {s.n}
                </p>
                <p className="mt-2 text-[13px] font-semibold">{s.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-foreground/50">{s.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2 px-2">
            <Link
              href="/audit/new"
              className="inline-flex h-10 items-center gap-2 rounded-full bg-burgundy px-5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
            >
              <Plus className="h-3.5 w-3.5" />
              New deal
            </Link>
            <Link
              href="/inbox"
              className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-card px-5 text-xs font-semibold text-foreground transition-colors hover:bg-muted/60"
            >
              Import from Gmail
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
