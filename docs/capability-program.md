# Capability Program: what Dealenz has, what it needs

Audited against the post-E2 tree. Legend: HAVE (shipped) / PARTIAL (foundation
exists, gaps named) / MISSING (new work).

## Already shipped (no work)

- Document generation, comparison, negotiation + execution, obligation
  generation/management, version tracking, contract analysis, Ask interrogation,
  batch analysis, search — all live and tested.
- Clause library (curated templates), clause-grounded findings with evidence.

## Partial (finish, don't rebuild)

- **Contract repository** — Library search + drafts shelf + tracker exist; missing
  a unified register (one table: every agreement with type/status/counterparty/
  dates, filterable). Build the register view over existing tables.
- **Templates & one-click creation** — generation pipeline exists, but the template
  gallery was removed for honesty. Rebuild as real one-click starters from the
  business-owner document families (each card creates a prefilled deal).
- **Workflow & approvals** — credit-gate approvals exist; missing value-based legal
  approval chains (needs multi-user deals from E2 rooms first).
- **Audit controls** — hash-chained export ships; missing retention policy + admin UI.
- **Notifications** — Gmail deadline digest + activity timeline exist; missing
  in-app notification center and Slack/Teams.
- **Clause tracking** — per-deal findings exist; missing cross-deal clause register
  (which counterparties carry uncapped liability, etc.).
- **Counterparty screening** — briefs + research exist; needs productization as a
  named "Screens" flow.

## Missing (new builds, phased)

- **C1 Permission groups** — org roles exist; add per-deal visibility groups
  (deal-team vs company-wide vs private) on top of the org model.
- **C2 Charts, reports & custom analytics** — portfolio reporting builder
  (renewals by quarter, risk concentration, cycle time) over existing tables.
  No ML, just honest aggregates with drill-down.
- **C3 Portals** — scoped counterparty/client views beyond sign links
  (document + status + messages, token-gated like invitees).
- **C4 GenAI Prompt Lab** — a playground to test standing rules and prompts
  against sample deals before they go live (uses existing Ask pipeline + eval).
- **C5 Multi-language support** — UI + analysis output in FR/DE/NL/ES beyond
  jurisdiction-aware English. i18n routing first, model output language second.
- **C6 Model choice + BYOK** — provider abstraction already server-side; add
  per-user model picker (curated list) and encrypted BYOK key vault with
  per-request routing + cost attribution. Highest security scrutiny of the set.

## Sequence

- **Batch C1 (near-term, low risk):** register view, one-click template starters,
  audit retention + admin UI, counterparty Screens flow, notification center.
- **Batch C2 (structural):** permission groups, analytics builder, portals,
  prompt lab.
- **Batch C3 (strategic):** multi-language, model choice + BYOK (after security
  review of key custody).
