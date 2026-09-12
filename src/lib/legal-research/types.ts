// Legal research domain model (Phase 27-30).
//
// Jurisdiction is context (country + region), not product identity. The model
// distinguishes country, jurisdiction, source type, authority, and temporal
// metadata so future jurisdictions can be added without rewriting call sites.
// Nigeria was the initial verified jurisdiction; US/UK/EU are now verified
// where coverage exists; Testland remains a synthetic fixture.

export type JurisdictionScope = "country" | "state_province" | "territory" | "global" | "custom"

export interface Jurisdiction {
  scope: JurisdictionScope
  country: string // ISO 3166-1 alpha-2 or full name; Phase 27 uses "Nigeria"
  region?: string | null // state, province, or custom code when scoped
}

export type LegalSourceKind =
  | "act"
  | "regulation"
  | "subsidiary_legislation"
  | "official_guidance"
  | "regulatory_publication"
  | "court_decision"
  | "official_registry"
  | "gazette"

export type AuthorityTier = 1 | 2 | 3

export type TemporalStatus = "current" | "amended" | "repealed" | "superseded" | "unknown"

export type VeracityState = "VERIFIED" | "SUPPORTED" | "CONFLICTING" | "STALE" | "UNVERIFIED" | "NOT_FOUND" | "NEEDS_JURISDICTION"

export interface LegalAuthorityProvenance {
  sourceName: string
  sourceReference: string // section, article, page
  sourceAuthority: string // publisher / issuing body
  publisher: string | null
  originalUri: string | null
  retrievedAt: string // ISO datetime
  publishedAt?: string | null
  effectiveFrom: string // YYYY-MM-DD
  effectiveTo: string | null
  temporalStatus: TemporalStatus
  jurisdiction: Jurisdiction
  authorityTier: AuthorityTier
  kind: LegalSourceKind
}

export interface LegalSource extends LegalAuthorityProvenance {
  id: string
  title: string
  content: string // extracted relevant passage, bounded length
  excerpt: string // shorter supporting passage for citation
  citationText: string // human citation string
  contentHash?: string | null
}

export interface LegalCitation {
  sourceId: string
  title: string
  section: string // sourceReference
  url: string | null
  passage: string // excerpt
  retrievedAt: string
  effectiveStatus: TemporalStatus
  jurisdiction: string // display, e.g. "Nigeria"
  authorityTier: AuthorityTier
}

export interface ResearchQuery {
  text: string
  jurisdiction: Jurisdiction
  dealType?: string | null // founder | partnership | etc.
  issueClassification?: string | null
}

export interface ResearchResult {
  state: VeracityState
  citations: LegalCitation[]
  sources: LegalSource[]
  limitations: string | null // human-readable uncertainty / conflict note
  retrievedAt: string
  /** Structured observability. Never includes private deal contents. Optional for backward compat. */
  meta?: {
    jurisdiction: string
    queryClass: string | null
    attempted: number
    accepted: number
    durationMs: number
    live: boolean
    failureReason: string | null
  }
}

export interface GroundedAnswer {
  answer: string
  citations: LegalCitation[]
  state: VeracityState
  limitations: string | null
  requiresLawyerReview: boolean
}
