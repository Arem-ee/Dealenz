# Dealenz — Product

## Positioning

Dealenz is an **enterprise contract lifecycle management (CLM) platform**. No
sugarcoating, no "deal intelligence, not a CLM" fiction: intake, analysis,
negotiation, approval, signing, obligation tracking, and renewal — the full
lifecycle, one product, enterprise standard.

Tagline: "Know the risk before you sign."

Anyone entering an agreement — a vendor MSA, a lease, a partnership, an
employment offer, a purchase agreement, a funding round — is exposed to terms
they didn't write and risks they can't easily see. Dealenz reads the paper,
judges it against the customer's own playbook plus applicable law, tells you
what to push back on and in what words, routes it through approval and
signing, and guards what was agreed afterwards.

## The Moat: Memory, Not Reading

Generic AI reads **one document**. Dealenz remembers **everything** and
cross-checks. Three memory layers stay on for every analysis:

1. **Playbook** — the customer's standing positions, written once, applied to
   every deal. The user never recites their rules again.
2. **Active contract corpus** — every signed deal the customer owns,
   clause-indexed. A new clause is checked against what was already agreed
   to, not just against itself.
3. **Jurisdiction law** — the outside constraint both layers bow to.

The killer finding type only memory can produce:

> "§8.2 here grants exclusivity — conflicts with §5.1 of your Vendor MSA
> (signed March), which promises the same scope to someone else."

Cross-contract conflict detection is the product. Single-document review is
table stakes.

## Authority Model

