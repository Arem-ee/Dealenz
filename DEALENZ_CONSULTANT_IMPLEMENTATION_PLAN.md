# Dealenz Consultant: Implementation Plan

Planning only. No code, no migrations, no schema changes in this task.
Grounded in `DEALENZ_CONSULTANT_AUDIT.md` and verified against code; every
structural claim cites `file:line`. Locked decisions (envelope gains `intent`
+ `priorities`; Consultant at Home entry pre-deal; no separate classifier;
Consultant owns deal-type disambiguation; first message free then cheap
conversation rate on the Ask balance; inline chat confirmations) are taken as
given and not re-opened. Anything that strains against them is flagged in
section 6 rather than decided.

Phase order is deliberate: Phase 0 (question quality) is the load-bearing
phase and must be reviewed and approved before any schema, backend, pricing,
or UI work begins. Each subsequent phase has an explicit review gate.

---

## Phase 0 — Question quality (FIRST, on paper, must be approved before anything else)

This phase fails quietly if rushed: a Consultant that asks plausible but
low-leverage questions, or that never stops asking, is worse than today's
single-shot intake. Everything below is derived from what the pipeline
actually consumes, not invented.

### 0.1 Per-deal-type priority facts (derived from rule conditions)

Method: a fact is high-leverage only if a rule `condition` reads it
(`src/lib/rules/evaluator.ts:32-83`) and its absence flips a result toward
FAIL/UNKNOWN. Jurisdiction never appears in any rule condition (verified
across all seven packs); it matters because it hard-gates all knowledge
resolution (`src/lib/knowledge/applicability.ts:27-31,48-55`). So
jurisdiction is the single highest-leverage cross-type question whenever it
is missing, and deal type itself is required by the gate
(`src/lib/context/requirements.ts:15-23`, baseline `["dealType"]` for all
seven types, confirmation threshold 0.75 at `requirements.ts:42`).

**Freelance** (9 rules, `src/lib/verticals/freelance/rules.ts:19-169`):
fee terms, payment timing, deposit, revision cap, termination clause,
IP/ownership assignment, indemnity presence, liability cap, deliverables/scope
(`facts.freelance.*`, `facts.ts:23-110`). Priority order: fee terms, payment
timing, scope/deliverables, IP ownership, termination, liability cap,
revision limits, deposit. Note the freelance knowledge corpus is effectively
empty (`FREELANCE_KNOWLEDGE_KEYS=[]`, `freelance/knowledge.ts:15`), so
jurisdiction buys less here than in any other type; deprioritize asking it
for freelance.

**Founder** (8 rules, `founder/rules.ts:17-156`): ownership split, vesting
terms, IP assignment, founder roles, governance/decision rights (deadlock
rule fires if *either* is absent, `rules.ts:90-93`), leaver provisions,
transfer restrictions, liability cap. Knowledge is Nigeria CAMA/CAC
(`founder/knowledge.ts:15-21`), so jurisdiction is high-leverage: a
non-Nigeria founder deal gets no corpus coverage, which must be stated
honestly rather than papered over.

**Partnership** (8 rules, `partnership/rules.ts:17-156`): ownership/profit
split, capital contributions, profit distribution, management authority,
governance/deadlock, exit/buyout terms, transfer restrictions, liability cap.
Same Nigeria-corpus caveat as Founder. Partnership structure
(ordinary/LLP/LP) is projected in facts but consumed by no rule condition;
ask it only if the user volunteers confusion about structure, never as a
default question.

**Purchase/Sale** (8 rules, `purchase_sale/rules.ts:17-151`): price,
asset identification, completion date, title transfer, inspection rights,
termination, liability cap, deposit. Corpus covers US/UK/EU/DE/FR/NL
sale-of-goods (`purchase_sale/knowledge.ts:15-22`); jurisdiction question
pays off directly.

**Lease** (9 rules, `lease/rules.ts:18-178`): rent amount, term/dates,
termination plus notice period, deposit, maintenance/repairs allocation, rent
review, subletting terms, liability cap, permitted use. Corpus covers
US-CA/UK/DE/FR/NL tenancy (`lease/knowledge.ts:14-20`).

**Employment** (8 rules, `employment/rules.ts:17-151`): compensation, role,
commencement date, term/duration, duties, probation, termination, liability
cap. Corpus covers US/UK/DE/FR/NL employment
(`employment/knowledge.ts:14-20`). Side matters here (employer vs employee
flips who each risk hurts), so `userRole` outranks most other fields for
this type.

