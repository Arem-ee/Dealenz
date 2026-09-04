// Knowledge Item domain model (Phase 5C).
//
// A Knowledge Item is source material that may be relevant to a deal — never a
// legal conclusion. Authority, provenance, jurisdiction, effective dates,
// version, and status are explicit structured fields so that an industry blog
// post can never look indistinguishable from statutory law. Nothing here
// invents law: items enter only through the validated ingestion boundary
// (ingest.ts), and unknown provenance is represented explicitly, never fabricated.

export type KnowledgeKind =
  | "statute"
  | "regulation"
  | "case_law"
  | "official_guidance"
  | "contractual_standard"
  | "industry_standard"
  | "market_practice"
  | "internal_policy"

export const KNOWLEDGE_KINDS: readonly KnowledgeKind[] = [
  "statute",
  "regulation",
  "case_law",
  "official_guidance",
  "contractual_standard",
  "industry_standard",
  "market_practice",
  "internal_policy",
]

// Authority is explicit metadata, never buried in free text. Higher authority
// never means "definitely applies" — applicability is decided separately by
// the resolver against a resolved context.
export type KnowledgeAuthority =
  | "authoritative"
  | "official_guidance"
  | "secondary"
  | "industry_practice"
  | "market_practice"

export const KNOWLEDGE_AUTHORITIES: readonly KnowledgeAuthority[] = [
  "authoritative",
  "official_guidance",
  "secondary",
  "industry_practice",
  "market_practice",
]

export type JurisdictionScope = "global" | "country" | "state_province" | "territory" | "custom"

export const JURISDICTION_SCOPES: readonly JurisdictionScope[] = [
  "global",
  "country",
  "state_province",
  "territory",
  "custom",
]

export type KnowledgeStatus = "draft" | "verified" | "published" | "superseded" | "withdrawn"

export const KNOWLEDGE_STATUSES: readonly KnowledgeStatus[] = [
  "draft",
  "verified",
  "published",
  "superseded",
  "withdrawn",
]

export interface KnowledgeJurisdiction {
  scope: JurisdictionScope
  // Null only for global. Otherwise the jurisdiction identifier as written
  // (country/region name or code, max 120 chars). No closed taxonomy: the
  // supported-jurisdiction list is still an open product decision.
  code: string | null
}

export interface KnowledgeProvenance {
  source: string
  sourceReference: string
  sourceAuthority: string
  retrievedAt: string
  publisher: string | null
  originalUri: string | null
  checksum: string | null
}

// Which contexts an item may be relevant to. Every dimension is optional; an
// absent dimension is unconstrained, never a hidden default.
export interface KnowledgeApplicability {
  dealTypes?: Array<"freelance" | "generic">
  industries?: string[]
  structures?: string[]
  entityTypes?: string[]
  stages?: string[]
  regulatedOnly?: boolean
  crossBorderOnly?: boolean
}

export interface KnowledgeItem {
  id: string
  // Stable across versions of the same item ("late-payment-interest-v1" style
  // keys are per-version; the key identifies the item lineage, not the version).
  itemKey: string
  version: number
  title: string
  kind: KnowledgeKind
  authority: KnowledgeAuthority
  jurisdiction: KnowledgeJurisdiction
  provenance: KnowledgeProvenance
  // ISO date strings (YYYY-MM-DD). effectiveTo null means open-ended current.
  effectiveFrom: string
  effectiveTo: string | null
  status: KnowledgeStatus
  content: string
  applicability: KnowledgeApplicability
  // Points at the newer version that replaced this one. Set only on superseded rows.
  supersededByVersion: number | null
  createdAt: string
  updatedAt: string
}

const MAX_SHORT = 200
const MAX_TEXT = 120
const MAX_CONTENT = 20000
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function shortText(value: unknown, max: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max
}

function isoDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false
  const time = Date.parse(`${value}T00:00:00Z`)
  return Number.isFinite(time)
}

function isoDateTime(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && Number.isFinite(Date.parse(value))
}

function checkJurisdiction(raw: unknown): KnowledgeJurisdiction {
  if (!isRecord(raw)) throw new Error("Knowledge item has an invalid jurisdiction")
  const { scope, code } = raw
  if (!(JURISDICTION_SCOPES as readonly string[]).includes(scope as string)) {
    throw new Error("Knowledge item has an invalid jurisdiction scope")
  }
  if (scope === "global") {
    if (code !== null) throw new Error("Global jurisdiction must not carry a code")
    return { scope, code: null }
  }
  if (!shortText(code, MAX_TEXT)) throw new Error("Knowledge item has an invalid jurisdiction code")
  return { scope: scope as JurisdictionScope, code: (code as string).trim() }
}

function checkProvenance(raw: unknown): KnowledgeProvenance {
  if (!isRecord(raw)) throw new Error("Knowledge item has invalid provenance")
  const { source, sourceReference, sourceAuthority, retrievedAt, publisher, originalUri, checksum } = raw
  // Unknown sources are represented explicitly (e.g. source "unknown",
  // reference "not-provided") — never fabricated, but never absent either.
  if (!shortText(source, MAX_TEXT)) throw new Error("Knowledge item has an invalid provenance source")
  if (!shortText(sourceReference, MAX_TEXT)) throw new Error("Knowledge item has an invalid source reference")
  if (!shortText(sourceAuthority, MAX_TEXT)) throw new Error("Knowledge item has an invalid source authority")
  if (!isoDateTime(retrievedAt)) throw new Error("Knowledge item has an invalid retrievedAt timestamp")
  for (const [key, val] of [["publisher", publisher], ["originalUri", originalUri], ["checksum", checksum]] as const) {
    if (val !== null && !shortText(val, MAX_SHORT)) {
      throw new Error(`Knowledge item has an invalid provenance ${key}`)
    }
  }
  return {
    source: (source as string).trim(),
    sourceReference: (sourceReference as string).trim(),
    sourceAuthority: (sourceAuthority as string).trim(),
    retrievedAt: retrievedAt as string,
    publisher: (publisher as string | null) ?? null,
    originalUri: (originalUri as string | null) ?? null,
    checksum: (checksum as string | null) ?? null,
  }
}

