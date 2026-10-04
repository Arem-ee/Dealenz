"use client"

import { useEffect, useState } from "react"
import { BarChart3, Download } from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/components/ui/toast"
import { getReports, type ReportsData } from "@/app/(app)/reports/actions"
import { formatDays, toCsv } from "@/lib/reports/stats"
import { formatDealValue } from "@/lib/deals/value"

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function Bar({ label, value, max, accent }: { label: string; value: number; max: number; accent?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-28 shrink-0 truncate text-[11px] text-muted-foreground">{label}</span>
      <span className="h-3 min-w-0 flex-1 bg-muted">
        <span className={cn("block h-full", accent ? "bg-destructive" : "bg-foreground")} style={{ width: `${max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0}%` }} />
      </span>
      <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">{value}</span>
    </div>
  )
}

function Section({ title, desc, filename, csv, children }: {
  title: string
  desc: string
  filename: string
  csv: string | null
  children: React.ReactNode
}) {
  return (
    <section className="border border-border bg-background p-4" aria-label={title}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
        </div>
        {csv !== null && (
          <button
            type="button"
            onClick={() => downloadCsv(filename, csv)}
            aria-label={`Download ${title} as CSV`}
            className="flex shrink-0 items-center gap-1 border border-border px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <Download className="h-3 w-3" />
            CSV
          </button>
        )}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  )
}