**Generic** (7 rules, `generic/rules.ts:15-138`): termination, governing law
(the only pack whose rules read governing-law text, `rules.ts:39`),
payment terms, liability cap, dispute resolution, scope, one-sided amendment.
No jurisdiction-keyed corpus (`GENERIC_KNOWLEDGE_KEYS=[]`), but jurisdiction
still gates shared/global items upstream, so ask once, cheaply.

**Cross-type ask order** (default, overridden by per-type notes above):
1. deal type (if genuinely ambiguous), 2. jurisdiction (unless freelance),
3. the top three unconsumed priority facts for the resolved type, 4. stop
(see 0.2). Never ask for projected-but-unconsumed facts (lease renewal
terms, purchase warranties, employment benefits, founder valuation,
partnership capital calls) unless the user raises them; no rule reads them,
so asking is pure friction.

### 0.2 Stopping rule (tied to `evaluateContextGate`)

`evaluateContextGate` (`src/lib/context/gate.ts:25-75`) returns
`READY | NEEDS_CONFIRMATION | MISSING_REQUIRED_CONTEXT` with
`missingRequired` and `unconfirmedRequired` lists. The Consultant's stop
logic is defined entirely in these terms plus a question budget:

- `MISSING_REQUIRED_CONTEXT` with deal type unknown: keep eliciting, up to
  the budget. Deal type is the only baseline-required field
  (`requirements.ts:15-23`), so this state normally means "we still don't
  know what kind of deal this is."
- `NEEDS_CONFIRMATION`: ask exactly the confirmation prompt(s) for
  `unconfirmedRequired` (low-confidence inferences below 0.75), then proceed.
  This is the inline-confirmation message type's primary job.
- `READY`: necessary but not sufficient. Additionally require: jurisdiction
  known-or-explicitly-asked (one attempt max, except freelance where it is
  skipped), and the type's top-three priority facts each either known or
  explicitly unknown after one ask each. Then stop.
- **Budget cap: four elicitation turns maximum** (first free message plus up
  to three billed clarifying turns; see Phase 3 for why the number matters
  for cost). On exhaustion, proceed with what is known; everything else
  stays `unknown` per the constitution (`constitution.ts:25-29`,
  unknown is not false) and flows into findings as UNKNOWN, never as
  assumed-safe.
- **Answer-directly exit:** if the input resolves to a one-off explanation
  question with no deal behind it (Transcript 4), answer in place like Ask
  does today and never create an `audits` row. The Consultant's own
  turn-by-turn reasoning makes this call; there is no separate classifier
  per the locked decision, which means the prompt (0.4) must contain an
  explicit "do not create a deal when…" clause, and review must check it
  against Transcript 4.

Deal creation itself reuses `createHomeDeal` semantics
(`home-actions.ts:26-69`): `deal_type` seeded `user_confirmed`, envelope
persisted versioned, `raw_input` preserved verbatim. The Consultant replaces
only the `dealTypeFromText` guesser (`home-actions.ts:8-17`) with its
resolved type; everything downstream of the insert is untouched.

### 0.3 Example transcripts (the behavior spec; review these, not just the schema)

Conventions used below: `C` consultant, `U` user. `[bracketed]` notes are
reviewer annotations, not utterances. Each transcript ends with the
Consultant's stop decision and what it writes.

**Transcript 1 — clean, well-specified input.**
U: "I'm hiring a designer as a contractor for $4,000, net 30, two revision
rounds, IP transfers on final payment. What should I watch for?"
C: [deal type freelance: explicit contractor language. Jurisdiction missing:
one ask.] "Quick check before I dig in: which country or state will this
contract operate under? It decides which rules I check against."
U: "California."
C: [Gate READY (dealType confirmed by explicit statement, jurisdiction
confirmed). Priority facts: fee, timing, revisions, IP all present in the
first message. Stop after 1 question.] Creates freelance deal, runs analysis.
No further questions. Writes: dealType=freelance (user_confirmed),
jurisdiction=United States (user_confirmed).

