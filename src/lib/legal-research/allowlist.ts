// Source allowlist + URL safety (Phase 27).
//
// Only Tier 1 (primary official) and Tier 2 (authoritative databases)
// hosts are allowed. Tier 3 commentary domains are never treated as
// primary law. Webpage content is DATA, never instructions.

export const TIER_1_DOMAINS = [
  // Nigeria Tier 1
  "cac.gov.ng",
  "sec.gov.ng",
  "firs.gov.ng",
  "cbn.gov.ng",
  "nitda.gov.ng",
  "ncc.gov.ng",
  "ndpc.gov.ng",
  "nass.gov.ng",
  "placng.org",
  "lawsofnigeria.placng.org",
  // United States Tier 1 — Delaware, California, New York, federal
  "delcode.delaware.gov",
  "delaware.gov",
  "leginfo.legislature.ca.gov",
  "nysenate.gov",
  "law.cornell.edu", // US Code / CFR primary via Cornell LII
  "sec.gov", // SEC EDGAR company filings (counterparty registry research)
  // United Kingdom Tier 1
  "legislation.gov.uk",
  "gov.uk",
  // European Union Tier 1
  "eur-lex.europa.eu",
  "europa.eu",
  // Germany Tier 1 — Federal Ministry of Justice official law portal
  "gesetze-im-internet.de",
  // France Tier 1 — official public legal dissemination service
  "legifrance.gouv.fr",
  // Netherlands Tier 1 — official government gazette/legislation portal
  "wetten.overheid.nl",
  "overheid.nl",
] as const

export const TIER_2_DOMAINS = [
  // Authoritative legal databases that mirror legislation/cases.
  "nigerialii.org",
] as const

export const ALLOWED_DOMAINS: ReadonlySet<string> = new Set([...TIER_1_DOMAINS, ...TIER_2_DOMAINS])

export const MAX_QUERY_LENGTH = 500
export const MAX_RESULT_CONTENT_CHARS = 20000
export const MAX_CITATION_PASSAGE_CHARS = 1200
export const MAX_SOURCES_PER_RESEARCH = 8
export const RESEARCH_TIMEOUT_MS = 8000
export const RESEARCH_MAX_REDIRECTS = 2

export function isAllowedUrl(raw: string): boolean {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return false
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return false
  if (url.username || url.password) return false
  // SSRF guard: never allow private / localhost / link-local.
  const host = url.hostname.toLowerCase()
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") return false
  if (host.startsWith("10.") || host.startsWith("192.168.") || host.startsWith("172.")) {
    // 172.16.0.0/12 crude guard — treat any 172. as private for safety.
    return false
  }
  if (host === "0.0.0.0") return false
  // Check allowlist: exact or subdomain.
  for (const domain of ALLOWED_DOMAINS) {
    if (host === domain || host.endsWith(`.${domain}`)) return true
  }
  return false
}

export function authorityTierForUrl(raw: string): 1 | 2 | 3 | null {
  let host: string
  try {
    host = new URL(raw).hostname.toLowerCase()
  } catch {
    return null
  }
  for (const d of TIER_1_DOMAINS) if (host === d || host.endsWith(`.${d}`)) return 1
  for (const d of TIER_2_DOMAINS) if (host === d || host.endsWith(`.${d}`)) return 2
  return 3
}

export function sanitizeContent(raw: string, maxChars = MAX_RESULT_CONTENT_CHARS): string {
  const clipped = raw.slice(0, maxChars)
  // Strip obvious control chars but keep line breaks.
  return clipped.replace(/\u0000/g, "").trim()
}
