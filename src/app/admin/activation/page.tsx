import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { isAdminSessionUser } from "@/lib/auth/admin"
import { getActivationStats } from "./actions"

export const dynamic = "force-dynamic"

function Bar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <span className="block h-1.5 w-32 overflow-hidden rounded-full bg-muted" aria-hidden>
      <span className="block h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
    </span>
  )
}

export default async function ActivationPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdminSessionUser(user)) redirect("/dashboard")

  const res = await getActivationStats()
  if (!res.ok) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-semibold">Activation</h1>
        <p className="mt-2 text-sm text-destructive">{res.error}</p>
      </div>
    )
  }
  const s = res.stats
  const funnelMax = Math.max(s.users, 1)
  const rows: Array<{ label: string; display: string; value: number }> = [
    { label: `Signups (last ${s.windowDays}d)`, display: `${s.usersLast30d} of ${s.users} total`, value: s.usersLast30d },
    { label: "First analysis (activated)", display: `${s.analyzedUsers}`, value: s.analyzedUsers },
    { label: "Second analysis (the loop)", display: `${s.secondAnalysisUsers}`, value: s.secondAnalysisUsers },
    { label: "Conversation threads", display: `${s.askThreads}`, value: s.askThreads },
    { label: "Purchases settled", display: `${s.purchasesSucceeded}`, value: s.purchasesSucceeded },
  ]
  const revenue = Object.entries(s.revenueMinorByCurrency)
    .map(([cur, minor]) => `${cur} ${(minor / 100).toFixed(2)}`)
    .join(" · ") || "—"

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Founder metrics</p>
      <h1 className="mt-1.5 text-[28px] font-semibold tracking-[-0.01em]">Activation</h1>
      <p className="mt-1 text-xs text-muted-foreground">
        First-party tables only — counts, never content. Signup → first analysis → second analysis is the funnel that matters.
        {s.truncated ? " Some tables hit the read cap: treat totals as at least." : ""}
      </p>
      <ul className="mt-6 divide-y divide-border border-y border-border">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center justify-between gap-4 py-4">
            <div>
              <p className="text-sm font-medium">{r.label}</p>
              <div className="mt-1.5"><Bar value={r.value} max={funnelMax} /></div>
            </div>
            <p className="shrink-0 text-sm tabular-nums text-muted-foreground">{r.display}</p>
          </li>
        ))}
        <li className="flex items-center justify-between gap-4 py-4">
          <p className="text-sm font-medium">Revenue settled</p>
          <p className="shrink-0 text-sm tabular-nums text-muted-foreground">{revenue}</p>
        </li>
        <li className="flex items-center justify-between gap-4 py-4">
          <p className="text-sm font-medium">Median signup → first analysis</p>
          <p className="shrink-0 text-sm tabular-nums text-muted-foreground">
            {s.medianSignupToFirstAnalysisHrs === null ? "—" : `${s.medianSignupToFirstAnalysisHrs} hrs`}
          </p>
        </li>
        <li className="flex items-center justify-between gap-4 py-4">
          <p className="text-sm font-medium">Referrals by status</p>
          <p className="shrink-0 text-sm tabular-nums text-muted-foreground">
            {Object.entries(s.referralsByStatus).map(([k, v]) => `${k}: ${v}`).join(" · ") || "—"}
          </p>
        </li>
      </ul>
    </div>
  )
}
