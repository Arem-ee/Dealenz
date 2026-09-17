import type { UserIntent } from "../ai/operations"

// Context Resolution domain model (Phase 5B).
//
// Context answers "what kind of deal is this, who are the parties, where does
// it operate, and what is necessary before authoritative analysis?" Extraction
// ("what does the document say?") lives in src/lib/ai/extract.ts and stays
// separate. Nothing here decides legal validity, enforceability, compliance,
// applicable law, or lawfulness — those belong to later Knowledge/rules layers.

export type DealType = "freelance" | "generic" | "lease" | "purchase_sale" | "employment" | "founder" | "partnership"

export const INTENT_VALUES = [
  "explore",
  "understand",
  "evaluate",
  "negotiate",
  "draft",
  "compare",
  "review",
  "decide",
  "propose",
] as const satisfies readonly UserIntent[]

// How a field value came to be. AI inference is never equivalent to user
// confirmation, and the distinction survives persistence.
export type FieldSource = "unknown" | "inferred" | "user_confirmed"

export interface ContextField<T> {
  value: T | null
  source: FieldSource
  // Explicit, bounded, machine-readable. Used only to decide whether the
  // system should request confirmation or flag uncertainty — never presented
  // as legal certainty.
  confidence: number
}

export interface ContextEnvelope {
  version: number
  fields: {
    dealType: ContextField<DealType>
    intent: ContextField<UserIntent>
    priorities: ContextField<string[]>
    jurisdiction: ContextField<string>
    governingLaw: ContextField<string>
    userRole: ContextField<string>
    counterpartyRole: ContextField<string>
    industry: ContextField<string>
    transactionStructure: ContextField<string>
    transactionValue: ContextField<number>
    transactionCurrency: ContextField<string>
    transactionStage: ContextField<string>
    crossBorder: ContextField<boolean>
    regulatedIndustry: ContextField<boolean>
    entityTypes: ContextField<string[]>
  }
  // Required-field keys still unresolved. Empty means nothing required is missing.
  missingRequiredContext: string[]
  updatedAt: string | null
  // User UUID for confirmations, "system:inference" for AI passes, null when untouched.
  updatedBy: string | null
}

export type ContextFieldKey = keyof ContextEnvelope["fields"]

// Closed, generic vocabularies for role-like fields. Deliberately coarse:
// these are routing hints for future framework resolution, not legal taxonomy.
export const ROLE_VALUES = [
  "freelancer",
  "client",
  "employer",
  "employee",
  "contractor",
  "landlord",
  "tenant",
  "buyer",
  "seller",
  "partner",
  "cofounder",
  "investor",
  "founder",
  "service_provider",
  "customer",
  "other",
] as const

export const INDUSTRY_VALUES = [
  "technology",
  "creative",
  "construction",
  "healthcare",
  "finance",
  "education",
  "retail",
  "hospitality",
  "manufacturing",
  "legal",
  "consulting",
  "real_estate",
  "other",
] as const

export const STRUCTURE_VALUES = [
  "fixed_price",
  "hourly",
  "retainer",
  "milestone_based",
  "equity",
  "lease",
  "sale",
  "partnership",
  "employment",
  "other",
] as const

export const STAGE_VALUES = [
  "inquiry",
  "negotiation",
  "draft",
  "review",
  "signed",
  "active",
  "renewal",
  "dispute",
  "other",
] as const

export const ENTITY_TYPE_VALUES = [
  "individual",
  "company",
  "partnership",
  "nonprofit",
  "government",
  "other",
] as const

const MAX_TEXT_LENGTH = 120

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isValidSource(value: unknown): value is FieldSource {
  return value === "unknown" || value === "inferred" || value === "user_confirmed"
}

function isValidConfidence(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1
}

function isValidText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= MAX_TEXT_LENGTH
}

function isValidEnum(value: unknown, allowed: readonly string[]): value is string {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
}

