# Dealenz Consultant Feature: Current-State Audit

Date: 2026-09-13. Read-only investigation against code. Every claim cites `file:line`.

Note: no spec doc was attached to the request, so this audits against the task
description's summary of the spec: a conversational context-discovery front door
that infers user intent, asks minimum necessary questions, writes a structured
result into `ContextEnvelope`, then hands off to the existing pipeline
(`resolveKnowledge` to `evaluateApplicableRules` to findings to protection to
documents to lawyer to signing).

---

## 1. What already exists and can be extended

### 1a. `ContextEnvelope` is real, validated, and already models inferred-vs-confirmed

- Shape: `src/lib/context/schema.ts:24-46` — 13 fields (`dealType`,
  `jurisdiction`, `governingLaw`, `userRole`, `counterpartyRole`, `industry`,
  `transactionStructure`, `transactionValue`, `transactionCurrency`,
  `transactionStage`, `crossBorder`, `regulatedIndustry`, `entityTypes`) plus
  `missingRequiredContext`, `version`, `updatedAt`, `updatedBy`. Closed field
  set enforced at `schema.ts:215-233`; unknown/inferred/confirmed invariant
  enforced at `schema.ts:161-167`.
- Every field carries `{ value, source, confidence }` where source is
  `unknown | inferred | user_confirmed` (`schema.ts:13-22`). This is exactly
  the Known/Inferred/Unknown distinction the spec needs, already persisted as
  versioned JSONB on `audits` (migration `00021`, envelope seeded at
  `src/app/dashboard/home-actions.ts:36-40`).
- AI inference into the envelope already exists: `inferContextFields`
  (`src/lib/context/inference.ts:88-131`) proposes observable facts only via a
  constrained prompt (`inference.ts:20-42`), and `mergeInferredContext`
  (`inference.ts:135-147`) never overwrites `user_confirmed` fields.
- User confirmation path exists: `applyUserConfirmation`
  (`src/lib/context/confirm.ts:20-47`, full-envelope revalidation) exposed via
  `confirmContext` / `inferAndPersistContext` server actions
  (`src/app/audit/[id]/context-actions.ts:8-26`), with ownership re-checked
  per call (`context-actions.ts:45-62`).
- Gate already answers "do we know enough": `evaluateContextGate`
  (`src/lib/context/gate.ts:25-75`) returns `READY | NEEDS_CONFIRMATION |
  MISSING_REQUIRED_CONTEXT` with per-field `missingRequired` /
  `unconfirmedRequired` lists; low-confidence inference (<
  `CONFIRMATION_THRESHOLD = 0.75`, `requirements.ts:42`) must be confirmed.
- UI for review/confirm/correct exists: `ContextPanel`
  (`src/components/audit/context-panel.tsx:91-322`) shows gate badge
  (`context-panel.tsx:176-188`), per-field source states, and per-field
  confirm/correct controls (`handleConfirm`, `startEditing/submitEditing`,
  `context-panel.tsx:118-159`). Home already writes jurisdiction pre-analysis
  via this path (`home-actions.ts:34-38` plus the jurisdiction row in
  `home-hero.tsx`).

### 1b. Intent/objective vocabulary exists (outside the envelope)

- `UserIntent` (explore/understand/evaluate/negotiate/draft/compare/review/
  decide, `src/lib/ai/operations.ts:34-42`) and `UserObjective`
  (maximize_payment/protect_ownership/…,
  `src/lib/ai/operations.ts:46-53`) already exist, with per-operation
  execution policy (output budget, context selection, document requirement at
  `operations.ts:97-113`, profiles at `operations.ts:115-179`). The pipeline
  preserves objective separately from facts (`request.ts` brief). A
  Consultant can reuse this vocabulary rather than inventing one.

### 1c. The conversation pipeline already does context-rules-synthesis-accounting

