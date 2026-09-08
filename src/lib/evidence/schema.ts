// Evidence domain (Phase 7).
//
// Evidence is an observation reference, not a legal conclusion. An Evidence
// object answers: what source was observed, which portion supports the
// observation, what was actually seen, what method produced it, how confident
// that method is, and whether the underlying source can still be inspected.
// Facts, inferences, knowledge, findings, and AI conclusions stay distinct:
// evidence only ever points at observations.

export type EvidenceSourceType = "audit_input" | "conversation_input" | "extraction" | "knowledge"

export const EVIDENCE_SOURCE_TYPES: readonly EvidenceSourceType[] = [
  "audit_input",
  "conversation_input",
  "extraction",
  "knowledge",
]

export type LocationKind = "exact" | "approximate" | "unavailable"

export interface EvidenceLocation {
  kind: LocationKind
  // Character offsets into the source text. Present ONLY when kind is exact;
  // the current pipeline cannot guarantee offsets, so exact locations must
  // come from a future adapter that proves them, never from guessing.
  startOffset?: number
  endOffset?: number
  // Human-meaningful section label (e.g. which input part was observed).
  // Allowed for exact and approximate locations.
  section?: string
}

export type ObservationMethod = "pattern_observation" | "ai_extraction" | "knowledge_reference" | "user_confirmed"

export const OBSERVATION_METHODS: readonly ObservationMethod[] = [
  "pattern_observation",
  "ai_extraction",
  "knowledge_reference",
  "user_confirmed",
]

export interface Evidence {
  // Deterministic content hash (source + key + quote + location). Same
  // observation always yields the same id; ids are content-derived, never
  // sequential, so they double as integrity checks.
  id: string
  sourceType: EvidenceSourceType
  // Audit id, knowledge item key, or null when there is no stable handle
  // (e.g. an anonymous conversation turn).
  sourceId: string | null
  // Version of the source where applicable (knowledge item version,
  // document version). Null when the source is unversioned.
  sourceVersion: number | null
  location: EvidenceLocation
  // The actually observed text, truncated for transport. Null when the
  // observation has no quotable surface (e.g. a knowledge reference, which
  // points at the item instead of duplicating it).
  quote: string | null
  // Which fact or finding this evidence supports, e.g.
  // "facts.freelance.fee" or "knowledge:us-copyright-transfer-writing".
  observationKey: string
  method: ObservationMethod
  // Bounded method confidence (0-1). Pattern matches report a fixed
  // documented constant; AI extraction reports the extraction confidence.
  // Never legal certainty, never a risk score.
  confidence: number
  // Whether the underlying source can still be opened for inspection.
  // False for ephemeral inputs (anonymous conversation) and always true
  // for persisted audits and knowledge items.
  inspectable: boolean
}

const MAX_QUOTE = 500
const MAX_KEY = 200
const MAX_ID = 120

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function shortText(value: unknown, max: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max
}

function checkLocation(raw: unknown): EvidenceLocation {
  if (!isRecord(raw)) throw new Error("Evidence has an invalid location")
  const { kind, startOffset, endOffset, section } = raw
  if (kind !== "exact" && kind !== "approximate" && kind !== "unavailable") {
    throw new Error("Evidence location needs a valid kind")
  }
  if (kind === "exact") {
    if (
      typeof startOffset !== "number" ||
      !Number.isInteger(startOffset) ||
      startOffset < 0 ||
      typeof endOffset !== "number" ||
      !Number.isInteger(endOffset) ||
      endOffset <= startOffset
    ) {
      throw new Error("Exact evidence locations need valid integer offsets with end after start")
    }
  } else if (startOffset !== undefined || endOffset !== undefined) {
    // Offsets without exactness would fake precision.
    throw new Error("Only exact evidence locations may carry offsets")
  }
  if (section !== undefined && !shortText(section, MAX_KEY)) {
    throw new Error("Evidence location has an invalid section")
  }
  const location: EvidenceLocation = { kind }
  if (kind === "exact") {
    location.startOffset = startOffset as number
    location.endOffset = endOffset as number
  }
  if (typeof section === "string") location.section = section.trim()
  return location
}