function checkField<T>(
  raw: unknown,
  validateValue: (value: unknown) => value is T,
  fieldName: string
): ContextField<T> {
  if (!isRecord(raw)) throw new Error(`Context field "${fieldName}" must be an object`)
  const { value, source, confidence } = raw
  if (!isValidSource(source)) {
    throw new Error(`Context field "${fieldName}" has an invalid source`)
  }
  if (!isValidConfidence(confidence)) {
    throw new Error(`Context field "${fieldName}" has an invalid confidence (must be 0-1)`)
  }
  if (value !== null && !validateValue(value)) {
    throw new Error(`Context field "${fieldName}" has an invalid value`)
  }
  // Unknown-source fields must not carry a value or confidence; confirmed or
  // inferred fields must carry both a value and a positive confidence.
  if (source === "unknown" && (value !== null || confidence !== 0)) {
    throw new Error(`Context field "${fieldName}" is unknown but carries a value or confidence`)
  }
  if (source !== "unknown" && (value === null || confidence <= 0)) {
    throw new Error(`Context field "${fieldName}" is ${source} but has no value or confidence`)
  }
  return { value: value as T | null, source, confidence }
}

function checkStringArray(raw: unknown, allowed: readonly string[], fieldName: string): string[] | null {
  if (raw === null) return null
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 6) {
    throw new Error(`Context field "${fieldName}" must be null or a non-empty array (max 6)`)
  }
  const seen = new Set<string>()
  for (const entry of raw) {
    if (!isValidEnum(entry, allowed)) {
      throw new Error(`Context field "${fieldName}" has an invalid value`)
    }
    seen.add(entry)
  }
  return [...seen]
}

function isValidPriorityKey(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_TEXT_LENGTH &&
    /^[a-z][a-z0-9_]*$/.test(value)
  )
}

function isValidPriorityList(value: unknown): value is string[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 6) return false
  const seen = new Set<string>()
  for (const entry of value) {
    if (!isValidPriorityKey(entry)) return false
    seen.add(entry)
  }
  return seen.size === value.length
}

function isValidCurrency(value: unknown): value is string {
  return typeof value === "string" && /^[A-Z]{3}$/.test(value)
}

function isValidAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1e12
}

