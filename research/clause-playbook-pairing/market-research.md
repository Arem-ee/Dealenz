# Clause↔Playbook Pairing Market Research

Date: 2026-10-08. Method: vendor documentation (full text fetched).
Nothing here is built yet; see `deliberation.md` for decisions.

## 1. What the market does

### Ironclad AI Playbooks (plays tied to clauses)
- A playbook is a set of **plays, each tied to a clause**, attached to a
  workflow template. Each play carries preferred + fallback positions,
  trigger rules, and position matching (exact preferred text searched
  first, AI clause-type detection second).
- Reviewers swap detected language for preferred/fallback **with one click**;
  non-standard terms auto-flag and route to the right stakeholder
  (Legal/Finance/Security/Sales).
- Key admission (Clause Library Overview, 2026-06): **"The two tools both
  work with clauses, but they serve different purposes and are not currently
  connected."** The library governs setup; playbooks guide review — and the
  link between them does not exist. This is the gap Dealenz can close rather
  than copy.

### SpotDraft (playbook anatomy)
- A playbook = preferred clauses + fallback clauses + approval workflow +
  escalation triggers + red-flag checklist + objection responses.
- Two binding rules: **a playbook only works if connected to templates and
  workflows** (never a separate document), and **a clause library without
  documented fallback positions only solves half the problem**.
- Fallbacks carry explicit limits (e.g. "accept down to 2 years without
  escalation"); escalation triggers name what must go to legal/finance.
- Negotiation outcomes feed back: which fallbacks get accepted drives
  re-ranking (promote the accepted fallback to first position).

### Ironclad Jurist recipe (rule structure)
- Every rule is **self-contained**: Rule Name, Preferred Language (verbatim),
  Other Acceptable Examples, **Fallbacks with when/why (minimum 1–2)**,
  Silence Instruction (what to insert when the clause is missing, and where).
- Rules must be action-oriented ("tell Jurist how to redline", not
  "accept/reject"), pasted verbatim (no cross-references to outside docs).
- **Negotiation stance** selector: Light (minimal edits) / Balanced /
  Firm (verbatim preferred/fallback insertion).
- **Test the playbook** against sample contracts before trusting it; promote
  fallbacks by measured acceptance (the 85%-accepted Fallback 2 becomes
  Fallback 1).

### Vaquill (linked-clause model — sharpest pairing found)
- **Link the exact library clause into the rule** instead of describing the
  wording: drafting reproduces linked text verbatim; the preferred-position
  field becomes optional notes (deviation rules, rationale). **Update the
  clause once and every linked playbook stays current.**
- **Fallback ladder**: ordered retreats, best first (12mo fees → 24mo →
  total value). Review reports which rung counterparty terms land on.
- **Walk-away floor** plus a **structure check that flags walk-away without
  a ladder as a warning**.
- Escalation triggers must exceed the clause's base approval or they can
  never fire (checked as an error).

## 2. Synthesis: the pairing contract

Across all four sources, a paired position carries:

1. **Link** to exact library language (preferred slot; verbatim reuse).
2. **Ordered fallback ladder** with **when/why conditions** per rung.
3. **Walk-away floor**; missing ladder above it is a structural warning.
4. **Escalation trigger** naming who decides when the ladder runs out.
5. **Silence instruction**: what to do when the clause is absent.
6. **Measured acceptance** feeding re-ranking (which rung actually closes).

## 3. Dealenz's current position

- Positions (`standing_instructions`): freeform rules, scoped by deal type,
  applied to every answer/analysis and quoted when used. No link to language.
- Library lines: three-tier variants with immutable history, walk-away
  nudge, usage counters. No link to positions.
- Findings cite rules; tracking suggests clauses — but the position →
  language → fallback → escalation chain is unverified prose, exactly the
  "separate document" failure SpotDraft warns about.
