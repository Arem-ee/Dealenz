# Redline + Negotiation Deliberation

Status: PROPOSED. Nothing below changes `product.md` / `architecture.md`
until approved. Approval amends the docs first, then code follows.

## D1. Rounds as first-class rows

- Options: (a) `negotiation_rounds` (round_no, proposer principal,
  base_version → proposal_version, status proposed/accepted/countered/
  withdrawn) + per-clause dispositions; (b) implicit rounds via version
  history alone.
- Evidence: multi-round context retention is what separates negotiation
  from one-shot review (Bind); structured memory of proposals is the
  stated prerequisite for any agent assistance (Inferensys).
- Recommendation: **(a)**. Versions stay the immutable lineage; rounds
  are the workflow over them. Proposer is `owner` or a guest grant —
  never anonymous, per the no-anonymous-analysis doctrine.

## D2. Four-outcome evaluation per change (Bind model, Dealenz material)

- Options: (a) accept-in-policy / propose-fallback-rung / escalate past
  walk-away / route novel to legal, evaluated deterministically where
  rules cover and drafted by the negotiation engine only for fallback
  rungs; (b) AI-judged outcomes.
- Evidence: the four-outcome table with per-clause reasoning attached;
  only hard-limit and novel outcomes need humans. Dealenz verdicts stay
  rule-determined — the model writes counter-language, never verdicts.
- Recommendation: **(a)**. Walk-away crossings reuse the D3 escalation
  path; novelties route to the Approvals queue with a diff summary.

## D3. Browser-native clause editor, no Word

- Options: (a) propose/accept per tracked clause in the workspace, new
  versions per accepted round; (b) Word integration.
- Evidence: no Word in the stack; staged uploads already cover
  third-party paper (Conga reconcile shape); Juro model kills
  reconciliation as a work category.
- Recommendation: **(a)**. External paper keeps arriving staged; native
  rounds happen in the workspace and portal.

## D4. Dual comments with principal-enforced visibility

- Options: (a) internal vs counterparty-visible threads, guests
  structurally excluded from internal; (b) single thread.
- Evidence: Volody dual-channel; Dealenz D10 limits guests to
  reader/uploader — internal strategy must be unreadable to them.
- Recommendation: **(a)**, enforced at read time with tests (guest
  principal sees only its channel), not just hidden in UI.

## D5. Concession log feeds future analytics

- Options: (a) round rows record per-clause outcomes (accepted rung,
  escalated, routed) for later re-ranking analysis; (b) derive later.
- Evidence: Icertis clause-level history → pushback/acceptance analysis
  is the direct feed for pairing D7.
- Recommendation: **(a)**. Capture now, analyze in the analytics phase.

## D6. Agreed → signing without re-upload

- Options: (a) round acceptance marks the version agreed and opens the
  existing signing ceremony on it; (b) manual handoff.
- Evidence: handoffs are where delay and version confusion enter (Bind,
  Conga); the ceremony already consumes versions.
- Recommendation: **(a)**.

## D7. Negotiation stance (un-defers pairing D6)

- Options: (a) round-level Light/Balanced/Firm governing which rungs
  auto-propose vs flag; (b) leave deferred.
- Evidence: stance selectors are standard (Ironclad Jurist); the blocked
  precondition (an editor) now exists.
- Recommendation: **(a)**, conservative mapping: Light proposes preferred
  only and flags the rest; Balanced auto-proposes through fallback rungs;
  Firm inserts preferred/fallback verbatim and catches more deviations.
  Walk-away and novelties always route to humans, every stance.

## D8. Pilot scope

- Options: (a) one deal type first with exit criteria; (b) all types.
- Evidence: phased rollout with exit criteria per stage (Inferensys);
  playbook configuration is the larger investment (Bind).
- Recommendation: **(a)** — freelance first (smallest clause set),
  exit when five negotiated rounds close without override confusion,
  then expand. Team picks the type if it disagrees.

## Doc amendments on approval

1. `product.md` Deal Workspace / negotiation: rounds, four outcomes,
   dual comments, agreed → signing.
2. `architecture.md` AI & Authority Pipeline: negotiation evaluation
   order (rules → ladder rung → escalation/route); model writes
   counter-language for fallback rungs only.
