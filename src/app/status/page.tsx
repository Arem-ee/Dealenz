import Link from "next/link"
import { checkHealth, type CheckState } from "@/lib/health/checks"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Status",
}

function tone(status: CheckState): string {
  if (status === "ok") return "bg-emerald-500/10 text-emerald-700"
  if (status === "degraded" || status === "unavailable") return "bg-red-500/10 text-red-700"
  return "bg-muted text-muted-foreground"
}

const CHECK_LABELS = [
  { key: "app", label: "App", detail: "Serving requests." },
  { key: "database", label: "Database", detail: "Reachable and answering queries." },
  { key: "ai", label: "AI providers", detail: "Unknown means no provider telemetry is available from this check; per-call failures surface in-app." },
] as const

export default async function StatusPage() {
  const health = await checkHealth()
  const allOk = health.status === "ok"
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          Back to Dealenz
        </Link>
        <div className="mt-8 flex items-center gap-3">
          <span
            className={`h-2.5 w-2.5 rounded-full ${allOk ? "bg-emerald-500" : health.status === "degraded" ? "bg-amber-500" : "bg-red-500"}`}
            aria-hidden
          />
          <h1 className="text-3xl font-semibold">
            {health.status === "ok" ? "All systems operational" : health.status === "degraded" ? "Partially degraded" : "Something needs attention"}
          </h1>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Checked live on load · machine-readable at{" "}
          <Link href="/api/health" className="underline underline-offset-2 hover:text-foreground">
            /api/health
          </Link>
        </p>
        <ul className="mt-6 space-y-2">
          {CHECK_LABELS.map((c) => (
            <li key={c.key} className="flex items-start justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{c.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{c.detail}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${tone(health.checks[c.key])}`}>
                {health.checks[c.key]}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-6 rounded-xl border border-border bg-card p-5">
          <p className="text-sm font-semibold">Incident history</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Disruptions are published here with cause and resolution. No incidents have been
            recorded since this page launched.
          </p>
        </div>
      </div>
    </main>
  )
}