export function checkEvidence(raw: unknown): Evidence {
  if (!isRecord(raw)) throw new Error("Evidence must be an object")
  const { id, sourceType, sourceId, sourceVersion, location, quote, observationKey, method, confidence, inspectable } = raw
  if (!shortText(id, MAX_ID)) throw new Error("Evidence needs an id")
  if (!(EVIDENCE_SOURCE_TYPES as readonly string[]).includes(sourceType as string)) {
    throw new Error("Evidence has an invalid source type")
  }
  if (sourceId !== null && !shortText(sourceId, MAX_KEY)) {
    throw new Error("Evidence has an invalid source id")
  }
  if (sourceVersion !== null && (typeof sourceVersion !== "number" || !Number.isInteger(sourceVersion) || sourceVersion < 1)) {
    throw new Error("Evidence has an invalid source version")
  }
  if (quote !== null && (typeof quote !== "string" || quote.length === 0 || quote.length > MAX_QUOTE)) {
    throw new Error("Evidence has an invalid quote")
  }
  if (!shortText(observationKey, MAX_KEY)) throw new Error("Evidence needs an observation key")
  if (!(OBSERVATION_METHODS as readonly string[]).includes(method as string)) {
    throw new Error("Evidence has an invalid observation method")
  }
  if (typeof confidence !== "number" || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new Error("Evidence has an invalid confidence (must be 0-1)")
  }
  if (typeof inspectable !== "boolean") throw new Error("Evidence needs an inspectable flag")
  return {
    id: (id as string).trim(),
    sourceType: sourceType as EvidenceSourceType,
    sourceId: (sourceId as string | null) ?? null,
    sourceVersion: (sourceVersion as number | null) ?? null,
    location: checkLocation(location),
    quote: (quote as string | null) ?? null,
    observationKey: (observationKey as string).trim(),
    method: method as ObservationMethod,
    confidence,
    inspectable,
  }
}

// Deterministic content id (djb2 hex). Same source, key, quote, and location
// always produce the same id across runs, processes, and machines.
export function evidenceId(input: { source: string; key: string; quote: string; location: string }): string {
  const text = `${input.source}\n${input.key}\n${input.quote}\n${input.location}`
  let hash = 5381
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) >>> 0
  }
  return `ev_${hash.toString(16).padStart(8, "0")}`
}

export interface MakeEvidenceInput {
  sourceType: EvidenceSourceType
  sourceId: string | null
  sourceVersion?: number | null
  quote?: string | null
  observationKey: string
  method: ObservationMethod
  confidence: number
  inspectable: boolean
  location?: EvidenceLocation
}

function locationLabel(location: EvidenceLocation): string {
  const parts: string[] = [location.kind]
  if (location.section) parts.push(location.section)
  if (location.startOffset !== undefined && location.endOffset !== undefined) {
    parts.push(`${location.startOffset}-${location.endOffset}`)
  }
  return parts.join(":")
}

// Builds a validated Evidence object with a deterministic id. Throws on
// invalid input: callers must fail safely rather than persist bad evidence.
export function makeEvidence(input: MakeEvidenceInput): Evidence {
  const location = input.location ?? { kind: "unavailable" as const }
  const quote = input.quote ?? null
  return checkEvidence({
    id: evidenceId({
      source: `${input.sourceType}:${input.sourceId ?? "anonymous"}`,
      key: input.observationKey,
      quote: quote ?? "",
      location: locationLabel(location),
    }),
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    sourceVersion: input.sourceVersion ?? null,
    location,
    quote,
    observationKey: input.observationKey,
    method: input.method,
    confidence: input.confidence,
    inspectable: input.inspectable,
  })
}