**Transcript 2 — genuinely vague.**
U: "my business partner sent me something"
C: [Two readings: partnership dispute formation vs reviewing a received
partnership agreement. Highest-leverage disambiguator, one question.]
"Are you (a) starting something new with a partner and need terms drafted,
or (b) reviewing paperwork a partner already sent you?"
U: "b, he sent a draft partnership agreement"
C: [dealType=partnership. Jurisdiction missing: ask.] "Got it. Which country
is the partnership based in? The rules I check differ by place."
U: "Nigeria"
C: [Gate READY. Priority facts: ownership split, contributions, profit
distribution all unknown; budget of 3 billed turns remains. Ask top three
in priority order, one per turn, stopping early if the user pastes the
document (document arrival ends elicitation immediately).]
"Does the draft say how ownership or profits are split?"
U: "60/40"
C: "And what each of you is putting in (cash, work, property)?"
U: "not sure, probably just work from both"
C: [contributions: unknown after one ask; record as unknown, do not re-ask.
Budget check: 3 billed turns used. Stop.] Creates partnership deal with
ownershipSplit inferred 60/40 at stated confidence (confirmation prompt
first if below 0.75), contributions unknown. Writes: dealType=partnership
(user_confirmed), jurisdiction=Nigeria (user_confirmed).

**Transcript 3 — deliberately underspecified, messy.**
U: "idk man he just sent me a thing"
C: [No deal-type signal at all. Ask the single highest-entropy question in
plain language, no jargon.] "No worries. What kind of thing is it: work
you're doing for a client, a job offer, a rental or lease, something you're
buying or selling, or an agreement with a business partner or cofounder?"
U: "job offer i think"
C: [dealType=employment, low confidence. Confirm rather than assume (this is
the NEEDS_CONFIRMATION path).] "So this is an employment offer, you as the
person being hired. Right?"
U: "yeah"
C: [dealType confirmed. Jurisdiction: ask once.] "Which country is the job
in?"
U: "uk"
C: [Gate READY. Priority facts: compensation, role, dates unknown; budget
allows two more turns. Ask compensation first (highest-leverage for
employment), then role. Side is employee (userRole=employee, confirmed by
"you as the person being hired / yeah").] "What pay does it offer, and is
that yearly or monthly?"
U: "£45k yearly"
C: [Budget exhausted after this answer (first free + 3 billed). Stop even
though role/dates remain unknown.] Creates employment deal; role,
commencement, term stay unknown and surface as UNKNOWN findings, never
assumed. Writes: dealType=employment, jurisdiction=United Kingdom,
userRole=employee (all user_confirmed).

**Transcript 4 — one-off clause question, must NOT create a deal.**
U: "Can you explain what an indemnity clause means?"
C: [Explanation request, no counterparty, no transaction, no document.
Answer-directly exit.] Answers in place in the Ask style (brief operation,
1 credit after the free first message), ends with one line: "If you have a
specific contract with this clause in it, paste it and I'll review the
actual wording." No `audits` row, no envelope, no deal type. This transcript
is the regression test for the no-classifier decision: the prompt's
do-not-create clause must produce exactly this behavior.

**Transcript 5 — contradiction triggers the correction path.**
U: "My landlord sent me an amendment raising rent 20%."
C: [dealType=lease, high confidence from landlord/amendment/rent. Inference:
rent increase is the issue, existing tenancy assumed.] "To confirm: you're
the tenant, and this amends an existing lease you already signed. Correct?"
U: "No, I'm the landlord, I'm sending it to my tenant."
C: [Contradiction of the inferred userRole. Correction path: overwrite the
inference, mark userRole=landlord user_confirmed at full confidence, never
merge or average with the prior inference (matches `mergeInferredContext`
semantics, `inference.ts:135-147`, confirmed always wins). Acknowledge
plainly, continue.] "Thanks, corrected: you're the landlord sending the
amendment. Which country is the property in?"
U: "Germany"
C: [Gate READY. Priority facts for lease vs an amendment: rent term present
(20% rise), existing term/notice unknown; one ask within budget, then stop.]
"Does your current lease say how much notice a rent change needs?"
U: "no idea"
C: [Unknown after one ask; stop.] Creates lease deal; notice stays unknown.
Writes: dealType=lease, userRole=landlord (user_confirmed, corrected),
jurisdiction=Germany (user_confirmed).

**Transcript 6 — document arrives mid-elicitation, elicitation ends.**
U: "looking over a freelance contract a client sent"
C: [dealType=freelance (contractor + client language). Jurisdiction: ask.]
"Which country will you be working under for this contract?"
U: [pastes 800 words of contract text instead of answering]
C: [Document arrival ends elicitation immediately regardless of budget
remaining. Run inference over the pasted text (`inferContextFields`,
`inference.ts:88-131`), confirm nothing conversationally, create the deal
with whatever the text yields, jurisdiction inferred at model confidence
(confirmation prompt later only if below 0.75 and required).] Creates
freelance deal from pasted text. Writes: dealType=freelance
(user_confirmed, user said "freelance contract"), all other fields per
inference sources.