// Reports: portfolio, turnaround, activity, obligations, and spend —
// all computed from owned rows, no new tables. Stage and risk reuse the
// Home derivation, so these numbers match the repo exactly. CSV exports
// render client-side from the loaded aggregates.
export function ReportsView() {
  const { showError } = useToast()
  const [data, setData] = useState<ReportsData | null>(null)

  useEffect(() => {
    let live = true
    getReports()
      .then((res) => {
        if (!live) return
        if (!res.ok) {
          showError(res.error, "Reports failed to load")
          return
        }
        setData(res.data)
      })
      .catch(() => {
        if (!live) return
        showError("Reports failed to load")
      })
    return () => {
      live = false
    }
  }, [showError])

  if (!data) {
    return (
      <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col px-4 pb-6 sm:px-6">
        <div className="pb-4 pt-6">
          <h1 className="text-[28px] font-bold tracking-tight text-foreground">Reports</h1>
        </div>
        <p className="py-16 text-center text-sm text-muted-foreground">Loading reports…</p>
      </div>
    )
  }

  const stages: Array<[string, number]> = ["Analysis", "Negotiation", "Signing", "Signed"].map((s) => [s, data.pipeline.byStage[s] ?? 0])
  const risks: Array<[string, number]> = ["Critical", "Material", "Attention", "Clear"].map((s) => [s, data.pipeline.byRisk[s] ?? 0])
  const maxStage = Math.max(1, ...stages.map(([, v]) => v))
  const maxRisk = Math.max(1, ...risks.map(([, v]) => v))
  const maxActivity = Math.max(1, ...data.activity.byType.map((t) => t.count))
  const maxSpend = Math.max(1, ...data.spend.byOperation.map((t) => t.credits))
  const maxDaily = Math.max(1, ...data.activity.daily.map((d) => d.count))
  const maxSealed = Math.max(1, ...data.signed.sealedPerMonth.map((m) => m.count))
  const maxRule = Math.max(1, ...data.signed.topRules.map((t) => t.deals))

  const stats: Array<[string, string]> = [
    ["Total deals", String(data.pipeline.total)],
    ["Open issues", String(data.pipeline.openIssues)],
    ["Sealed this month", String(data.pipeline.sealedThisMonth)],
    ["Credits used · 30d", String(data.spend.total30d)],
  ]
  const portfolioEmpty = data.portfolio.byCurrency.length === 0

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col overflow-y-auto px-4 pb-6 sm:px-6">
      <div className="flex shrink-0 items-end justify-between gap-3 pb-4 pt-6">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-foreground">Reports</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Portfolio, pace, activity, obligations, and spend — trailing 30 days unless noted.
          </p>
        </div>
      </div>

      <div className="grid shrink-0 grid-cols-2 gap-px border border-border bg-border lg:grid-cols-4" aria-label="Portfolio stats">
        {stats.map(([label, value]) => (
          <div key={label} className="bg-background px-4 py-5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid shrink-0 grid-cols-1 gap-4 md:grid-cols-2">
        <Section
          title="Deals by stage"
          desc="Same derivation as Home — these numbers match the repo."
          filename="deals-by-stage.csv"
          csv={toCsv(["stage", "deals"], stages.map(([s, v]) => [s, String(v)]))}
        >
          <div className="space-y-1.5">
            {stages.map(([s, v]) => <Bar key={s} label={s} value={v} max={maxStage} />)}
          </div>
        </Section>

        <Section
          title="Risk split"
          desc="Worst FAIL severity per deal."
          filename="risk-split.csv"
          csv={toCsv(["risk", "deals"], risks.map(([s, v]) => [s, String(v)]))}
        >
          <div className="space-y-1.5">
            {risks.map(([s, v]) => <Bar key={s} label={s} value={v} max={maxRisk} accent={s === "Critical"} />)}
          </div>
        </Section>

        <Section
          title="Turnaround"
          desc="Median days across completed transitions."
          filename="turnaround.csv"
          csv={toCsv(
            ["transition", "median_days", "samples"],
            [
              ["draft_to_sealed", String(data.turnaround.draftToSealed.median ?? ""), String(data.turnaround.draftToSealed.n)],
              ["owner_to_counterparty", String(data.turnaround.ownerToCounterparty.median ?? ""), String(data.turnaround.ownerToCounterparty.n)],
              ["invite_to_sign", String(data.turnaround.inviteToSign.median ?? ""), String(data.turnaround.inviteToSign.n)],
              ["request_to_decision", String(data.turnaround.requestToDecision.median ?? ""), String(data.turnaround.requestToDecision.n)],
            ]
          )}
        >
          <dl className="space-y-1.5 text-[13px]">
            {[
              ["Draft → sealed", data.turnaround.draftToSealed],
              ["Owner → counterparty", data.turnaround.ownerToCounterparty],
              ["Invite → sign", data.turnaround.inviteToSign],
              ["Request → decision", data.turnaround.requestToDecision],
            ].map(([label, v]) => (
              <div key={label as string} className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">{label as string}</dt>
                <dd className="tabular-nums">
                  {formatDays((v as { median: number | null }).median)}{" "}
                  <span className="text-[11px] text-muted-foreground">n={(v as { n: number }).n}</span>
                </dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section
          title="Obligations"
          desc="From Tracker — open, overdue, and resolved."
          filename="obligations.csv"
          csv={toCsv(
            ["state", "count"],
            [
              ["open", String(data.obligations.open)],
              ["overdue", String(data.obligations.overdue)],
              ["completed", String(data.obligations.completed)],
              ["dismissed", String(data.obligations.dismissed)],
            ]
          )}
        >
          <dl className="space-y-1.5 text-[13px]">
            {[
              ["Open", data.obligations.open, false],
              ["Overdue", data.obligations.overdue, true],
              ["Completed", data.obligations.completed, false],
              ["Dismissed", data.obligations.dismissed, false],
            ].map(([label, v, accent]) => (
              <div key={label as string} className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">{label as string}</dt>
                <dd className={cn("tabular-nums font-semibold", accent ? "text-destructive" : "")}>{v as number}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section
          title="Activity · 30 days"
          desc={`${data.activity.total30d} events. Daily volume with per-type split.`}
          filename="activity.csv"
          csv={toCsv(
            ["day", "events"],
            data.activity.daily.filter((d) => d.count > 0).map((d) => [d.day, String(d.count)])
          )}
        >
          <div className="flex h-16 items-end gap-px" aria-hidden="true">
            {data.activity.daily.map((d) => (
              <span
                key={d.day}
                title={`${d.day}: ${d.count}`}
                className={cn("min-w-0 flex-1", d.count > 0 ? "bg-foreground" : "bg-muted")}
                style={{ height: `${Math.max(4, Math.round((d.count / maxDaily) * 100))}%` }}
              />
            ))}
          </div>
          <div className="mt-2 space-y-1.5">
            {data.activity.byType.slice(0, 6).map((t) => (
              <Bar key={t.type} label={t.type.replaceAll("_", " ")} value={t.count} max={maxActivity} />
            ))}
            {data.activity.byType.length === 0 && (
              <p className="text-xs text-muted-foreground">No events in the last 30 days.</p>
            )}
          </div>
        </Section>

        <Section
          title="Spend · 30 days"
          desc="Finalized credit consumption by operation. Per-deal spend isn't tracked — the ledger carries no deal_id."
          filename="spend.csv"
          csv={toCsv(
            ["operation", "credits"],
            data.spend.byOperation.map((t) => [t.operation, String(t.credits)])
          )}
        >
          <div className="space-y-1.5">
            {data.spend.byOperation.map((t) => (
              <Bar key={t.operation} label={t.operation.replaceAll("_", " ")} value={t.credits} max={maxSpend} />
            ))}
            {data.spend.byOperation.length === 0 && (
              <p className="text-xs text-muted-foreground">No finalized consumption in the last 30 days.</p>
            )}
          </div>
        </Section>
      </div>

      {data.pipeline.total === 0 && (
        <div className="mt-4 border border-dashed px-4 py-10 text-center">
          <BarChart3 className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">No deals yet</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
            Reports fill in as you analyze, sign, and track deals.
          </p>
        </div>
      )}

      <div className="mt-4">
        <Section
          title="Portfolio value"
          desc={`${data.portfolio.withValue} of ${data.portfolio.total} deals carry a value — sums by currency, no conversion.`}
          filename="portfolio-value.csv"
          csv={toCsv(
            ["currency", "total_minor", "deals"],
            data.portfolio.byCurrency.map((p) => [p.currency, String(p.total), String(p.deals)])
          )}
        >
          {portfolioEmpty ? (
            <p className="text-xs text-muted-foreground">No values on file — add one per deal in its workspace. History stays blank, never zero.</p>
          ) : (
            <div className="space-y-1.5">
              {data.portfolio.byCurrency.map((p) => (
                <div key={p.currency} className="flex items-center justify-between gap-2 text-[13px]">
                  <span className="text-muted-foreground">{p.currency} · {p.deals} deal{p.deals === 1 ? "" : "s"}</span>
                  <span className="tabular-nums font-semibold">{formatDealValue(p.total, p.currency)}</span>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      <div className="mt-4">
        <Section
          title="Signed portfolio"
          desc={`${data.signed.sealedTotal} sealed deals · post-signature renewals, fulfillment, and clause landscape.`}
          filename="signed-portfolio.csv"
          csv={toCsv(
            ["month", "sealed"],
            data.signed.sealedPerMonth.filter((m) => m.count > 0).map((m) => [m.month, String(m.count)])
          )}
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Sealed per month · 12 mo</p>
              <div className="mt-2 flex h-20 items-end gap-px" aria-hidden="true">
                {data.signed.sealedPerMonth.map((m) => (
                  <span
                    key={m.month}
                    title={`${m.month}: ${m.count}`}
                    className={cn("min-w-0 flex-1", m.count > 0 ? "bg-foreground" : "bg-muted")}
                    style={{ height: `${Math.max(4, Math.round((m.count / maxSealed) * 100))}%` }}
                  />
                ))}
              </div>
              <div className="mt-2 flex items-center justify-between text-[13px]">
                <span className="text-muted-foreground">Fulfillment on signed deals</span>
                <span className="tabular-nums font-semibold">
                  {data.signed.fulfillment.rate === null ? "—" : `${data.signed.fulfillment.rate}%`}
                  <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                    {data.signed.fulfillment.completed} done · {data.signed.fulfillment.outstanding} open
                  </span>
                </span>
              </div>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Renewal queue{data.signed.renewalsOverdue > 0 && <span className="ml-1 font-semibold text-destructive">{data.signed.renewalsOverdue} overdue</span>}
              </p>
              {data.signed.renewalQueue.length === 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">No dated renewals on file — extraction adds them when signed text carries dates.</p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {data.signed.renewalQueue.slice(0, 5).map((r, i) => (
                    <li key={i} className="flex items-center justify-between gap-2 text-[13px]">
                      <span className="min-w-0 truncate">{r.title} <span className="text-muted-foreground">· {r.dealTitle}</span></span>
                      <span className={cn("shrink-0 text-[11px] tabular-nums", r.dueDate && r.dueDate <= new Date().toISOString().slice(0, 10) ? "font-semibold text-destructive" : "text-muted-foreground")}>
                        {r.dueDate ?? "No date"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          {data.signed.topRules.length > 0 && (
            <div className="mt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Recurring flags across sealed deals</p>
              <div className="mt-2 space-y-1.5">
                {data.signed.topRules.slice(0, 5).map((t) => (
                  <Bar key={t.rule} label={t.rule.replaceAll("_", " ")} value={t.deals} max={maxRule} />
                ))}
              </div>
              {data.signed.topConflicts.length > 0 && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Cross-contract friction: {data.signed.topConflicts.map((c) => `${c.type.replaceAll("_", " ")} ×${c.count}`).join(" · ")}
                </p>
              )}
            </div>
          )}
        </Section>
      </div>
    </div>
  )
}
