// Open Items (Phase 21C).
//
// Derives actionable open items from deterministic findings.
// FAIL findings → issues requiring attention
// UNKNOWN findings → unresolved information requiring attention
// PASS findings → not open items
//
// This is a lightweight derived view, not a new persisted entity.
// Open items are recomputed from canonical findings on demand.

import type { RuleResult, Finding } from "@/lib/rules/result"

interface ConversationMessageWithMetadata {
  content: string
  role?: string
  metadata?: {
    type: string
    payload?: {
      findings?: Array<{ severity: string; summary: string; whyItMatters?: string }>
    }
  }
}

export interface OpenItem {
  id: string // stable: ruleKey
  findingId: string // ruleKey
  category: string
  severity: "critical" | "material" | "attention" | "informational"
  title: string
  summary: string
  guidance?: string
  evidence?: { quote: string; observationKey: string }[]
  status: "open" | "resolved" // derived from finding status
}

export interface OpenItemsResult {
  items: OpenItem[]
  counts: {
    total: number
    critical: number
    material: number
    attention: number
    informational: number
  }
}

// Map rule keys to human-readable categories
function categorizeRuleKey(ruleKey: string): string {
  if (ruleKey.includes("scope")) return "Scope"
  if (ruleKey.includes("payment")) return "Payment"
  if (ruleKey.includes("timeline")) return "Timeline"
  if (ruleKey.includes("communication")) return "Communication"
  if (ruleKey.includes("revision")) return "Revisions"
  if (ruleKey.includes("legal")) return "Legal"
  if (ruleKey.includes("ip") || ruleKey.includes("ownership")) return "IP / Ownership"
  if (ruleKey.includes("client") || ruleKey.includes("behavior")) return "Client Behavior"
  if (ruleKey.includes("liability")) return "Liability"
  if (ruleKey.includes("termination")) return "Termination"
  if (ruleKey.includes("vesting")) return "Vesting"
  if (ruleKey.includes("governance")) return "Governance"
  if (ruleKey.includes("transfer")) return "Transfer"
  if (ruleKey.includes("dilution")) return "Dilution"
  if (ruleKey.includes("contribution")) return "Contributions"
  if (ruleKey.includes("profit")) return "Profit Sharing"
  if (ruleKey.includes("authority")) return "Authority"
  if (ruleKey.includes("exit")) return "Exit"
  if (ruleKey.includes("dissolution")) return "Dissolution"
  if (ruleKey.includes("confidentiality")) return "Confidentiality"
  if (ruleKey.includes("structure")) return "Structure"
  if (ruleKey.includes("role")) return "Roles"
  if (ruleKey.includes("compensation")) return "Compensation"
  if (ruleKey.includes("warranty")) return "Warranty"
  if (ruleKey.includes("delivery")) return "Delivery"
  if (ruleKey.includes("subject")) return "Subject Matter"
  if (ruleKey.includes("termination")) return "Termination"
  if (ruleKey.includes("maintenance")) return "Maintenance"
  if (ruleKey.includes("deposit")) return "Deposit"
  return "General"
}

// Generate a stable, human-readable title from a finding
function generateOpenItemTitle(finding: Finding, _ruleKey: string): string {
  // Use the finding summary but make it action-oriented
  const summary = finding.summary
  const lower = summary.toLowerCase()
  // Convert "X is missing" → "Add X" or "Clarify X"
  // Handle patterns like "No X were identified/defined/found"
  if (lower.includes("missing") || lower.includes("not found") || lower.includes("not identified") || lower.includes("not defined") || lower.includes("were identified") || lower.includes("were defined") || lower.includes("were found")) {
    const cleaned = summary.replace(/^(no|missing|not found|not identified|not defined|no)\s+/i, "")
      .replace(/\b(were|was)\s+(identified|defined|found)\b/i, "")
      .trim()
    return `Add ${cleaned.charAt(0).toLowerCase() + cleaned.slice(1)}`
  }
  if (lower.includes("unclear") || lower.includes("ambiguous")) {
    return `Clarify ${lower.replace(/^.*?(unclear|ambiguous)\s+/i, "").trim()}`
  }
  if (lower.includes("unlimited")) {
    return `Limit ${lower.replace(/^.*?unlimited\s+/i, "").trim()}`
  }
  if (lower.includes("risk") || lower.includes("exposure")) {
    return `Address ${lower.replace(/^.*?(risk|exposure)\s+/i, "").trim()}`
  }
  // Default: use summary as-is but ensure it's a complete thought
  return summary.charAt(0).toUpperCase() + summary.slice(1)
}

