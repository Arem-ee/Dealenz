// Counterparty brief assembly (P1 registry brief + P2 enforcement leads).
//
// Deterministic string extraction over allowlisted registry pages — no AI
// synthesis, so no claim can exceed its quote. Every outward statement names
// its source and retrieval date; everything else is an explicit unknown.
// Officer extraction and general-press adverse media remain out of scope and
// appear as unknowns, never as silence.

import type { BriefClaim, ConfirmedSubject, CounterpartyBrief } from "./types";

export interface BriefFetcher {
  fetch(url: string): Promise<{ url: string; status: number; text: string }>;
}

/** Minimal adverse-query surface (mirrors the legal-research adapter shape). */
export interface BriefSearcher {
  search(query: string, jurisdiction: string): Promise<string[]>;
}

const STATUS_NEGATIVE = ["dissolved", "struck off", "struck-off", "inactive", "delinquent", "revoked", "liquidation", "wound up"];
const STATUS_POSITIVE = ["in good standing", "good standing", "active"];

function quoteAround(text: string, index: number, termLength: number): string {
  const start = Math.max(0, index - 150);
  const end = Math.min(text.length, index + termLength + 150);
  return text.slice(start, end).replace(/\s+/g, " ").trim().slice(0, 400);
}

function findTerm(text: string, term: string): number {
  return text.toLowerCase().indexOf(term.toLowerCase());
}

export interface AssembleBriefInput {
  subject: ConfirmedSubject;
  sourceName: string | null;
  fetcher: BriefFetcher | null;
  /** Optional official-source adverse mentions (fraud / lawsuit / enforcement). */
  searcher?: BriefSearcher | null;
  now?: Date;
}

export async function assembleBrief(
  subject: ConfirmedSubject,
  sourceName: string | null,
  fetcher: BriefFetcher | null,
  now?: Date
): Promise<CounterpartyBrief>;
export async function assembleBrief(input: AssembleBriefInput): Promise<CounterpartyBrief>;
export async function assembleBrief(
  subjectOrInput: ConfirmedSubject | AssembleBriefInput,
  sourceName?: string | null,
  fetcher?: BriefFetcher | null,
  now?: Date
): Promise<CounterpartyBrief> {
  const input: AssembleBriefInput =
    "subject" in subjectOrInput
      ? subjectOrInput
      : { subject: subjectOrInput, sourceName: sourceName ?? null, fetcher: fetcher ?? null, now };
  return assembleBriefInner(input);
}

