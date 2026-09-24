// Counterparty research types (P1: registry brief).
//
// Separate from counterparty/memory.ts, which covers what happened in the
// user's own past deals with a linked client. This module covers who an
// outside party is according to public registries. Every outward claim
// carries its source; anything unsourced is an explicit unknown, never a
// clean bill of health.

export type CounterpartyCountry = "Nigeria" | "United Kingdom" | "United States";

export const COUNTERPARTY_COUNTRIES: readonly CounterpartyCountry[] = [
  "Nigeria",
  "United Kingdom",
  "United States",
];

/** Provenance tier of a brief claim. "user" = supplied by the requester, never verified. */
export type BriefSourceTier = 1 | 2 | "user";

export interface BriefClaim {
  /** Sourced phrasing, e.g. "CAC records show status: active (retrieved 2026-09-24)". Never a bare verdict. */
  statement: string;
  /** Verbatim passage the statement rests on (may be empty for user-supplied facts). */
  quote: string;
  sourceUrl: string | null;
  tier: BriefSourceTier;
  retrievedAt: string;
}

export interface ResolutionCandidate {
  /** Stable id for the confirm step: the URL, or "custom:<name>" when user-supplied only. */
  id: string;
  /** Human label shown in the confirm card. */
  label: string;
  /** Registry page to research on confirm, or null when no page exists (details-only path). */
  url: string | null;
  /** Registry source behind url (e.g. "Companies House"), or null for custom candidates. */
  source: string | null;
  /** True when built purely from requester-supplied details with no registry page behind it. */
  detailsOnly: boolean;
}

export interface ConfirmedSubject {
  name: string;
  country: CounterpartyCountry;
  region: string | null;
  /** Confirmed registry page, or null for the details-only path. */
  url: string | null;
  domain: string | null;
  regNumber: string | null;
}

export interface CounterpartyBrief {
  subject: ConfirmedSubject;
  claims: BriefClaim[];
  /** What was not established — always present, never empty reassurance. */
  unknowns: string[];
  /** True only when at least one Tier-1 claim was retrieved live. */
  liveVerified: boolean;
  retrievedAt: string;
}

export interface BriefRow {
  id: string;
  auditId: string | null;
  subjectName: string;
  brief: CounterpartyBrief;
  creditsCharged: number;
  createdAt: string;
}