export function deriveOpenItems(results: RuleResult[]): OpenItemsResult {
  const items: OpenItem[] = []
  
  for (const result of results) {
    if (result.status === "FAIL" && result.finding) {
      const finding = result.finding
      items.push({
        id: result.ruleKey,
        findingId: result.ruleKey,
        category: categorizeRuleKey(result.ruleKey),
        severity: finding.severity,
        title: generateOpenItemTitle(finding, result.ruleKey),
        summary: finding.summary,
        guidance: finding.guidance,
        evidence: finding.evidence?.map(e => ({ 
          quote: e.quote ?? "", 
          observationKey: e.observationKey 
        })) ?? [],
        status: "open",
      })
    } else if (result.status === "UNKNOWN") {
      const unknownKey = result.ruleKey.replace(/-/g, " ");
      const withSpaces = unknownKey.replace(/([A-Z])/g, (match: string) => " " + match);
      const unknownTitle = "Confirm " + withSpaces.toLowerCase();
      items.push({
        id: result.ruleKey,
        findingId: result.ruleKey,
        category: categorizeRuleKey(result.ruleKey),
        severity: "informational",
        title: unknownTitle,
        summary: result.reason,
        guidance: "Provide the missing information to resolve this item.",
        evidence: [],
        status: "open",
      })
    }
    // PASS findings do not create open items
  }

  // Sort by severity: critical > material > attention > informational
  const severityOrder = { critical: 0, material: 1, attention: 2, informational: 3 }
  items.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

  const counts = {
    total: items.length,
    critical: items.filter(i => i.severity === "critical").length,
    material: items.filter(i => i.severity === "material").length,
    attention: items.filter(i => i.severity === "attention").length,
    informational: items.filter(i => i.severity === "informational").length,
  }

  return { items, counts };
}

// For use in UI: compute open items from audit's deterministicFindings
export function getOpenItemsFromAudit(audit: { structured_data?: Record<string, unknown> }): OpenItemsResult {
  const structured = audit.structured_data as Record<string, unknown> | null
  const findings = (structured?.deterministicFindings as RuleResult[] | undefined) ?? []
  return deriveOpenItems(findings)
}

// For use in chat context: compute open items from conversation context
export function getOpenItemsFromConversation(
  audit: { structured_data?: Record<string, unknown> } | null,
  conversationMessages: ConversationMessageWithMetadata[]
): OpenItemsResult {
  if (!audit) return { items: [], counts: { total: 0, critical: 0, material: 0, attention: 0, informational: 0 } }
  
  // First try to get from audit's deterministic findings
  const auditItems = getOpenItemsFromAudit(audit)
  if (auditItems.items.length > 0) return auditItems
  
  // Fallback: check latest risk_report message in conversation for findings
  const riskMsg = conversationMessages
    .filter(m => m.metadata?.type === "risk_report" && m.role === "assistant")
    .pop()
  
  if (riskMsg?.metadata?.payload?.findings) {
    const findings = riskMsg.metadata.payload.findings as Array<{ severity: string; summary: string; whyItMatters?: string }>
    const items: OpenItem[] = findings
      .filter(f => f.severity !== "low")
      .map((f, i) => {
        const prefix = f.whyItMatters ? "Address " : "Review ";
        return {
          id: "conversation-" + i,
          findingId: "conversation-" + i,
          category: "Risk",
          severity: f.severity as "critical" | "material" | "attention" | "informational",
          title: prefix + f.summary.toLowerCase(),
          summary: f.summary,
          guidance: f.whyItMatters,
          evidence: [],
          status: "open" as const,
        }
      })
    
    const counts = {
      total: items.length,
      critical: items.filter(i => i.severity === "critical").length,
      material: items.filter(i => i.severity === "material").length,
      attention: items.filter(i => i.severity === "attention").length,
      informational: items.filter(i => i.severity === "informational").length,
    }
    return { items, counts }
  }
  
  return { items: [], counts: { total: 0, critical: 0, material: 0, attention: 0, informational: 0 } }
}