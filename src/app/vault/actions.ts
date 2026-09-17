"use server"

import { createClient } from "@/lib/supabase/server"

interface VaultAudit {
  id: string
  title: string
  deal_type: string | null
  status: string
  created_at: string
  updated_at: string
  overall_score: number | null
  risk_report: unknown
  structured_data: unknown
}

function findingsForAudit(audit: VaultAudit): Array<{ summary: string; severity: string; ruleKey?: string }> {
  const sd = audit.structured_data as Record<string, unknown> | null
  const findings = (sd?.deterministicFindings as Array<Record<string, unknown>> | undefined) ?? []
  return findings
    .map((f) => {
      const finding = (f.finding as Record<string, unknown> | undefined) ?? f
      return {
        summary: String(finding.summary ?? ""),
        severity: String(finding.severity ?? "informational"),
        ruleKey: String(f.ruleKey ?? finding.ruleKey ?? ""),
      }
    })
    .filter((f) => f.summary)
}

export async function vaultChatAction(input: { text: string; conversationId?: string }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("You must be signed in.")
  const text = input.text.trim()
  if (!text) throw new Error("Message required.")

  const { data: auditsRaw } = await supabase
    .from("audits")
    .select("id, title, deal_type, status, created_at, updated_at, overall_score, risk_report, structured_data")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(50)
  const audits = (auditsRaw ?? []) as VaultAudit[]

  const lower = text.toLowerCase()
  let matches: VaultAudit[] = []
  let answerPrefix = ""

  if (lower.includes("uncapped") && lower.includes("liab")) {
    matches = audits.filter((a) => {
      const findings = findingsForAudit(a)
      return findings.some((f) => (f.ruleKey ?? "").includes("liability") && /cap|limited/i.test(f.summary) === false && /liability/i.test(f.summary))
        || findings.some((f) => /uncapped|without.*cap|liability.*cap/i.test(f.summary))
        || (!findings.length && /liability/i.test(a.title.toLowerCase()))
    })
    // Fallback: also check raw liabilityCap missing pattern
    if (matches.length === 0) {
      matches = audits.filter((a) => {
        const sd = a.structured_data as Record<string, unknown> | null
        const findings = findingsForAudit(a)
        return findings.some((f) => (f.ruleKey ?? "").includes("liability"))
      })
    }
    answerPrefix = matches.length > 0 ? `Found ${matches.length} deal(s) with uncapped liability:` : "No deals with uncapped liability found."
  } else if (lower.includes("contract") && (lower.includes("flag") || lower.includes("last week") || lower.includes("flagged"))) {
    matches = audits.filter((a) => a.risk_report !== null).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()).slice(0, 5)
    answerPrefix = matches.length > 0 ? `Here are your flagged contracts:` : "No flagged contracts found."
  } else if (lower.includes("which") || lower.includes("show") || lower.includes("list") || lower.includes("deals")) {
    const keywords = lower.split(/\s+/).filter((w) => w.length > 3)
    matches = audits.filter((a) => {
      const hay = `${a.title} ${a.deal_type ?? ""} ${findingsForAudit(a).map((f) => f.summary).join(" ")}`.toLowerCase()
      return keywords.some((kw) => hay.includes(kw))
    }).slice(0, 8)
    if (matches.length === 0) matches = audits.slice(0, 5)
    answerPrefix = `Found ${matches.length} matching deal(s):`
  } else {
    matches = audits.slice(0, 5)
    answerPrefix = `Here are your recent deals:`
  }

  const lines = matches.map((a) => {
    const findings = findingsForAudit(a)
    const flag = findings.length > 0 ? ` — ${findings.length} finding(s)` : ""
    return `• ${a.title} (${a.deal_type ?? "deal"}, ${new Date(a.updated_at).toLocaleDateString()}${a.overall_score !== null ? `, risk ${a.overall_score}/100` : ""})${flag} — /chat/${a.id}`
  })

  const content = [answerPrefix, ...lines].join("\n")
  return { content, matches: matches.map((m) => ({ id: m.id, title: m.title, dealType: m.deal_type, updatedAt: m.updated_at, riskLevel: (m.risk_report as { riskLevel?: string } | null)?.riskLevel ?? null })) }
}

export async function getVaultList(search?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data: auditsRaw } = await supabase
    .from("audits")
    .select("id, title, deal_type, status, created_at, updated_at, overall_score, risk_report")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(50)
  let audits = (auditsRaw ?? []) as VaultAudit[]
  if (search && search.trim()) {
    const q = search.trim().toLowerCase()
    audits = audits.filter((a) => `${a.title} ${a.deal_type ?? ""}`.toLowerCase().includes(q))
  }
  return audits.map((a) => ({
    id: a.id,
    title: a.title,
    dealType: a.deal_type,
    createdAt: a.created_at,
    updatedAt: a.updated_at,
    riskLevel: (a.risk_report as { riskLevel?: string } | null)?.riskLevel ?? null,
    overallScore: a.overall_score,
  }))
}