**Transcript 7 — founder deal with partial knowledge, budget forces stop.**
U: "me and my cofounder are splitting equity, need a founders agreement"
C: [dealType=founder. Jurisdiction: ask (corpus is Nigeria-only, so this
question doubles as a coverage check).] "Which country is the company in?
I ask because my detailed company-law checks currently cover Nigeria."
U: "Nigeria"
C: [Gate READY. Priority facts: ownership split ("splitting equity" stated,
percentages unknown), vesting, IP assignment unknown. Ask split first.]
"What split are you planning?"
U: "50/50"
C: [Two billed turns used. Ask vesting (next priority), then stop
regardless.] "Any vesting schedule, like earning the shares over 4 years?"
U: "haven't thought about it"
C: [Unknown after one ask; stop.] Creates founder deal. Writes:
dealType=founder, jurisdiction=Nigeria (user_confirmed), ownershipSplit
50/50 (user_confirmed as stated fact; percentages stated by the user are
confirmation, not inference).

Review checkpoint for Phase 0: the seven priority-fact lists (0.1), the
stopping rule including the 4-turn cap (0.2), all seven transcripts (0.3),
and the prompt shape (0.4) are approved as a set. If any transcript's ending
is disputed, the stopping rule or priority list is wrong, not the
transcript; fix the rule, not the example.

### 0.4 Consultant system instructions (shape, not final copy)

- **Role:** pre-deal elicitation for Dealenz. Goal is a complete-enough
  `ContextEnvelope` plus a deal/no-deal decision, not advice, not analysis.
- **Prioritize:** deal type first, jurisdiction second (skip for freelance),
  then the resolved type's top-three priority facts from 0.1 in order. Never
  ask for facts no rule consumes (0.1 exclusions list per type).
- **Phase questions:** one question per turn, plain language, no legal
  jargon; each question states in one clause why it matters when the answer
  changes the checks (Transcripts 2 and 7 model this). Maximum four
  elicitation turns; document arrival or an answer-directly classification
  ends elicitation immediately.
- **Confirm, don't assume:** stated facts are confirmation; model guesses are
  inferences with explicit confidence; anything asked once and unanswered is
  `unknown`, never filled. Contradictions overwrite with the correction
  (Transcript 5).
- **Never (from the spec boundary + constitution):** invent facts, law,
  citations, or dates; alter deal state, create rows, grant or move credits,
  or choose providers (the turn handler owns all side effects, never the
  model); present UNKNOWN as safe or as false; agree with the user against
  the evidence; pad responses. Plain complete sentences, no em dashes,
  concise by default (`constitution.ts:13-53`).
- **Stop conditions (exact):** gate READY plus 0.2 completeness; budget
  exhausted; document pasted; answer-directly classification. On stop, emit
  a machine-readable close-out: decision (create-deal with type and
  field updates, or answer-directly), never prose the handler must parse.

### Phase 0 exit gate

Human approves: priority lists, stopping rule + 4-turn cap, all transcripts
and their endings, prompt shape. No schema/backend/pricing/UI planning is
finalized before this sign-off; later phases may surface refinements, which
return here rather than proceeding on disputed behavior.

---

## Phase 1 — Schema (envelope extension)

1. Add `intent` (closed enum reusing `UserIntent`,
   `operations.ts:34-42`) and `priorities` (bounded string array, max 6,
   mirroring `checkStringArray` conventions at `schema.ts:170-183`, values
   constrained to known fact keys) to `ContextEnvelope`, `expectedKeys`
   (`schema.ts:215-233`), and all constructors (`emptyContextEnvelope`,
   `seedEnvelopeForDealType`).
2. Extend `parseContextEnvelope` validation for both fields; extend the
   inference prompt's output shape only if the model is allowed to propose
   them (default: intent proposed by the turn handler's reasoning, not by
   `inferContextFields`; decide at review).
3. Confirm `mergeInferredContext` (iterates stored keys,
   `inference.ts:140-147`) and `applyUserConfirmation` (key-validated,
   `confirm.ts:20-47`) handle the new fields with identical
   never-overwrite-confirmed semantics; add test coverage mirroring
   `confirm.test.ts` / `gate.test.ts` patterns.