// Validates an unknown persisted/candidate value into a ContextEnvelope.
// Throws on anything malformed — callers must fail safely, never persist it.
export function parseContextEnvelope(raw: unknown): ContextEnvelope {
  if (!isRecord(raw)) throw new Error("Context envelope must be an object")
  const { version, fields, missingRequiredContext, updatedAt, updatedBy } = raw
  if (typeof version !== "number" || !Number.isInteger(version) || version < 0) {
    throw new Error("Context envelope has an invalid version")
  }
  if (!isRecord(fields)) throw new Error("Context envelope has invalid fields")
  if (
    !Array.isArray(missingRequiredContext) ||
    !missingRequiredContext.every((e) => typeof e === "string")
  ) {
    throw new Error("Context envelope has an invalid missingRequiredContext list")
  }
  if (updatedAt !== null && (typeof updatedAt !== "string" || updatedAt.length === 0)) {
    throw new Error("Context envelope has an invalid updatedAt")
  }
  if (updatedBy !== null && (typeof updatedBy !== "string" || updatedBy.length === 0)) {
    throw new Error("Context envelope has an invalid updatedBy")
  }

  const expectedKeys: ContextFieldKey[] = [
    "dealType",
    "intent",
    "priorities",
    "jurisdiction",
    "governingLaw",
    "userRole",
    "counterpartyRole",
    "industry",
    "transactionStructure",
    "transactionValue",
    "transactionCurrency",
    "transactionStage",
    "crossBorder",
    "regulatedIndustry",
    "entityTypes",
  ]
  const actualKeys = Object.keys(fields)
  if (actualKeys.length !== expectedKeys.length || !expectedKeys.every((k) => k in fields)) {
    throw new Error("Context envelope has an unexpected field set")
  }

  return {
    version,
    fields: {
      dealType: checkField<DealType>(
        fields.dealType,
        (v): v is DealType => v === "freelance" || v === "generic" || v === "lease" || v === "purchase_sale" || v === "employment" || v === "founder" || v === "partnership",
        "dealType"
      ),
      intent: checkField<UserIntent>(
        fields.intent,
        (v): v is UserIntent =>
          typeof v === "string" && (INTENT_VALUES as readonly string[]).includes(v),
        "intent"
      ),
      priorities: checkField<string[]>(fields.priorities, isValidPriorityList, "priorities"),
      jurisdiction: checkField<string>(fields.jurisdiction, isValidText, "jurisdiction"),
      governingLaw: checkField<string>(fields.governingLaw, isValidText, "governingLaw"),
      userRole: checkField<string>(fields.userRole, (v) => isValidEnum(v, ROLE_VALUES), "userRole"),
      counterpartyRole: checkField<string>(
        fields.counterpartyRole,
        (v) => isValidEnum(v, ROLE_VALUES),
        "counterpartyRole"
      ),
      industry: checkField<string>(fields.industry, (v) => isValidEnum(v, INDUSTRY_VALUES), "industry"),
      transactionStructure: checkField<string>(
        fields.transactionStructure,
        (v) => isValidEnum(v, STRUCTURE_VALUES),
        "transactionStructure"
      ),
      transactionValue: checkField<number>(fields.transactionValue, isValidAmount, "transactionValue"),
      transactionCurrency: checkField<string>(
        fields.transactionCurrency,
        isValidCurrency,
        "transactionCurrency"
      ),
      transactionStage: checkField<string>(
        fields.transactionStage,
        (v) => isValidEnum(v, STAGE_VALUES),
        "transactionStage"
      ),
      crossBorder: checkField<boolean>(
        fields.crossBorder,
        (v): v is boolean => typeof v === "boolean",
        "crossBorder"
      ),
      regulatedIndustry: checkField<boolean>(
        fields.regulatedIndustry,
        (v): v is boolean => typeof v === "boolean",
        "regulatedIndustry"
      ),
      entityTypes: checkField<string[]>(
        fields.entityTypes,
        (v): v is string[] => checkStringArray(v, ENTITY_TYPE_VALUES, "entityTypes") !== null,
        "entityTypes"
      ),
    },
    missingRequiredContext: [...missingRequiredContext],
    updatedAt,
    updatedBy,
  }
}

function unknownField<T>(): ContextField<T> {
  return { value: null, source: "unknown", confidence: 0 }
}

// Fresh envelope: everything unknown, version 0. Used for brand-new audits
// before any inference or confirmation has run.
export function emptyContextEnvelope(): ContextEnvelope {
  return {
    version: 0,
    fields: {
      dealType: unknownField<DealType>(),
      intent: unknownField<UserIntent>(),
      priorities: unknownField<string[]>(),
      jurisdiction: unknownField<string>(),
      governingLaw: unknownField<string>(),
      userRole: unknownField<string>(),
      counterpartyRole: unknownField<string>(),
      industry: unknownField<string>(),
      transactionStructure: unknownField<string>(),
      transactionValue: unknownField<number>(),
      transactionCurrency: unknownField<string>(),
      transactionStage: unknownField<string>(),
      crossBorder: unknownField<boolean>(),
      regulatedIndustry: unknownField<boolean>(),
      entityTypes: unknownField<string[]>(),
    },
    missingRequiredContext: [],
    updatedAt: null,
    updatedBy: null,
  }
}

// Seed envelope at audit creation: the user explicitly picked the deal type in
// the UI, so it is recorded as user_confirmed with full confidence.
export function seedEnvelopeForDealType(dealType: DealType): ContextEnvelope {
  const envelope = emptyContextEnvelope()
  envelope.version = 1
  envelope.fields.dealType = { value: dealType, source: "user_confirmed", confidence: 1 }
  return envelope
}
