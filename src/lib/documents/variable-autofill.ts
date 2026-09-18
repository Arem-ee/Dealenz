// Document variable auto-fill (Phase 21C).
//
// Maps canonical audit facts and context envelope to document template variables.
// Preserves provenance: every auto-filled value carries its source (extracted,
// inferred, user_confirmed) so the UI can distinguish known from proposed.
//
import type { ExtractedData } from "@/lib/ai/extract"
import type { ContextEnvelope } from "@/lib/context/schema"
import type { DocumentVariables } from "./types"
import type { Jurisdiction } from "@/lib/legal-research/types"

export interface VariableProvenance {
  value: string
  source: "extracted" | "context" | "fact" | "inferred"
  confidence: number
  observationKey?: string
}

export interface AutoFillResult {
  variables: DocumentVariables
  provenance: Record<string, VariableProvenance>
  missing: string[]
}

// Map clause variable keys to canonical fact/context paths
// This is the single source of truth for variable auto-fill mapping
interface VariableMapping {
  // ExtractedData field path (dot notation)
  extracted?: string
  // ContextEnvelope field path
  context?: string
  // Vertical fact path (e.g. "facts.freelance.fee.text")
  fact?: string
  // Transform function
  transform?: (value: unknown) => string
}

const VARIABLE_SOURCE_MAP: Record<string, VariableMapping> = {
  // Freelance / generic variables
  client_name: {
    context: "counterpartyRole",
    transform: (v): string => v === "client" ? "Client" : String(v),
  },
  contractor_name: {
    context: "userRole",
    transform: (v): string => v === "freelancer" ? "Contractor" : String(v),
  },
  company_name: {
    context: "entityTypes",
    transform: (v): string => Array.isArray(v) ? v[0] : String(v),
  },
  project_type: {
    extracted: "projectType",
  },
  timeline: {
    extracted: "timeline",
  },
  budget: {
    extracted: "budget",
  },
  fee: {
    fact: "facts.freelance.fee.text",
  },
  currency: {
    fact: "facts.freelance.currency.text",
    extracted: "budget",
    transform: (v): string => {
      if (typeof v === "string") {
        const match = v.match(/\b(USD|EUR|NGN|GBP|GHS|KES|ZAR|CAD|AUD)\b/i)
        return match ? match[0].toUpperCase() : ""
      }
      return ""
    },
  },
  payment_terms: {
    fact: "facts.freelance.paymentTiming.text",
  },
  deposit: {
    fact: "facts.freelance.deposit.text",
  },
  milestones: {
    fact: "facts.freelance.milestones.text",
  },
  revisions: {
    fact: "facts.freelance.revisions.text",
  },
  delivery: {
    fact: "facts.freelance.delivery.text",
    extracted: "timeline",
  },
  acceptance: {
    fact: "facts.freelance.acceptance.text",
  },
  termination: {
    fact: "facts.freelance.termination.text",
  },
  ownership: {
    fact: "facts.freelance.ownership.text",
  },
  liability: {
    fact: "facts.freelance.liability.text",
  },
  liability_cap: {
    fact: "facts.freelance.liabilityCap.text",
  },
  indemnity: {
    fact: "facts.freelance.indemnity.text",
  },
  dispute_resolution: {
    fact: "facts.freelance.disputeResolution.text",
  },
  jurisdiction: {
    context: "jurisdiction",
    transform: (v): string => {
      if (typeof v === "object" && v && "country" in v) {
        return (v as { country: string }).country
      }
      return ""
    },
  },
  // Founder variables
  founder_names: {
    fact: "facts.founder.ownershipSplit.text",
    transform: (v): string => v ? String(v).replace(/ownership|split|%/gi, "").trim() : "",
  },
  ownership_percentages: {
    fact: "facts.founder.ownershipSplit.text",
  },
  vesting_period: {
    fact: "facts.founder.vesting.text",
  },
  cliff: {
    fact: "facts.founder.vesting.text",
    transform: (v): string => v ? String(v).replace(/vesting|period|years?/gi, "").trim() : "",
  },
  acceleration: {
    fact: "facts.founder.acceleration.text",
  },
  ip_scope: {
    fact: "facts.founder.ipAssignment.text",
  },
  governance_thresholds: {
    fact: "facts.founder.governance.text",
  },
  reserved_matters: {
    fact: "facts.founder.reservedMatters.text",
  },
  deadlock_mechanism: {
    fact: "facts.founder.deadlock.text",
  },
  leaver_definitions: {
    fact: "facts.founder.leaver.text",
  },
  buyout_price: {
    fact: "facts.founder.buyout.text",
  },
  transfer_consent: {
    fact: "facts.founder.transfer.text",
  },
  liability_cap_amount: {
    fact: "facts.founder.liabilityCap.text",
  },
  // Partnership variables
  partner_names: {
    fact: "facts.partnership.contributions.text",
  },
  contribution_amounts: {
    fact: "facts.partnership.contributions.text",
  },
  contribution_timing: {
    fact: "facts.partnership.contributions.text",
  },
  profit_percentages: {
    fact: "facts.partnership.profit.text",
  },
  distribution_timing: {
    fact: "facts.partnership.profit.text",
  },
  managing_partner: {
    fact: "facts.partnership.authority.text",
  },
  authority_to_bind: {
    fact: "facts.partnership.authority.text",
  },
  voting_thresholds: {
    fact: "facts.partnership.governance.text",
  },
  exit_valuation: {
    fact: "facts.partnership.exit.text",
  },
  dissolution_triggers: {
    fact: "facts.partnership.dissolution.text",
  },
  ip_owner: {
    fact: "facts.partnership.ip.text",
  },
  confidentiality_scope: {
    fact: "facts.partnership.confidentiality.text",
  },
  liability_allocation: {
    fact: "facts.partnership.liability.text",
  },
  partnership_structure: {
    fact: "facts.partnership.structure.text",
  },
  // Purchase/Sale variables
  purchase_price: {
    fact: "facts.purchase_sale.price.text",
  },
  purchase_payment_timing: {
    fact: "facts.purchase_sale.payment.text",
  },
  inspection_window: {
    fact: "facts.purchase_sale.inspection.text",
  },
  warranty_scope: {
    fact: "facts.purchase_sale.warranty.text",
  },
  title_trigger: {
    fact: "facts.purchase_sale.transfer.text",
  },
  // Lease variables
  rent_amount: {
    fact: "facts.lease.rent.text",
  },
  payment_frequency: {
    fact: "facts.lease.payment.text",
  },
  deposit_amount: {
    fact: "facts.lease.deposit.text",
  },
  lease_term: {
    fact: "facts.lease.term.text",
  },
  lease_notice_period: {
    fact: "facts.lease.termination.text",
  },
  maintenance_party: {
    fact: "facts.lease.maintenance.text",
  },
  repair_allocation: {
    fact: "facts.lease.repair.text",
  },
  consent_mechanism: {
    fact: "facts.lease.transfer.text",
  },
  // Employment variables
  salary_amount: {
    fact: "facts.employment.compensation.text",
  },
  pay_frequency: {
    fact: "facts.employment.compensation.text",
  },
  job_title: {
    fact: "facts.employment.role.text",
  },
  key_duties: {
    fact: "facts.employment.duties.text",
  },
  probation_terms: {
    fact: "facts.employment.probation.text",
  },
  termination_grounds: {
    fact: "facts.employment.termination.text",
  },
  employment_notice_period: {
    fact: "facts.employment.termination.text",
  },
}

