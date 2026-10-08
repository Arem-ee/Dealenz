// Round evaluation — pure four-outcome engine (D2).
//
// Per tracked clause, exactly one outcome: accept (current language matches
// the linked preferred), fallback (propose the next unoffered rung),
// escalate (ladder spent and a walk-away floor exists), route (novel or
// human-judgment needed). Deterministic throughout: text match is
// normalized comparison, rung order is explicit, stance only narrows
// auto-proposal (light proposes preferred-level only, everything else
// routes). The model drafts counter-language later, and only for fallback
// outcomes — verdicts never come from AI.

import type { LibraryClauseVariant } from "@/lib/library/entries"

export type NegotiationStance = "light" | "balanced" | "firm"

export function isNegotiationStance(raw: unknown): raw is NegotiationStance {
  return raw === "light" || raw === "balanced" || raw === "firm"
}

export type RoundOutcome = "accept" | "fallback" | "escalate" | "route"

export interface LadderRung {
  rung: number
  variant: Exclude<LibraryClauseVariant, "preferred">
  body: string
}

export interface ClauseRoundInput {
  clauseId: string
  /** Current deal language; null when the clause is missing. */
  currentText: string | null
  preferredBody: string
  preferredVersion: number
  fallbacks: LadderRung[]
  walkawayBody: string | null
  /** Rungs already offered in earlier rounds — never re-offered. */
  alreadyOfferedRungs: number[]
  /** Silence instruction: propose preferred insertion when missing. */
  insertOnMissing: boolean
  stance: NegotiationStance
}

export interface ClauseRoundOutcome {
  clauseId: string
  outcome: RoundOutcome
  variant: LibraryClauseVariant | null
  rung: number | null
  offeredBody: string | null
  reasoning: string
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim()
}

/**
 * Evaluates one clause for a round. Rung selection is deterministic:
 * the lowest unoffered fallback rung wins; stance gates auto-proposal,
 * never the verdict.
 */
export function evaluateClauseRound(input: ClauseRoundInput): ClauseRoundOutcome {
  const base = { clauseId: input.clauseId } as const
  const current = input.currentText === null ? null : normalize(input.currentText)

  // Missing clause with a silence instruction: propose the preferred
  // insertion rather than guessing.
  if (current === null || current.length === 0) {
    if (input.insertOnMissing) {
      return {
        ...base,
        outcome: "fallback",
        variant: "preferred",
        rung: 0,
        offeredBody: input.preferredBody,
        reasoning: `Missing — propose preferred insertion (v${input.preferredVersion}).`,
      }
    }
    return {
      ...base,
      outcome: "route",
      variant: null,
      rung: null,
      offeredBody: null,
      reasoning: "Missing with no insertion instruction — needs a human call.",
    }
  }

  // Preferred match: accept silently, log the version.
  if (current === normalize(input.preferredBody)) {
    return {
      ...base,
      outcome: "accept",
      variant: "preferred",
      rung: 0,
      offeredBody: null,
      reasoning: `Matches preferred v${input.preferredVersion} — no counter needed.`,
    }
  }

  const ordered = [...input.fallbacks].sort((a, b) => a.rung - b.rung)
  // Already at a fallback rung: hold it, don't re-negotiate.
  const matched = ordered.find((r) => normalize(r.body) === current)
  if (matched) {
    return {
      ...base,
      outcome: "accept",
      variant: matched.variant,
      rung: matched.rung,
      offeredBody: null,
      reasoning: `Already at fallback rung ${matched.rung} — holds.`,
    }
  }

  const next = ordered.find((r) => !input.alreadyOfferedRungs.includes(r.rung))
  if (next) {
    // Light stance proposes preferred-level only; anything needing a
    // concession routes to a human instead of auto-offering.
    if (input.stance === "light") {
      return {
        ...base,
        outcome: "route",
        variant: null,
        rung: null,
        offeredBody: null,
        reasoning: `Differs from preferred; light stance holds concessions for humans (rung ${next.rung} available).`,
      }
    }
    return {
      ...base,
      outcome: "fallback",
      variant: next.variant,
      rung: next.rung,
      offeredBody: next.body,
      reasoning: `Propose fallback rung ${next.rung} — first unoffered rung.`,
    }
  }

  // Ladder spent (or never built): walk-away floor escalates, anything
  // else routes to legal with the diff.
  if (input.walkawayBody !== null) {
    return {
      ...base,
      outcome: "escalate",
      variant: "walkaway",
      rung: null,
      offeredBody: null,
      reasoning: "Ladder spent with a walk-away floor — escalate with rationale, never concede silently.",
    }
  }
  return {
    ...base,
    outcome: "route",
    variant: null,
    rung: null,
    offeredBody: null,
    reasoning: "No ladder covers this language — route to legal with the diff.",
  }
}
