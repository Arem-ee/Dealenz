"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { FileText, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  filterRepoRows,
  countBy,
  type DealRisk,
  type DealStage,
  type RepoDealRow,
} from "@/lib/deals/repo"

const TYPE_ORDER = ["founder", "partnership", "purchase_sale", "lease", "employment", "freelance", "generic"]
const STAGE_ORDER: DealStage[] = ["Analysis", "Negotiation", "Signing", "Signed"]
const RISK_ORDER: DealRisk[] = ["Critical", "Material", "Attention", "Clear"]

function typeLabel(t: string): string {
  return t === "purchase_sale" ? "Purchase/Sale" : t.charAt(0).toUpperCase() + t.slice(1)
}

function formatDate(date: string): string {
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return ""
  const diff = Math.floor((Date.now() - d.getTime()) / 86400000)
  if (diff <= 0) return "Today"
  if (diff === 1) return "Yesterday"
  if (diff < 7) return `${diff} days ago`
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function riskTone(risk: DealRisk): string {
  if (risk === "Critical") return "border-foreground bg-foreground text-background"
  if (risk === "Material") return "border-border bg-muted text-foreground"
  return "border-border text-muted-foreground"
}

function ChipRow<T extends string>({ label, options, active, counts, onToggle, format }: {
  label: string
  options: T[]
  active: T[]
  counts: Record<string, number>
  onToggle: (v: T) => void
  format?: (v: T) => string
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label={`Filter by ${label}`}>
      <span className="w-14 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      {options.map((v) => {
        const on = active.includes(v)
        const n = counts[v] ?? 0
        return (
          <button
            key={v}
            type="button"
            onClick={() => onToggle(v)}
            aria-pressed={on}
            disabled={n === 0 && !on}
            className={cn(
              "border px-2.5 py-1 text-xs font-medium tabular-nums transition-colors disabled:opacity-40",
              on
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {format ? format(v) : v} · {n}
          </button>
        )
      })}
    </div>
  )
}

// Contract repository: filter chips inline above the table, one text search
// for the whole product in the top bar. Rows link to their deal thread.
export function DealRepo({ rows }: { rows: RepoDealRow[] }) {
  const [types, setTypes] = useState<string[]>([])
  const [stages, setStages] = useState<DealStage[]>([])
  const [risks, setRisks] = useState<DealRisk[]>([])

  const toggle = <T,>(list: T[], v: T, set: (n: T[]) => void) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

  const visible = useMemo(
    () => filterRepoRows(rows, { types, stages, risks }),
    [rows, types, stages, risks]
  )
  const typeCounts = useMemo(() => countBy(rows, (r) => r.dealType), [rows])
  const stageCounts = useMemo(() => countBy(rows, (r) => r.stage), [rows])
  const riskCounts = useMemo(() => countBy(rows, (r) => r.risk), [rows])

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col overflow-y-auto px-4 pb-6 sm:px-6">
      <div className="flex shrink-0 items-end justify-between gap-3 pb-4 pt-6">
        <h1 className="text-[28px] font-bold tracking-tight text-foreground">Home</h1>
        <Link
          href="/audit/new"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 bg-primary px-4 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" />
          New deal
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="border border-dashed px-4 py-12 text-center">
          <FileText className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">No deals yet</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
            Paste your first contract, brief, or deal email — Dealenz shows what to push back on before you sign.
          </p>
          <Link
            href="/audit/new"
            className="mt-4 inline-flex h-9 items-center gap-1.5 bg-primary px-4 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" />
            Start your first deal
          </Link>
        </div>
      ) : (
        <>
          <div className="flex shrink-0 flex-col gap-2 pb-4">
            <ChipRow label="Type" options={TYPE_ORDER} active={types} counts={typeCounts} onToggle={(v) => toggle(types, v, setTypes)} format={typeLabel} />
            <ChipRow label="Stage" options={STAGE_ORDER} active={stages} counts={stageCounts} onToggle={(v) => toggle(stages, v, setStages)} />
            <ChipRow label="Risk" options={RISK_ORDER} active={risks} counts={riskCounts} onToggle={(v) => toggle(risks, v, setRisks)} />
          </div>
          {visible.length === 0 ? (
            <div className="border border-dashed px-4 py-12 text-center">
              <p className="text-sm font-medium">No deals match these filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-border" role="table" aria-label="Deals">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th scope="col" className="px-3 py-2 font-semibold">Deal</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Type</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Stage</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Risk</th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {visible.map((d) => (
                    <tr key={d.id} className="transition-colors hover:bg-muted/40">
                      <td className="px-3 py-2.5">
                        <Link href={`/chat/${d.id}`} className="block min-w-0 font-medium hover:underline" aria-label={`Open ${d.title || "Untitled deal"}`}>
                          {d.title || "Untitled"}
                        </Link>
                        {d.openIssues > 0 && (
                          <span className="mt-0.5 block text-[11px] text-muted-foreground">
                            {d.openIssues} open issue{d.openIssues === 1 ? "" : "s"}
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-[13px] text-muted-foreground">{typeLabel(d.dealType)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-[13px]">{d.stage}</td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <span className={cn("border px-2 py-0.5 text-[11px] font-medium", riskTone(d.risk))}>{d.risk}</span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right text-[13px] tabular-nums text-muted-foreground">{formatDate(d.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-2 text-[11px] tabular-nums text-muted-foreground" aria-live="polite">
            {visible.length} of {rows.length} shown.
          </p>
        </>
      )}
    </div>
  )
}
