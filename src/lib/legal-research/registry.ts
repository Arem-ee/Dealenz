// Authority registry — jurisdiction → allowed domains (Phase 31).
//
// DATA, not engine: new jurisdictions are added as entries here without
// rewriting research.ts. An entry being present means "eligible for
// retrieval", never "legal coverage verified" — coverage is proven only by
// validated sources in the corpus or live retrieval.
//
// Domain lists reference the canonical constants in allowlist.ts so the
// allowlist remains the single auditable source of truth.

import { TIER_1_DOMAINS, TIER_2_DOMAINS } from "./allowlist"
import type { AuthorityTier, LegalSourceKind } from "./types"

export interface AuthorityRegistryEntry {
  /** Country display name, e.g. "United States". Must match Jurisdiction.country. */
  country: string
  /** Region display name or null for country-wide entry, e.g. "Delaware". */
  region: string | null
  /** Allowlisted domains eligible for retrieval in this jurisdiction. */
  domains: readonly string[]
  /** Authority tier these domains confer. */
  tier: AuthorityTier
  /** Source kinds expected from these authorities. */
  kinds: readonly LegalSourceKind[]
}

function t1(...domains: readonly string[]): readonly string[] {
  for (const d of domains) {
    if (!(TIER_1_DOMAINS as readonly string[]).includes(d)) {
      throw new Error(`Authority registry references non-allowlisted Tier-1 domain: ${d}`)
    }
  }
  return domains
}

export const AUTHORITY_REGISTRY: readonly AuthorityRegistryEntry[] = [
  {
    country: "United States",
    region: "Delaware",
    domains: t1("delcode.delaware.gov", "delaware.gov"),
    tier: 1,
    kinds: ["act", "official_guidance"],
  },
  {
    country: "United States",
    region: "California",
    domains: t1("leginfo.legislature.ca.gov"),
    tier: 1,
    kinds: ["act", "official_guidance"],
  },
  {
    country: "United States",
    region: "New York",
    domains: t1("nysenate.gov"),
    tier: 1,
    kinds: ["act", "official_guidance"],
  },
  {
    country: "United States",
    region: null,
    domains: t1("law.cornell.edu"),
    tier: 1,
    kinds: ["act", "regulation", "official_guidance"],
  },
  {
    country: "United Kingdom",
    region: "England and Wales",
    domains: t1("legislation.gov.uk", "gov.uk"),
    tier: 1,
    kinds: ["act", "regulation", "official_guidance"],
  },
  {
    country: "United Kingdom",
    region: "Scotland",
    domains: t1("legislation.gov.uk", "gov.uk"),
    tier: 1,
    kinds: ["act", "regulation", "official_guidance"],
  },
  {
    country: "United Kingdom",
    region: "Northern Ireland",
    domains: t1("legislation.gov.uk", "gov.uk"),
    tier: 1,
    kinds: ["act", "regulation", "official_guidance"],
  },
  {
    country: "United Kingdom",
    region: null,
    domains: t1("legislation.gov.uk", "gov.uk"),
    tier: 1,
    kinds: ["act", "regulation", "official_guidance"],
  },
  {
    country: "European Union",
    region: null,
    domains: t1("eur-lex.europa.eu", "europa.eu"),
    tier: 1,
    kinds: ["act", "regulation", "official_guidance"],
  },
  {
    country: "Germany",
    region: null,
    domains: t1("gesetze-im-internet.de"),
    tier: 1,
    kinds: ["act", "official_guidance"],
  },
  {
    country: "France",
    region: null,
    domains: t1("legifrance.gouv.fr"),
    tier: 1,
    kinds: ["act", "regulation", "official_guidance"],
  },
  {
    country: "Netherlands",
    region: null,
    domains: t1("wetten.overheid.nl", "overheid.nl"),
    tier: 1,
    kinds: ["act", "regulation", "official_guidance"],
  },
  {
    country: "Nigeria",
    region: null,
    domains: t1(
      "cac.gov.ng",
      "sec.gov.ng",
      "firs.gov.ng",
      "cbn.gov.ng",
      "nitda.gov.ng",
      "ncc.gov.ng",
      "ndpc.gov.ng",
      "nass.gov.ng",
      "placng.org",
      "lawsofnigeria.placng.org"
    ),
    tier: 1,
    kinds: ["act", "regulation", "official_guidance", "gazette"],
  },
  {
    country: "Nigeria",
    region: null,
    domains: [...TIER_2_DOMAINS],
    tier: 2,
    kinds: ["act", "court_decision", "official_guidance"],
  },
]

/** Domains eligible for retrieval in a jurisdiction (region-specific first, then country-wide). */
export function domainsForJurisdiction(country: string, region: string | null): readonly string[] {
  const out = new Set<string>()
  for (const entry of AUTHORITY_REGISTRY) {
    if (entry.country !== country) continue
    if (entry.region !== null && region !== null && entry.region.toLowerCase() !== region.toLowerCase()) continue
    for (const d of entry.domains) out.add(d)
  }
  return [...out]
}

/** True when the jurisdiction has any registry entry (eligible for retrieval, not verified coverage). */
export function isRegistryJurisdiction(country: string): boolean {
  return AUTHORITY_REGISTRY.some((e) => e.country === country)
}