// Helper to get nested value from object using dot notation
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce((acc: unknown, key: string): unknown => {
    if (acc && typeof acc === "object" && key in acc) {
      return (acc as Record<string, unknown>)[key]
    }
    return undefined
  }, obj)
}

// Resolve jurisdiction from context envelope
function resolveJurisdiction(envelope: ContextEnvelope | null): Jurisdiction | null {
  if (!envelope) return null
  const field = envelope.fields.jurisdiction
  if (field.source === "unknown" || !field.value) return null
  if (typeof field.value === "object" && field.value && "country" in field.value) {
    return field.value as Jurisdiction
  }
  if (typeof field.value === "string") {
    return { scope: "country", country: field.value, region: null }
  }
  return null
}

// Main auto-fill function
export function autoFillDocumentVariables(
  extracted: ExtractedData,
  envelope: ContextEnvelope | null,
  dealType: string,
  familyId: string,
  requiredVars: string[]
): AutoFillResult {
  const variables: DocumentVariables = {}
  const provenance: Record<string, VariableProvenance> = {}
  const missing: string[] = []

  // Build a combined source object for lookup
  const sources = {
    extracted,
    envelope,
    // vertical facts would be added here when available
  }

  for (const varKey of requiredVars) {
    const mapping = VARIABLE_SOURCE_MAP[varKey]
    let value: string | undefined
    let source: VariableProvenance["source"] = "inferred"
    let confidence = 0.5
    let observationKey: string | undefined

    if (mapping) {
      // Try fact first (most authoritative for deal-specific vars)
      if (mapping.fact) {
        // Facts would need to be passed in separately
        // For now, skip fact-based resolution
      }

      // Try extracted
      if (!value && mapping.extracted) {
        const extractedValue = getNestedValue(extracted as unknown as Record<string, unknown>, mapping.extracted)
        if (extractedValue !== undefined && extractedValue !== null) {
          value = mapping.transform ? mapping.transform(extractedValue) : String(extractedValue)
          source = "extracted"
          confidence = extracted.confidence
          observationKey = `extracted.${mapping.extracted}`
        }
      }

      // Try context
      if (!value && mapping.context && envelope) {
        const contextValue = getNestedValue(envelope.fields as Record<string, unknown>, mapping.context)
        if (contextValue !== undefined && contextValue !== null) {
          const field = (envelope.fields as Record<string, unknown>)[mapping.context] as { value: unknown; source: string; confidence: number } | undefined
          value = mapping.transform ? mapping.transform(contextValue) : String(contextValue)
          source = field?.source === "user_confirmed" ? "context" : "inferred"
          confidence = field?.confidence ?? 0.7
          observationKey = `context.${mapping.context}`
        }
      }

      // Special handling for jurisdiction
      if (varKey === "jurisdiction" && !value) {
        const jurisdiction = resolveJurisdiction(envelope)
        if (jurisdiction) {
          value = jurisdiction.country
          source = "context"
          confidence = 0.9
          observationKey = "context.jurisdiction"
        }
      }
    }

    const stringValue = typeof value === "string" ? value : value !== undefined && value !== null ? String(value) : ""
    if (stringValue && stringValue.trim().length > 0) {
      variables[varKey] = stringValue.trim()
      provenance[varKey] = { value: stringValue.trim(), source, confidence, observationKey }
    } else {
      missing.push(varKey)
    }
  }

  return { variables, provenance, missing }
}

// Determine required variables for a document family
export function getRequiredVariablesForFamily(familyId: string, dealType: string): string[] {
  // This mirrors the logic in assembly.ts but returns just the variable keys
  // We need to know which clause variables are required for this family
  // For now, return common variables - the actual resolution happens in assembleDraft
  const commonVars = ["jurisdiction"]
  if (dealType === "partnership") commonVars.push("partnership_structure")

  // Family-specific variables would be determined by clauseTemplates
  // For now, return empty - the actual missing variables are determined at assembly time
  return commonVars
}

export function getClauseVariablesForFamily(familyId: string, dealType: string): string[] {
  // This would require importing the clause library and family definitions
  // For now, return empty - actual variables resolved at assembly
  return []
}