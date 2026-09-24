// Counterparty resolution: name → confirmable candidates (no AI, no credits
// for the scan itself; the server action prices the step at the 1-credit
// micro floor). Researching the wrong "ABC Ltd" burns credits and risks
// misattribution, so resolution always precedes research and the human
// confirm gate sits between them.

import { registryFor } from "./registry";
import type { CounterpartyCountry, ResolutionCandidate } from "./types";

export interface ResolveInput {
  name: string;
  country: CounterpartyCountry;
  region?: string | null;
  domain?: string | null;
  regNumber?: string | null;
}

/** Minimal search surface (mirrors the legal-research adapter shape). */
export interface ResolveSearch {
  search(query: string, jurisdiction: string): Promise<string[]>;
}

function clean(value: string | null | undefined): string | null {
  const v = (value ?? "").trim();
  return v.length > 0 ? v : null;
}

export function candidateLabel(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.length > 1 ? u.pathname.slice(0, 48) : "";
    return `${u.hostname}${path}`;
  } catch {
    return url.slice(0, 72);
  }
}

export async function resolveCandidates(
  input: ResolveInput,
  searcher?: ResolveSearch | null
): Promise<ResolutionCandidate[]> {
  const name = clean(input.name);
  if (!name || name.length < 2) throw new Error("Name the counterparty to research.");
  const entry = registryFor(input.country);
  if (!entry) throw new Error(`Research is not yet supported in ${input.country}.`);
  const domain = clean(input.domain);
  const regNumber = clean(input.regNumber);
  const candidates: ResolutionCandidate[] = [];

  // Fast path: a registration number that maps to a stable profile URL skips
  // search ambiguity entirely (UK Companies House 8-character numbers).
  if (regNumber) {
    for (const source of entry.sources) {
      if (!source.profileUrl) continue;
      try {
        const url = source.profileUrl(regNumber.replace(/\s+/g, ""));
        candidates.push({
          id: url,
          label: `${name} — ${source.name} ${regNumber}`,
          url,
          source: source.name,
          detailsOnly: false,
        });
        break;
      } catch {
        // Unbuildable pattern: fall through to search/details paths.
      }
    }
  }

  if (searcher?.search) {
    try {
      const urls = await searcher.search(`${name} ${input.country} company`, input.country);
      for (const url of (urls ?? []).slice(0, 3)) {
        if (typeof url !== "string" || candidates.some((c) => c.id === url)) continue;
        candidates.push({
          id: url,
          label: candidateLabel(url),
          url,
          source: null,
          detailsOnly: false,
        });
      }
    } catch {
      // Search is best-effort: the details-only candidate below still stands.
    }
  }

  // Always present: proceed on requester-supplied details alone. Research on
  // this path yields user-tier facts plus explicit unknowns — never charges
  // the research rate (the server action refuses empty briefs uncharged).
  const qualifier = [domain, regNumber].filter(Boolean).join(" · ");
  candidates.push({
    id: `custom:${name.toLowerCase()}`,
    label: qualifier ? `${name} (${input.country}) — ${qualifier}` : `${name} (${input.country}) — my details only`,
    url: null,
    source: null,
    detailsOnly: true,
  });
  return candidates;
}