4. Migration: existing rows carry JSONB envelopes without the new keys, and
   `parseContextEnvelope` rejects unexpected field sets, so the migration
   (or a backwards-compatible read path) must backfill `intent`/`priorities`
   as `unknown` on existing rows. Decide: data migration vs tolerant reader.
   Tolerant reader risks masking real drift; migration risks a heavy
   backfill. Recommendation: migration, since the row count is small and the
   strict-reader invariant (`schema.ts:215-233`) is load-bearing for audit
   trust.
5. Decide whether `requiredContextFields` changes: baseline today requires
   only `dealType` (`requirements.ts:15-23`). If `intent` becomes required
   for consultant-created deals, the gate changes meaning for all deals;
   preferred option is to keep the gate untouched and enforce consultant
   completeness in the turn handler (0.2), not in shared requirements.

Exit gate: schema diff, validation rules, migration vs reader decision, and
the untouched-gate decision reviewed. `registerContextRequirements` stays
available if a vertical later needs more.

## Phase 2 — Backend (turn handler)

1. New turn-handling path reusing `request.ts`'s shape
   (`answerQuestion`, `request.ts:156-477`): classify (existing
   `classifyOperation`/`inferIntent` stay for pricing/operation purposes;
   the deal/no-deal decision is the Consultant's reasoning output, not a
   classifier), authorize, load (no auditId until creation, matching the
   document-free branch at `request.ts:222-257$), synthesize question or
   close-out, account. New operation value (e.g. `consultation`) with a
   `brief` budget in `OPERATION_PROFILES` (`operations.ts:115-179`) so
   pricing resolves through the existing table with no new tier.
2. Turn-by-turn deal-creation decision and deal-type disambiguation consume
   the 0.4 close-out; on create, call the existing insert semantics
   (`home-actions.ts:39-48`). `dealTypeFromText` (`home-actions.ts:8-17`) is
   deleted or bypassed for the Consultant path (locked decision); keep it
   only if some non-Consultant path still needs it, otherwise remove to
   avoid two competing type resolvers.
3. Consultant state between turns: conversations exist
   (`store.ts:9-86`) with `attached_audit_id` null until creation, but
   `MessageRow.role` is a strict `"user" | "assistant"` union
   (`store.ts:18-29`) with no message-type column. Inline confirmations need
   machine-readable state: either a new `message_type` column (migration,
   explicit) or `metadata` carriage (no migration; precedent at
   `ask/actions.ts:260-272`). Decide at this phase's review; recommendation
   is the explicit column, because confirmation state drives the stop rule
   and should be queryable, not buried in JSONB.
4. Confirmation application path reuses `confirmContext`
   (`context-actions.ts`) once the `audits` row exists; pre-creation
   confirmations accumulate as `user_confirmed` field updates applied at
   insert time (same `applyUserConfirmation` semantics, batched).

Exit gate: handler stage diagram, close-out contract, `dealTypeFromText`
fate, message-type storage decision, and confirmation-before/after-creation
flow reviewed. Existing Ask and `analyzeDeal` paths untouched by
construction (new operation value, new handler, shared read-only stages).

## Phase 3 — Pricing (free-first-then-billed)

1. Rule: the session's first Home message is free (matches today's "No
   credits until analyze/ask deeply", `home-hero.tsx:189-191`); each
   clarifying turn after that is charged `priceForOperation` for the
   consultation operation at the cheap `brief` rate (1 credit, same
   `STANDARD_CREDIT_POLICY`, same balance as Ask — no new tier, no new
   ledger). Wire through `authorizeOperation` /
   `completeOperation` (`policy.ts:41-117`) exactly as `ask/actions.ts:149-157,176-239`
   does, with per-turn idempotency keys.
2. "First message free" needs a session-scoped free-turn marker distinct
   from the greeting fast-path (`request.ts:170-188`, which is free because
   no AI call happens). A billed Consultant turn always calls the model, so
   the exemption must be explicit (e.g. turn-index-zero check in the
   handler), not inherited from greeting detection. Greetings inside
   consultation stay free via the existing path; the first substantive turn
   is the free one.
3. Interaction with the free `analyzeDeal` quota (5/day,
   `rate-limit.ts:5-10`): consultant turns consume credits, never
   `usage_tracking`; creating then analyzing a deal consumes one analysis
   unit as today. Confirm no double-charge path (credit-billed elicitation
   followed by free analysis is the intended shape, not a bug) and no new
   `RateLimitedAction` is needed (abuse cover for free-turn farming: the
   first message is one turn per session; sessions are authenticated and
   conversation creation is user-scoped, `store.ts:44-55`).
4. Pre-authorization UX: reuse the Ask estimated-cost display
   (`ask/actions.ts:96-103,298-300`, `ask-client.tsx:43-51`) so the user sees
   the 1-credit price before each billed turn.

Exit gate: free-turn rule definition, ledger wiring diagram, quota
interaction statement, and cost-preview reuse reviewed. If farming analysis
shows the free first turn is abusable at scale, that returns to Phase 0
(budget cap), not to a new pricing invention.

## Phase 4 — UI (only what the transcripts require)

1. New inline confirmation message type: renders the inferred value plus
   accept / correct affordances inside the transcript (the NEEDS_CONFIRMATION
   interaction from Transcripts 3 and 5). Captured selections feed the same
   `applyUserConfirmation` semantics as `ContextPanel`; no redirect to
   `ContextPanel`, per the locked decision.
2. Minimal selectable options: audit the approved Phase-0 transcripts and
   build only the option shapes they contain — expected: binary confirm
   (T3/T5), small closed sets (deal-type disambiguation in T3, jurisdiction
   in T1/T2/T5/T7, specialties-style lists are out of scope). If a transcript
   needs a free-text reply alongside options (T2's 60/40, T6's paste), the
   composer stays visible; options are additive, never a replacement input
   mode. Anything beyond transcript needs is explicitly out of scope for v1.
3. No changes to Ask UI, `ContextPanel`, workspace, or nav. Home entry routes
   vague input into the Consultant transcript instead of immediately calling
   `createHomeDeal`; the jurisdiction row and example chips stay as-is.

Exit gate: component list traced 1:1 to transcript moments, with anything
unreferenced cut. Over-built chat UI (typing indicators beyond existing
`AiWorking`, rich cards, carousels) is out unless a transcript demands it.

## Phase 5 — Integration (Home entry, non-regression)

1. Home entry: `handleSubmit` (`home-hero.tsx:45-65`) sends non-question,
   non-file input to the Consultant session instead of direct
   `createHomeDeal`; `looksLikeQuestion` keeps its current job (Ask vs
   elicitation routing) with the Consultant owning everything after. File
   chip still routes to `/audit/new`; "Just asking" still routes to `/ask`.
2. Non-regression: direct `/audit/new` flow (`createAudit`,
   `audit/new/actions.ts:10-63`, explicit `DealTypeSelector`) bypasses the
   Consultant entirely; Ask flows unchanged (no shared handler code paths,
   only shared read stages); existing `audits` rows without the new envelope
   keys are covered by the Phase 1 migration decision.
3. Observability: consultant turns log through `system_logs` phases
   (new phase names, same `logEvent`/`reportError` plumbing,
   `logger.ts:44-117`); close-out decisions logged with turn count and
   stopping reason so the 4-turn cap and answer-directly rate are measurable
   post-launch.

Exit gate: routing table (input kind to destination), non-regression
checklist (new-deal flow, Ask flow, legacy rows), and logging plan reviewed.
End-to-end verification happens against the Phase-0 transcripts as
acceptance cases.

---

## 6. Open questions (need a decision before building starts)

1. **Migration vs tolerant reader** for backfilling `intent`/`priorities`
   onto existing envelopes (Phase 1.4). Recommendation is migration;
   confirm.
2. **Message-type storage**: new column vs `metadata` carriage for inline
   confirmations (Phase 2.3). Recommendation is an explicit column; confirm.
3. **Does `intent` become gate-required?** Recommendation is no (keep
   `requirements.ts` untouched, enforce completeness in the handler);
   confirm, because the alternative changes `evaluateContextGate` meaning
   for every existing deal.
4. **Should the model propose `intent`/`priorities` via `inferContextFields`,
   or does only the turn handler set them?** Recommendation is handler-only
   (inference stays observable-facts-only per its existing contract,
   `inference.ts:20-42`); confirm.
5. **Is `dealTypeFromText` deleted** once the Consultant owns disambiguation,
   or kept for a fallback path? Recommendation is delete to avoid competing
   resolvers; confirm no hidden caller depends on it.
6. **Spec conformance**: the locked decisions assume the original spec's
   security boundary (no invented facts, no state/credit/provider side
   effects from model output) maps onto the constitution plus the
   `request.ts` port structure. If the attached spec text demands anything
   beyond 0.4's never-list (e.g. provider choice or credit grants driven by
   consultation), that reopens a locked decision — flag, don't build.
