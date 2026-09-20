import { headers } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { ReportView } from "@/components/share/report-view"
import { toSharedReport } from "@/lib/share/report"
import { getTrustedClientIp, checkAnonymousRateLimit } from "@/lib/rate-limit-anon"

// Public shared finding report. Same abuse posture as document shares:
// per-IP throttle, invalid/expired/revoked tokens render the branded
// not-found (no oracle). Read-only: the RPC never mutates share state.
const SHARE_REPORT_LIMIT = 60
const SHARE_REPORT_WINDOW_SECONDS = 3600

interface PageProps {
  params: Promise<{ token: string }>
}

export default async function ReportPage({ params }: PageProps) {
  const { token } = await params
  const supabase = await createClient()

  const ip = getTrustedClientIp(await headers())
  const quota = await checkAnonymousRateLimit(supabase, `sharereport:${ip}`, SHARE_REPORT_LIMIT, SHARE_REPORT_WINDOW_SECONDS)
  if (!quota.allowed) {
    notFound()
  }

  const { data, error } = await supabase.rpc("get_shared_report", { p_token: token })

  if (error || !data || data.length === 0) {
    notFound()
  }

  const row = data[0] as {
    audit_id: string
    deal_type: string
    risk_level: string
    overall_score: number | null
    findings: unknown
  }
  const report = toSharedReport({
    dealType: row.deal_type,
    riskLevel: row.risk_level,
    overallScore: row.overall_score,
    deterministicFindings: Array.isArray(row.findings) ? row.findings : [],
  })

  return <ReportView report={report} />
}