The old religion (Dealenz's rules decide, AI explains) is dead. Enterprise
customers bring their own playbooks, and the playbook wins:

1. **Customer playbook first** — positions, fallbacks, red lines, clause
   standards. Customer-written, customer-versioned, wins ties.
2. **Jurisdiction law alongside** — mandatory rules the playbook cannot
   override. Conflicts surface explicitly, never resolve silently.
3. **Dealenz base rulepacks last** — sane defaults and fallback where the
   playbook is silent, always labeled as ours.

Every finding cites its authority: *your playbook §4.2 says X; Delaware law
says Y; our base check adds Z.* Unknown stays unknown: the system would
rather ask or qualify than guess.

## The Twelve Tabs

The product is twelve tabs, built foreground-first, functions second:

1. **Home** — the contract repository. Filter chips (Type / Stage / Risk),
   deals table, empty state. No separate text search box — the top bar owns
   the single product-wide search, spanning titles, document content, and
   clauses with exhaustive snippet results (basis:
   `research/contract-search/`).
2. **Inbox** — intake triage. Gmail threads arrive for sorting and importing.
3. **Drafts** — every generated document with versions.
4. **Signing** — ceremonies in flight, executed archive, locked lifecycle.
5. **Tracker** — obligations, renewals, deadlines, alerts. Becomes the corpus
   keeper: signed deals indexed by clause for cross-contract conflicts.
6. **Clauses** — the playbook home. Positions (standing rules, constant
   context) on top, Library (clause language) in the middle, Tracked
   (per-deal states: Suggested → In draft → Needs input → Signed) at the
   bottom. Positions link to exact library language (preferred slot,
   verbatim reuse) with ordered fallback ladders carrying when/why
   conditions and a walk-away floor; exhausted ladders escalate to the
   Approvals queue; missing clauses offer one-click insertion of the
   linked language. Policy in, language out, positions tracked. Basis:
   `research/clause-playbook-pairing/`.
7. **Templates** — standard contracts, one click to a first draft.
8. **Compare** — side-by-side document diff with material-difference summary.
9. **Approvals** — the decision queue. Nothing consequential runs without a
   human call; every decision logged. Works solo (self-approval); delegation
   arrives with the Team tab.
10. **Reports** — fixed aggregates plus composed metrics from an exposed
    catalog (filters, groupings, saved/rerunnable, CSV), including
    acceptance analytics: which fallback rung closes, which clauses get
    pushed back, where ladders exhaust. Basis:
    `research/custom-analytics/`.
11. **Prompt Lab** — saved, versioned, testable prompts with run history.
12. **Team** — members, groups, roles. The only teams surface — team
    management never hides inside Settings.

Not tabs, by design: search (top bar only), Ask interrogation / analysis /
negotiation (inside-deal tools in the workspace), Settings (personal layer
only: profile, language, model keys, billing), portals (separate doors for
outsiders — employees, suppliers, customers enter through scoped invites,
never the member sidebar).

## Deal Workspace

The foundation everything hangs off. Split panel: **chat control on the
left, AI work surface on the right** (work dominant, ~1:1.4). Single column
on mobile, work cards stacking under the message that produced them.

- **Composer**: attach (+) left, `Ask` field center, mic, round send right,
  Model picker included. Model choice is per-message and enterprise-explicit.
- **Classifier routes live** from the first keystroke and **shows its shot**:
  what it detected (analysis / question / draft / compare) with one-tap
  correction. Magic routing without visible recourse is forbidden.
- **Negotiation runs in rounds**: each round proposes per-clause outcomes
  against the paired ladders (accept in policy, propose fallback rung,
  escalate past walk-away, route novelties to legal), keeps internal and
  counterparty-visible comments strictly separate, and hands the agreed
  version to signing without re-upload. Clause positions anchor to
  recorded spans (located with verification on third-party text); guests
  comment on the external channel by grant, and open external threads
  must resolve before a round is accepted. Basis:
  `research/redline-negotiation/` and `research/negotiation-gaps/`.
- **New deal lands here**: every New / Import / Create entry across all tabs
  opens an empty workspace. No form page, no wizard.
- **Model trust boundary**: the picker is allowed because verdicts stay
  rule-determined — a model can only ever write explanations, never assign
  PASS/FAIL. The active model is logged on every finding in the audit trail.
  BYOK keys stay encrypted server-side, never in the client bundle.

## Folder Batch

Single-file analysis is retail; the enterprise motion is the folder drop.
Bounded workers, never autonomous agents. Market basis: bulk
ingestion → extraction → repository is the enterprise CLM pattern, with
formal intake and threshold-based review routing; the priced estimate gate
is Dealenz's own answer to surprise-billing (no vendor equivalent).
See `research/phase-c-batch-portals/` for evidence and deliberation (D1–D3).

1. Drop a folder → **manifest first**: file count, type mix, estimated credit
   cost. Nothing runs until approved — a 500-file folder must never
   surprise-bill.
2. **Fan-out with caps**: fixed concurrency, per-file credit ceiling, one
   failure never kills the batch. Failed files retry in isolation.
3. **Sort then work**: classify each file (type, language, materiality),
   route to the right rulepack. Files surfacing critical findings pause at
   the Approvals queue; clean files roll up automatically.
4. **Portfolio rollup** into Reports + Home. Every file keeps its own
   evidence trail; the rollup links back to each.

## Teams, Groups, Guests

First-class surface (Team tab), per industry precedent (ChatGPT Enterprise
workspace settings, Ironclad group-approvers, Notion/Linear guest models):

- **Roles**: Owner / Admin / Member / Viewer — small, plain-language, each
  described where assigned. New members land lowest; destructive powers need
  confirmation. Rendered as the permission matrix spec in the Team tab.
- **Groups**: reusable people-sets that carry approvals and access.
  Approvals assign to groups; repository access grants to groups; signing
  rights flow from groups. Groups are the routing fabric.
- **Guests ≠ members**: outsiders get scoped grants on one external surface
  (audience-typed `employee` / `supplier` / `customer`, scoped to their
  contracts only), never member seats. Members vs external participants are
  different concepts, enforced in data model, not just UI. Market basis:
  vendors scope by contract with tiered external roles, never by door
  count — see `research/phase-c-batch-portals/` (D4–D7).
- **Counterparty redlines reconcile staged**: one primary external owner per
  deal may upload back; their files stage outside version control until an
  internal owner accepts them into the version chain. Grants are time-bound
  and auto-revoke on expiry or deal close.
- **Visibility is permission-gated**: the Team tab renders for Owner/Admin
  only. Member/Viewer get no tab; the route redirects them Home.
- **Audit trail**: invites, removals, role changes, ownership transfers —
  recorded and surfaced. The deciding enterprise feature, not an afterthought.

## Credits

Usage-based credits, not feature-gated tiers. Credits pay for computation
and never buy conclusions — model choice affects prose quality only, since
verdicts are rule-determined. Folder batches estimate cost up front and run
only on approval. The ledger (`credit_ledger`) stays append-mostly,
idempotent, auditable. Paddle is the software billing provider; Lemon Squeezy rows are historical data only. Professional-service
payments (where applicable) run through connected accounts, never the
ledger. Credits never become money.

## Trust & Governance

- **AI proposes, humans approve consequential acts.** Analyses, sends,
  signatures, payments — each pauses at a human gate (the Approvals tab).
- **Evidence grounding**: every material finding traces to its source
  (playbook section, corpus clause, statute, or base rule). Exact offsets
  where provable, honest approximation labels elsewhere, never invented.
- **No silent degradation**: if the AI path fails, the UI says so — fallback
  output is labeled fallback, never passed off as full analysis.
- **Consent and privacy**: AI processing consent is explicit and inline;
  user keys are encrypted at rest; RLS on every table; least privilege
  throughout; data retention is cascade-delete on account removal until a
  formal policy replaces it.
- **No anonymous analysis**, no public demo pipeline, no credits-as-money.

## Design Language

- **Orthogonal UI**: zero radius, hairline borders, flat surfaces, no
  shadows. Sharp everywhere, landing through app.
- **Color stack — three voices, one job each**:
  - Pine green: the action color (primary buttons, send, focus) plus
    verified, success, done, healthy. Never danger.
  - Brick red: danger, critical risk, overdue/hot, errors, destructive
    actions. Never success.
  - Ink/neutral: text and neutral emphasis (borders, weight, muted fills).
    Never inverted fills for state, which cannot collapse into unreadable
    black boxes. Landing brand blocks keep their own ink fills.
- **No popups**: search results, account menu, consent, editors, viewers —
  all render inline. Menus that navigate (mobile drawer) are the only
  overlays. Dialogs with backdrops do not exist in this product.
- **Type**: Bodoni Moda display headlines, Mona Sans everywhere else.
  No em dashes in shipped copy.
- **Copy voice**: enterprise-terse. `Ask`, not paragraphs. Benefit-led
  empty states with exactly one primary action.

## Build Method

Foregrounds first, functions second, tab by tab. Each foreground ships
structure, spacing, states, and empty states — never fake data, never
buttons that imply unbuilt functions (disabled-with-reason or absent).
Phase 2 wires functions in tab order; each tab's functions land complete
(destinations resolve, actions execute, audit trail records) before the
next tab starts. Decisions get simpler in workspace order: workspace →
intake → threads → per-tab functions.

## What Dealenz Is Not

- Not a generic AI chatbot, not an AI summarizer with a logo.
- Not a CRM, not a sales pipeline, not lead software in any costume.
- Not a lawyer marketplace; professional review is a managed human layer,
  never the product.
- Not autonomous agents; bounded workers with approval gates or nothing.
- Not anonymous, not public-demo, not "AI survey" software.

## Open Decisions

1. **Playbook format**: structured upload (template-driven) vs freeform
   positions vs both? Starts with freeform positions + version history.
2. **Precedence conflicts**: exact UX for playbook-vs-law contradiction
   (blocking warning vs advisory flag per severity).
3. **Corpus indexing depth**: clause-level extraction at signing time vs
   lazy indexing on first conflict check.
4. **Batch caps**: default concurrency and per-file credit ceiling values.
5. **Jurisdiction coverage order**: which corpus lands first after the base.
6. **Model catalog**: which models ship built-in; BYOK provider scope.
7. **Pricing**: per-outcome prices, bundle sizes, guard-subscription shape.
8. **Data retention policy**: formal policy to replace cascade-delete default.