- `src/lib/conversation/request.ts` is a full backend pipeline (question to
  operation to context to knowledge to rules to synthesis to usage to
  accounting) with a deterministic greeting fast-path (no AI call, no ledger,
  per credits brief), document-free/document-required/mixed flows, bounded
  history, and per-answer credit display. It already loads the envelope
  (`ask/actions.ts:183-189`), evaluates rules, attaches evidence, and runs
  the same `resolveKnowledge` candidates the analysis path uses. A Consultant
  turn is structurally close to an existing Ask turn.

### 1d. The downstream handoff target already exists

- Findings (`RuleResult` PASS/FAIL/UNKNOWN), deterministic floor overriding AI
  scores (`src/lib/rules/result.ts:119-159`, enforced in
  `src/app/audit/[id]/actions.ts:620-659`), protection intents, document
  assembly, lawyer handoff, and signing are all built. Whatever the
  Consultant produces, if it lands in a validated `ContextEnvelope`, the rest
  of the pipeline consumes it with no changes.

### 1e. Security boundaries the Consultant inherits for free

- Deterministic rules are authoritative over AI output (1d above); AI synthesis
  is constrained by prompt (`request.ts:302`) and the constitution
  (`src/lib/ai/constitution.ts`, enforced via `validateOutputContract`).
- `request.ts` ports (`request.ts:46-57`) allow no deal writes, credit grants,
  or provider selection; provider/model come from server config, credit
  authorization precedes any AI call (`request.ts:199-214`), failures void
  reservations (`request.ts:467-476`).
- Ownership pattern is uniform: server-side `getUser()` plus
  `.eq(user_id, user.id)` on every query, RLS as second layer
  (`ask/actions.ts:105-122`, `store.ts:44-86`). A Consultant built as server
  actions/API routes following this pattern sits behind the same boundaries;
  no new enforcement points are needed for read/synthesize/confirm flows.

---

## 2. What is genuinely missing

### 2a. No intent/situation/objectives in the envelope

- The envelope models *deal facts* (roles, money, place, structure, stage),
  not *consulting state*. There is no field for user intent, objective,
  situation summary, elicited terms, document presence, or priorities
  (`schema.ts:24-46`, closed set at `schema.ts:215-233` — adding any such
  field is a schema change plus migration touch). `UserIntent`/`UserObjective`
  live only in the conversation layer (`operations.ts`) and are not persisted
  into the envelope. Where the Consultant's output plugs into the envelope is
  undecided in code: deal facts map cleanly, everything else does not.

### 2b. No clarifying-question step anywhere in intake

- Home submit is single-shot: `looksLikeQuestion` heuristic
  (`home-hero.tsx:11-18`) branches to `askQuestionAction` or `createHomeDeal`
  (`home-hero.tsx:50-59`) with zero prompt-back. Deal type is keyword matching
  (`dealTypeFromText`, `home-actions.ts:8-17`, else `generic`) — frequently
  wrong input (e.g. "I need an agreement for two founders" matches nothing
  and becomes `generic`). There is no "did you mean…" or follow-up question
  before the `audits` row is created.
- Ask never reroutes to deal creation: `needs_document` just returns a
  paste/upload message (`request.ts:190-197`); no `/audit` row is created from
  conversation. The user must self-route via nav.

### 2c. Ask-vs-deal routing is a regex, not a classifier

- The only router is the `looksLikeQuestion` string heuristic
  (`home-hero.tsx:11-18`) plus `classifyOperation` keyword matching in
  (`src/lib/conversation/classify.ts:22-35`), which explicitly ignores
  document presence (`classify.ts:33`). There is no model-based router. A
  Consultant that must reliably separate "explain this clause" from "review
  my purchase agreement" needs one; nothing to extend exists.

### 2d. No MCQ/inline-option UI pattern in any conversational surface

- Ask input is free-text `Textarea` plus Send (`ask-client.tsx:357-373`);
  transcript renders prose, findings, sources, citations
  (`ask-client.tsx:269-335`); the only in-flow button is Inspect-source.
  Home entry is textarea plus chips that fill text, never structured replies.
