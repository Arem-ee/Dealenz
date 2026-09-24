// Counterparty registry directory (P1).
//
// DATA, not engine: jurisdiction → public company-registry sources eligible
// for retrieval. Every domain here must already sit in the legal-research
// allowlist (the single auditable source of truth) — entries referencing
// anything else fail closed at lookup time, never at fetch time.

import { ALLOWED_DOMAINS } from "@/lib/legal-research/allowlist";
import type { CounterpartyCountry } from "./types";

export interface RegistrySource {
  /** Display name, e.g. "Corporate Affairs Commission". */
  name: string;
  /** Search URL template with {q} for the party name. */
  searchUrl: (query: string) => string;
  /** Direct profile URL builder, or null when the registry offers no stable URL pattern. */
  profileUrl: ((regNumber: string) => string) | null;
}

export interface RegistryEntry {
  country: CounterpartyCountry;
  region: string | null;
  sources: readonly RegistrySource[];
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function assertAllowlisted(entry: RegistryEntry): void {
  for (const source of entry.sources) {
    // Probe both templates with a dummy value so unbuildable patterns fail here.
    for (const probe of [source.searchUrl("probe"), source.profileUrl?.("000000") ?? null]) {
      if (probe === null) continue;
      const host = hostOf(probe);
      if (!host) throw new Error(`Registry source has an unbuildable URL: ${source.name}`);
      const ok = [...ALLOWED_DOMAINS].some((d) => host === d || host.endsWith(`.${d}`));
      if (!ok) throw new Error(`Registry source outside the allowlist: ${source.name} (${host})`);
    }
  }
}

const NIGERIA: RegistryEntry = {
  country: "Nigeria",
  region: null,
  sources: [
    {
      name: "Corporate Affairs Commission",
      // CAC public search endpoint (site search over registered entities).
      searchUrl: (q) => `https://cac.gov.ng/?s=${encodeURIComponent(q)}`,
      profileUrl: null,
    },
  ],
};

const UNITED_KINGDOM: RegistryEntry = {
  country: "United Kingdom",
  region: null,
  sources: [
    {
      name: "Companies House",
      searchUrl: (q) =>
        `https://find-and-update.company-information.service.gov.uk/search?q=${encodeURIComponent(q)}`,
      // 8-digit company numbers map to stable public profiles.
      profileUrl: (regNumber) =>
        `https://find-and-update.company-information.service.gov.uk/company/${encodeURIComponent(regNumber)}`,
    },
  ],
};

const UNITED_STATES: RegistryEntry = {
  country: "United States",
  region: null,
  sources: [
    {
      name: "SEC EDGAR",
      // EDGAR full-text search over filings (public companies).
      searchUrl: (q) => `https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent(`"${q}"`)}`,
      profileUrl: null,
    },
  ],
};

export const COUNTERPARTY_REGISTRY: readonly RegistryEntry[] = [NIGERIA, UNITED_KINGDOM, UNITED_STATES];

// Fail fast at import: a registry pointing outside the allowlist is a
// configuration bug, and bugs here become SSRF-adjacent fetches.
for (const entry of COUNTERPARTY_REGISTRY) assertAllowlisted(entry);

export function registryFor(country: CounterpartyCountry): RegistryEntry | null {
  return COUNTERPARTY_REGISTRY.find((e) => e.country === country) ?? null;
}