function checkStringList(raw: unknown, field: string, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > maxItems) {
    throw new Error(`Knowledge item has an invalid ${field} list`)
  }
  return raw.map((entry) => {
    if (!shortText(entry, maxLen)) throw new Error(`Knowledge item has an invalid ${field} entry`)
    return (entry as string).trim()
  })
}

function checkApplicability(raw: unknown): KnowledgeApplicability {
  if (raw === null || raw === undefined) return {}
  if (!isRecord(raw)) throw new Error("Knowledge item has an invalid applicability block")
  const out: KnowledgeApplicability = {}
  if (raw.dealTypes !== undefined) {
    if (
      !Array.isArray(raw.dealTypes) ||
      raw.dealTypes.length === 0 ||
      !raw.dealTypes.every((d) => d === "freelance" || d === "generic")
    ) {
      throw new Error("Knowledge item has invalid applicability dealTypes")
    }
    out.dealTypes = [...(raw.dealTypes as Array<"freelance" | "generic">)]
  }
  if (raw.industries !== undefined) out.industries = checkStringList(raw.industries, "industries", 20, MAX_TEXT)
  if (raw.structures !== undefined) out.structures = checkStringList(raw.structures, "structures", 20, MAX_TEXT)
  if (raw.entityTypes !== undefined) out.entityTypes = checkStringList(raw.entityTypes, "entityTypes", 10, MAX_TEXT)
  if (raw.stages !== undefined) out.stages = checkStringList(raw.stages, "stages", 20, MAX_TEXT)
  if (raw.regulatedOnly !== undefined) {
    if (typeof raw.regulatedOnly !== "boolean") throw new Error("Knowledge item has an invalid regulatedOnly flag")
    out.regulatedOnly = raw.regulatedOnly
  }
  if (raw.crossBorderOnly !== undefined) {
    if (typeof raw.crossBorderOnly !== "boolean") throw new Error("Knowledge item has an invalid crossBorderOnly flag")
    out.crossBorderOnly = raw.crossBorderOnly
  }
  return out
}

// Validates an unknown value into a KnowledgeItem. Throws on anything
// malformed — callers fail safely and never persist the input.
export function parseKnowledgeItem(raw: unknown): KnowledgeItem {
  if (!isRecord(raw)) throw new Error("Knowledge item must be an object")
  const {
    id, itemKey, version, title, kind, authority, jurisdiction, provenance,
    effectiveFrom, effectiveTo, status, content, applicability, supersededByVersion,
    createdAt, updatedAt,
  } = raw

  if (!shortText(id, MAX_TEXT)) throw new Error("Knowledge item has an invalid id")
  if (!shortText(itemKey, MAX_TEXT)) throw new Error("Knowledge item has an invalid itemKey")
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
    throw new Error("Knowledge item has an invalid version (must be an integer >= 1)")
  }
  if (!shortText(title, MAX_SHORT)) throw new Error("Knowledge item has an invalid title")
  if (!(KNOWLEDGE_KINDS as readonly string[]).includes(kind as string)) {
    throw new Error("Knowledge item has an invalid kind")
  }
  if (!(KNOWLEDGE_AUTHORITIES as readonly string[]).includes(authority as string)) {
    throw new Error("Knowledge item has an invalid authority")
  }
  if (!shortText(content, MAX_CONTENT)) throw new Error("Knowledge item has invalid content")
  if (!isoDate(effectiveFrom)) throw new Error("Knowledge item has an invalid effectiveFrom date")
  if (effectiveTo !== null && !isoDate(effectiveTo)) {
    throw new Error("Knowledge item has an invalid effectiveTo date")
  }
  if (effectiveTo !== null && (effectiveTo as string) < (effectiveFrom as string)) {
    throw new Error("Knowledge item effectiveTo precedes effectiveFrom")
  }
  if (!(KNOWLEDGE_STATUSES as readonly string[]).includes(status as string)) {
    throw new Error("Knowledge item has an invalid status")
  }
  if (supersededByVersion !== null && (typeof supersededByVersion !== "number" || !Number.isInteger(supersededByVersion) || supersededByVersion < 1)) {
    throw new Error("Knowledge item has an invalid supersededByVersion")
  }
  if (status !== "superseded" && supersededByVersion !== null) {
    throw new Error("Only superseded items may carry supersededByVersion")
  }
  if (!isoDateTime(createdAt) || !isoDateTime(updatedAt)) {
    throw new Error("Knowledge item has invalid timestamps")
  }

  return {
    id: (id as string).trim(),
    itemKey: (itemKey as string).trim(),
    version,
    title: (title as string).trim(),
    kind: kind as KnowledgeKind,
    authority: authority as KnowledgeAuthority,
    jurisdiction: checkJurisdiction(jurisdiction),
    provenance: checkProvenance(provenance),
    effectiveFrom: effectiveFrom as string,
    effectiveTo: (effectiveTo as string | null) ?? null,
    status: status as KnowledgeStatus,
    content: content as string,
    applicability: checkApplicability(applicability),
    supersededByVersion: (supersededByVersion as number | null) ?? null,
    createdAt: createdAt as string,
    updatedAt: updatedAt as string,
  }
}