async function assembleBriefInner(input: AssembleBriefInput): Promise<CounterpartyBrief> {
  const { subject, sourceName, fetcher } = input;
  const now = input.now ?? new Date();
  const retrievedAt = now.toISOString();
  const day = retrievedAt.slice(0, 10);
  const claims: BriefClaim[] = [];
  const unknowns: string[] = [];

  // Tier "user": the requester's own assertions, labeled as such.
  const suppliedBits = [
    subject.domain ? `website ${subject.domain}` : null,
    subject.regNumber ? `registration ${subject.regNumber}` : null,
  ].filter(Boolean);
  claims.push({
    statement: `Requester states the counterparty is "${subject.name}" (${subject.country})${suppliedBits.length > 0 ? ` — ${suppliedBits.join(", ")}` : ""}. Unverified.`,
    quote: "",
    sourceUrl: null,
    tier: "user",
    retrievedAt,
  });

  let liveAttempted = false;
  if (fetcher && subject.url) {
    try {
      const page = await fetcher.fetch(subject.url);
      liveAttempted = true;
      if (page.status >= 200 && page.status < 300 && page.text.trim().length > 0) {
        const text = page.text;
        const source = sourceName ?? "registry";
        // Status signals: negatives first (absence of a negative plus a
        // positive is itself informative), each claim quoted, cap three.
        const terms = [...STATUS_NEGATIVE, ...STATUS_POSITIVE];
        let emitted = 0;
        for (const term of terms) {
          if (emitted >= 3) break;
          const idx = findTerm(text, term);
          if (idx < 0) continue;
          claims.push({
            statement: `${source} records status: "${term}" (retrieved ${day}).`,
            quote: quoteAround(text, idx, term.length),
            sourceUrl: page.url,
            tier: 1,
            retrievedAt,
          });
          emitted += 1;
        }
        const incorp = /incorporated on (\d{1,2} \w+ \d{4})/i.exec(text);
        if (incorp) {
          claims.push({
            statement: `${source} records incorporation on ${incorp[1]} (retrieved ${day}).`,
            quote: quoteAround(text, incorp.index, incorp[0].length),
            sourceUrl: page.url,
            tier: 1,
            retrievedAt,
          });
        }
        const companyNo = /company number[:\s]+([A-Z0-9]{6,10})/i.exec(text) ?? /RC\s?(\d{5,})/.exec(text);
        if (companyNo) {
          claims.push({
            statement: `${source} records registration number ${companyNo[1]} (retrieved ${day}).`,
            quote: quoteAround(text, companyNo.index, companyNo[0].length),
            sourceUrl: page.url,
            tier: 1,
            retrievedAt,
          });
        }
        if (subject.domain && text.toLowerCase().includes(subject.domain.toLowerCase())) {
          const idx = findTerm(text, subject.domain);
          claims.push({
            statement: `${source} references ${subject.domain}, corroborating the supplied website (retrieved ${day}).`,
            quote: quoteAround(text, idx, subject.domain.length),
            sourceUrl: page.url,
            tier: 1,
            retrievedAt,
          });
        }
        if (liveAttempted && !claims.some((c) => c.tier === 1)) {
          unknowns.push(`The registry page was retrieved but contained no recognizable status or registration statements.`);
        }
      } else {
        unknowns.push(`The registry page (${subject.url}) could not be retrieved (status ${page.status}).`);
      }
    } catch {
      unknowns.push(`The registry page (${subject.url}) could not be retrieved (network failure).`);
    }
  }

  if (!fetcher || !subject.url) {
    unknowns.push(
      "Live registry lookup was not performed — this brief rests on requester-supplied details. Enable live lookup to verify identity against the registry."
    );
  }
  // P2 scope discipline: name what was never attempted so silence is never
  // mistaken for a clean bill of health.
  unknowns.push("Officer and filing-currency extraction is not performed in this version.");
  if (input.searcher) {
    // Official-enforcement leads: adverse queries stay inside the allowlist
    // (registry/enforcement sources only — general press is out of scope),
    // capped at two fetches. Each lead is a quoted mention to review, never
    // a verdict.
    try {
      const leads = (await input.searcher.search(`"${subject.name}" fraud OR lawsuit OR enforcement`, subject.country)) ?? [];
      let fetchedLeads = 0;
      for (const leadUrl of leads.slice(0, 4)) {
        if (fetchedLeads >= 2 || typeof leadUrl !== "string" || leadUrl === subject.url) continue;
        try {
          if (!fetcher) break;
          const lead = await fetcher.fetch(leadUrl);
          if (lead.status < 200 || lead.status >= 300 || lead.text.trim().length === 0) continue;
          const idx = findTerm(lead.text, subject.name);
          if (idx < 0) continue;
          claims.push({
            statement: `An official source mentions "${subject.name}" in an enforcement-adjacent context (retrieved ${day}) — review before signing; a mention is not a finding.`,
            quote: quoteAround(lead.text, idx, subject.name.length),
            sourceUrl: lead.url,
            tier: 1,
            retrievedAt,
          });
          fetchedLeads += 1;
        } catch {
          // One dead lead never blocks the rest.
        }
      }
      if (fetchedLeads === 0) {
        unknowns.push("No enforcement-adjacent mentions found in the searched official sources.");
      }
    } catch {
      unknowns.push("Adverse-mention search could not run (search provider failure).");
    }
  } else {
    unknowns.push("Litigation, sanctions, and adverse-media search is not performed in this version.");
  }

  return {
    subject,
    claims,
    unknowns,
    liveVerified: claims.some((c) => c.tier === 1),
    retrievedAt,
  };
}
