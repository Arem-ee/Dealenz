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

function isPrivateHostStrict(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "")
  if (h === "localhost" || h === "0.0.0.0" || h === "::" || h === "::1") return true
  if (h === "169.254.169.254" || h === "100.100.100.200" || h === "metadata.google.internal") return true
  if (h === "127.0.0.1") return true
  if (h.startsWith("10.") || h.startsWith("192.168.")) return true
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true
  if (h.startsWith("172.")) return true // crude: treat any 172. as private
  if (h.startsWith("169.254.")) return true
  if (h.startsWith("fd") || h.startsWith("fc")) return true
  if (h.startsWith("fe80:")) return true
  if (h.startsWith("::ffff:")) return true
  if (/^0x/i.test(h)) return true // hex-encoded IP
  if (/^[0-9]+$/.test(h.replace(/\./g, "")) && /\./.test(h)) return true // decimal/octal dotted quad
  return false
}

export function isAllowedUrl(raw: string): boolean {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return false
  }
  if (url.protocol !== "https:") return false
  if (url.username || url.password) return false
  // SSRF guard (strict, shared with retrieval): never allow private /
  // localhost / link-local / metadata, including encoded IP forms.
  const host = url.hostname.toLowerCase()
  if (isPrivateHostStrict(host)) return false
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