- Selectable-option UI exists but never in conversation: `deal-type-selector`
  (7-card grid, only in `audit/new`), `guided-form` (static inputs, only in
  workspace intake), `input-type-selector` (workspace only). Rendering options
  inline in chat, capturing the selection, and feeding it to confirmation is
  new UI plus new message-type plumbing (today's `addMessage` stores
  `content` text, `store.ts:88-117`).
- Related gap: no yes/no inference-confirmation affordance. `ContextPanel`
  does per-field edit-and-confirm, not binary accept/reject of an inference;
  `NEEDS_CONFIRMATION` (gate) and `NEEDS_JURISDICTION` (legal-research
  veracity state, `types.ts:31`, produced at `research.ts:118`,
  `request.ts:371-384`) are backend states surfaced as text/status, not as
  interactive confirmation prompts. `NEEDS_JURISDICTION` is a one-off for
  jurisdiction, not a general ask-the-user pattern; only the gate's
  `unconfirmedRequired` list generalizes, and nothing conversational consumes
  it.

### 2e. Credit model prices single turns, not consultations

- Ask is billed per operation turn at flat 1/3/8 by output budget
  (`pricing.ts:19-38`); greetings cost 0; authenticated `analyzeDeal` is free
  under a 5/day `usage_tracking` quota (`rate-limit.ts:5-27`,
  `actions.ts:362-367`), never touching `credit_ledger`. A multi-turn
  Consultant that asks 3-5 clarifying questions implies 3-5 billed turns
  (likely 1 credit each as `conversation` operations) before any analysis,
  versus today's zero pre-analysis cost on Home. Whether each question bills,
  whether consultation is one priced operation, and how the free-analysis
  quota interacts are unanswered in code. Flagged only; no fix designed here.

---

## 3. Design decisions needing a human before implementation planning

1. **Envelope plug point.** Which Consultant outputs map to existing envelope
   fields (jurisdiction, roles, structure, value…) and which need new
   persisted state (intent, objective, priorities, elicited terms)? The closed
   field set (`schema.ts:215-233`) forces this choice early: extend the
   envelope (schema + validation + UI) or keep consulting state in
   `conversations`/messages and write only deal facts to the envelope.
2. **Surface: new vs extend.** Is the Consultant a new conversational surface,
   an extension of Home entry (pre-deal elicitation before `createHomeDeal`),
   or an Ask mode (post-hoc elicitation inside conversation)? Code supports
   all three mechanically; the product choice determines whether the
   `audits` row is created before, during, or after consultation.
3. **Router semantics.** Who decides Ask-vs-deal, and when: replace
   `looksLikeQuestion` with a model classifier at Home entry, add
   conversation-to-deal escalation inside Ask, or keep user self-routing and
   scope the Consultant to one side only?
4. **Credit treatment of multi-turn elicitation.** Bill per clarifying turn
   under the existing 1/3/8 operation prices, define a consultation operation
   with its own price, or keep pre-deal elicitation free like Home is today
   (with abuse considerations, since free + multi-turn invites prompt
   farming)? This interacts with the free `analyzeDeal` quota and needs an
   explicit policy, not an emergent one.
5. **Confirmation interaction shape.** Extend `ContextPanel`'s edit-and-confirm
   into chat (prose + structured confirm), or build binary/MCQ confirmation
   turns as new message types? The former reuses tested UI; the latter is
   needed if the Consultant must ask minimum-necessary questions inline.
6. **Deal-type disambiguation ownership.** Does the Consultant confirm deal
   type conversationally (replacing `dealTypeFromText` keywords), or does
   keyword inference plus `DealTypeSelector` stay and the Consultant only
   fills non-type fields? This decides whether the Consultant sits before or
   after the highest-leverage inference in the funnel.
