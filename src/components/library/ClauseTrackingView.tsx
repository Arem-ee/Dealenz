"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { FileText, Loader2 } from "lucide-react"
import { useToast } from "@/components/ui/toast"
import { getClauseTracking, type ClauseTrackingResult } from "@/app/library/clause-actions"
import { CLAUSE_LIBRARY } from "@/lib/protection/clauses"
import type { ClauseTrackStatus, DealClauseState } from "@/lib/clauses/tracking"
import { cn } from "@/lib/utils"

type DealState = DealClauseState

const STATUS_LABEL: Record<ClauseTrackStatus, string> = {
  needs_input: "Needs input",
  draft: "In draft",
  suggested: "Suggested",
  signed: "Signed",
}

function StatusPill({ status }: { status: ClauseTrackStatus }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-none border px-2 py-0.5 text-[11px] font-medium",
        status === "signed"
          ? "border-green-700/40 bg-green-700/10 text-green-700 dark:text-green-400"
          : status === "needs_input"
            ? "border-amber-600/40 bg-amber-600/10 text-amber-700 dark:text-amber-400"
            : "border-border text-muted-foreground"
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  )
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const diff = Math.floor((Date.now() - d.getTime()) / 86400000)
  if (diff === 0) return "Today"
  if (diff === 1) return "Yesterday"
  if (diff < 7) return `${diff} days ago`
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export function ClauseTrackingView() {
  const { showError } = useToast()
  const [deals, setDeals] = useState<DealState[] | null>(null)
  const [dealFilter, setDealFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState<"all" | ClauseTrackStatus>("all")

  useEffect(() => {
    let live = true
    getClauseTracking()
      .then((res: ClauseTrackingResult) => {
        if (!live) return
        if (!res.ok) {
          showError(res.error, "Clauses failed to load")
          setDeals([])
          return
        }
        setDeals(res.deals)
      })
      .catch(() => {
        if (!live) return
        showError("Clauses failed to load")
        setDeals([])
      })
    return () => {
      live = false
    }
  }, [showError])

  const dealTypes = useMemo(() => {
    const set = new Set<string>()
    for (const d of deals ?? []) set.add(d.dealType)
    return [...set].sort()
  }, [deals])

  const visible = useMemo(() => {
    return (deals ?? [])
      .filter((d) => dealFilter === "all" || d.dealType === dealFilter)
      .map((d) => ({
        ...d,
        clauses: d.clauses.filter((c) => statusFilter === "all" || c.status === statusFilter),
      }))
      .filter((d) => d.clauses.length > 0)
  }, [deals, dealFilter, statusFilter])

  const counts = useMemo(() => {
    const c: Record<ClauseTrackStatus, number> = { needs_input: 0, draft: 0, suggested: 0, signed: 0 }
    for (const d of deals ?? []) for (const cl of d.clauses) c[cl.status] += 1
    return c
  }, [deals])

  const library = useMemo(
    () => CLAUSE_LIBRARY.filter((c) => dealFilter === "all" || c.dealTypes.includes(dealFilter as never)),
    [dealFilter]
  )

  if (deals === null) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading clauses…
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 pb-10 pt-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Clauses</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {counts.signed} signed · {counts.draft} in draft · {counts.needs_input} need input · {counts.suggested} suggested.
          Suggestions come from your deal findings; only locked versions count as signed.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5" aria-label="Filters">
        <select
          value={dealFilter}
          onChange={(e) => setDealFilter(e.target.value)}
          aria-label="Filter by deal type"
          className="h-8 rounded-none border border-border bg-background px-3 text-xs"
        >
          <option value="all">Every deal type</option>
          {dealTypes.map((t) => (
            <option key={t} value={t}>
              {t.replace("_", " ")}
            </option>
          ))}
        </select>
        {(["all", "needs_input", "draft", "suggested", "signed"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            aria-pressed={statusFilter === s}
            className={cn(
              "h-8 rounded-none border px-3 text-xs font-medium transition-colors",
              statusFilter === s
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {s === "all" ? "Every status" : STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-none border border-dashed p-6 text-center">
          <FileText className="mx-auto h-5 w-5 text-muted-foreground/60" />
          <p className="mt-2 text-sm font-medium">No clauses match</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
            {deals.length === 0
              ? "Analyze a deal first — clause suggestions appear with your findings, and drafts track them from there."
              : "Try a different filter, or generate a document draft from a deal to start tracking its clauses."}
          </p>
        </div>
      ) : (
        visible.map((d) => (
          <section key={d.auditId} aria-label={`Clauses for ${d.title}`}>
            <Link href={`/chat/${d.auditId}`} className="group flex items-baseline gap-2">
              <h2 className="truncate text-sm font-semibold group-hover:underline">{d.title}</h2>
              <span className="shrink-0 text-[11px] capitalize text-muted-foreground">
                {d.dealType.replace("_", " ")} · {formatDate(d.updatedAt)}
              </span>
            </Link>
            <ul className="mt-2 space-y-1.5">
              {d.clauses.map((c) => (
                <li key={c.clauseId} className="rounded-none border bg-card px-3.5 py-2.5">
                  <div className="flex items-center gap-2">
                    <p className="min-w-0 flex-1 truncate text-[13px] font-medium">{c.title}</p>
                    <StatusPill status={c.status} />
                  </div>
                  {c.purpose ? (
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{c.purpose}</p>
                  ) : null}
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {c.familyTitle ? `${c.familyTitle}${c.versionNumber ? ` · v${c.versionNumber}` : ""}` : "From findings — no draft yet"}
                    {c.missingVariables.length > 0 ? ` · missing ${c.missingVariables.join(", ")}` : ""}
                    {c.previouslySigned ? " · previously signed, now redrafting" : ""}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <section aria-label="Clause library">
        <h2 className="text-sm font-semibold">Clause library</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {library.length} drafting suggestions. Every clause is drafting assistance, never law — confirm enforceability with a lawyer when it matters.
        </p>
        <ul className="mt-2 space-y-1.5">
          {library.map((c) => (
            <li key={c.id} className="rounded-none border px-3.5 py-2.5">
              <p className="text-[13px] font-medium">{c.title}</p>
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{c.purpose}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {c.dealTypes.join(" · ").replaceAll("_", " ")} · {c.variables.length} input{c.variables.length === 1 ? "" : "s"}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
