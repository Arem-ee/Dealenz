# Clause↔Playbook Pairing Deliberation

Status: PROPOSED. Nothing below changes `product.md` / `architecture.md`
until approved. Approval amends the docs first, then code follows.

## D1. Link positions to exact library language (Vaquill model)

- Options: (a) position links to a library line+variant, reused verbatim;
  (b) keep duplicating language inside position text.
- Evidence: linked clauses stay current everywhere on one update; Ironclad's
  disconnected library/playbooks is the named gap to close, not copy.
- Recommendation: **(a)**. Table `position_clause_links`
  (position → library key + variant). Preferred slot required; note field
  carries deviation rationale the clause text itself doesn't hold.

## D2. Fallback ladder with when/why per rung (Jurist model)

- Options: (a) ordered fallback rungs each with a when/why condition;
  (b) flat variant list.
- Evidence: Jurist requires 1–2 fallbacks minimum with when/why; Vaquill
  ladders report which rung counterparty terms land on; SpotDraft fallbacks
  carry explicit limits.
- Recommendation: **(a)**. Each link row after the preferred carries
  `condition_text` ("offer when …"). Ladder order is explicit, best first.
  Walk-away stays the floor, never a rung.

## D3. Escalation trigger on the link (SpotDraft model)

- Options: (a) per-link escalate flag routing to the Approvals queue with
  the position + rung context; (b) prose-only escalation notes.
- Evidence: escalation triggers + approval workflows are core playbook
  anatomy; triggers must exceed base approval to ever fire (Vaquill).
- Recommendation: **(a)**, scoped: when a finding matches a linked position
  and the ladder is exhausted (or the link says so), the finding carries an
  escalation action creating an approval request with full context. No new
  queue semantics — the existing decision queue decides.

## D4. Silence instruction (Jurist model)

- Options: (a) per-link missing-clause instruction (suggest insertion of a
  named variant, positioned); (b) generic suggestions as today.
- Evidence: Jurist treats silence instructions as highly recommended for
  high-priority rules; Dealenz tracking already derives "suggested" from
  FAIL findings.
- Recommendation: **(a)** light: a link may name its insert variant; the
  Tracked row for a missing clause then offers one-click "insert preferred
  language" into a draft. No auto-insertion — human gate stays (product.md:
  AI proposes, humans approve).

## D5. Structure check (Vaquill model)

- Options: (a) validate linked lines (walk-away without ladder warns;
  fallback without when/why warns); (b) no validation.
- Evidence: Vaquill flags walk-away-without-ladder as a warning; Dealenz
  already nudges missing walk-away — same family.
- Recommendation: **(a)**. Shown inline on the line: missing ladder rung,
  condition-less fallback. Warnings, never blocks.

## D6. Negotiation stance selector

- Recommendation: **defer**. Stances govern redline aggression; the redline
  editor is itself a deferred Phase-D item. No editor, no stance.

## D7. Acceptance-measured re-ranking (SpotDraft/Jurist model)

- Recommendation: **defer to custom analytics**. The usage counters shipped;
  re-ranking needs the analytics surface first. Recorded here so the schema
  keeps the acceptance signal (`use_count` per variant already exists).

## Doc amendments on approval

1. `product.md` Clauses tab: positions link to library language; ladders
   with when/why; escalation to Approvals; silence handling.
2. `architecture.md` AI & Authority Pipeline: findings cite position →
   library variant → rung; linked language is the only auto-suggested
   insertion source.
