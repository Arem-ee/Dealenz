# Dealenz — Architecture

Grounded in the 2026-09-18 codebase. Facts here are cited to real files; anything not yet verified in code is marked UNVERIFIED or FUTURE rather than assumed.

This document describes the **target full-product architecture** for Dealenz, distinguishing between what currently exists, what is staged/planned, and what is open/unknown. It is the technical companion to `product.md` — product decides what, this decides how it is built and how far it is built.

---

## Stack

- **Framework:** Next.js 16 (App Router), React 19, TypeScript (strict mode)
- **Styling:** Tailwind CSS v4, custom brand tokens (dark burgundy/oxblood primary via OKLCH, separate risk-severity palette)
- **UI primitives:** Radix UI + lucide-react + class-variance-authority
- **Database & Auth:** Supabase (Postgres + Supabase Auth, via `@supabase/ssr`)
- **Document generation:** `@react-pdf/renderer` for PDF export, `pdf-parse` / `mammoth` for reading uploaded PDFs/DOCX
- **AI:** provider-agnostic layer with three adapters — Gemini, OpenAI-compatible (covers NVIDIA NIM), Anthropic Claude (see "AI provider layer" below)
- **Testing:** Vitest wired via `npm test` (146 test files, 1105 tests); CI runs typecheck, lint, tests, and build (`.github/workflows/ci.yml`)

Single Next.js monolith — no separate backend service, no other languages.

---

## Structure

- `src/app/` — routes, using Server Components for data fetching and Server Actions (`"use server"`) for mutations
- `src/components/ui/` — Radix-based primitives
- `src/components/chat/` — chat control layer (`Composer`, `ChatThread`, `MessageList`, `ThreadPanel`) and the work-surface cards rendered inside or beside it
- `src/components/split-pane/` — `SplitPane` + `useIsDesktop` (resizable desktop split; single-column on mobile)
- `src/components/library/` — Library view (`LibraryView`) for deals, documents, templates, and history; `/vault` is a redirect to `/library`
- `src/components/home/` — Home workspace (threads/work list)
- `src/components/audit/` — the deal workspace (largest, most complex surface — one 700+ line client component holding most of the intake/analyze/generate state)
- `src/components/landing/` — marketing pages
- `src/components/auth/` — authentication-related components (SlideshowPanel, etc.)
- `src/lib/ai/` — extraction, risk analysis, prompt templates, provider client
- `src/lib/risk/engine.ts` — rule-based fallback risk scorer (8 categories), used when the AI call fails
- `src/lib/supabase/` — browser and server Supabase clients
- `src/lib/generate.ts` — document generation orchestration (proposal → SOW → contract → checklist, sequential AI calls with per-document template fallback)
- `src/lib/context/` — Context Resolution foundation (Phase 5B): validated envelope (schema.ts), required-policy plus gate (requirements.ts, gate.ts), authenticated-surface inference (inference.ts), user confirmation (confirm.ts); persisted as versioned JSONB on audits via migration 00021; enforced in analyzeDeal; confirmed via ContextPanel UI
- `src/lib/knowledge/` — Knowledge Foundation (Phase 5C): validated item schema with kind/authority/jurisdiction/provenance/version/status (schema.ts), temporal helper isEffectiveAt (temporal.ts), deterministic applicability vs ContextEnvelope (applicability.ts), deterministic resolver returning candidates (resolver.ts), admin-gated ingestion plus lifecycle transitions (store.ts); persisted in versioned knowledge_items table via migration 00022; resolution exposed additively at the analyzeDeal boundary
- `src/lib/verticals/` — canonical deal-type modules (facts/rules/knowledge per vertical) behind the single dispatcher in `src/lib/verticals/index.ts` (supersedes the old `src/lib/deal-types/` plan)
- `src/lib/protection/` — protection engine (Phases 26-28): `index.ts` freelance-only generation boundary (`canGenerateDocuments`/`hasProtectionDraftSupport`), `intents.ts` `ProtectionIntent` derived from authoritative findings (never rediscovering; `protectionIntentsFromFindings`), `clauses.ts` curated founder (8) + partnership (8) + purchase_sale (3) + lease (4) + employment (3) clause templates with variables, warnings, and `legalContextIds` (drafting assistance vs legal authority; `renderClauseTemplate` preserves `{{var}}` as UNKNOWN; UI filters ids by jurisdiction prefix), `src/components/audit/protection-intents.tsx` priority-grouped UI (What to negotiate / Why it matters / Recommended protection / Evidence / Legal context / Suggested clause)
- `src/lib/legal-research/` — grounded international legal intelligence (Phases 27/30/31): `types.ts` jurisdiction/authority/`VeracityState` (VERIFIED/SUPPORTED/CONFLICTING/STALE/UNVERIFIED/NOT_FOUND/NEEDS_JURISDICTION), `allowlist.ts` Tier 1/2 domains + SSRF/size/timeout guards, `registry.ts` jurisdiction → authority-domain DATA registry (new jurisdictions = entries, never engine changes), `retrieval.ts` live bounded adapter (`createLiveRetrievalAdapter`: HTTPS-only, per-hop allowlist + SSRF re-validation, manual redirects, content-type allowlist text/html+text/plain, streaming byte cap, AbortController timeout, `htmlToText` string-only sanitization, no cookies/credentials/headers; optional Brave search behind `LEGAL_SEARCH_API_KEY`; `getResearchAdapter()` env-gated by `LEGAL_RESEARCH_LIVE=1`, default corpus-only), `validation.ts` provenance + temporal checks, `corpus.ts` Nigeria/US/UK/EU seeds, `research.ts` controlled query-planner → allowlist → retrieval → validation → relevance → citation pipeline (webpage content is DATA; UNKNOWN jurisdiction → NEEDS_JURISDICTION, never guessed; opt-in `revalidate` re-fetches top-2 corpus URLs to confirm currency, passage-gone → STALE; `meta` observability without private contents), `citations.ts` passage-∈-content helpers; Ask grounded via `src/lib/conversation/request.ts` (`shouldInvokeResearch` + live-or-corpus research, `legalCitations`/`researchState` in response, same operation cost — no separate research charge) and `src/components/ask/ask-client.tsx` Legal sources UI
- `src/lib/verticals/tier.ts` — business-owner priority tiers (1=founder/partnership, 2=purchase_sale/lease/employment, 3=freelance, 4=generic)
- `src/lib/conversation/` — central classifier and request pipeline (`classify.ts`: `isGreeting`, `classifyOperation`, `inferIntent`; `request.ts`: operation → context → knowledge → rules → synthesis → usage → credit boundary; `store.ts`: conversation/message persistence)
- `src/lib/chat/` — chat actions and thread types (`actions.ts`: `createDealThread`, `analyzeAndPostRisk`, `generateDocumentAndPost`, `listThreads`; `types.ts`: `ThreadMessage`)
- `src/lib/documents/` — international document families and assembly (`families.ts`, `assembly.ts`, `variable-autofill.ts`)
- `src/lib/review/` — review state machine (`transitions.ts`), attention, signers, consultation handoff (`src/lib/consultation/handoff.ts`)
- `supabase/migrations/` — 55 forward migrations (`00001`–`00055`) plus 3 remediation drafts (`20260903*`), one Postgres schema, RLS enabled on every table

---

## Known Naming Risk

Route/session guarding lives in `src/proxy.ts`, not the Next.js-conventional `middleware.ts`. Next.js 16 detects and runs `src/proxy.ts` as middleware by filename convention — the build output shows `ƒ Proxy (Middleware)` and live testing confirms it runs: `GET /dashboard` unauthenticated returns a 307 redirect to `/login`, and `GET /login` unauthenticated returns 200. The proxy middleware runs in dev mode; verify it also runs in your production deployment before relying on it for security.

---

## Data Model (Supabase / Postgres)

### Core Tables (Currently Existing)

- `audits` — the deal itself (raw input, structured extraction, risk report, overall score, lock state, `deal_type`, `context_envelope`, `structured_data` with `deterministicFindings`)
- `client_profiles` — per-user client list
- `checklist_items` — deliverables checklist items
- `business_profiles` — user's business info for document generation
- `document_versions` — proposal/SOW/contract/checklist and business-owner drafts, versioned, `generation_method` recorded (`ai` / `template` / `assembled`)
- `share_tokens` + `document_signatures` + `document_signers` — sharing, execution, and multi-party signing (see Signatures)
- `usage_tracking` — daily rate-limit counters (`increment_usage` RPC)
- `system_logs` — phase/status/duration for key operations
- `activity_events` — audit trail of user actions
- `conversations` + `conversation_messages` — persistent threads and messages (chat-first, work-first)
- `credit_ledger` + `credit_purchases` + `referral_codes`/`referral_attributions` — credit economy and referrals

### Tables Added by Migration 00020 (Lawyers & Consultations) and Later

- `lawyers` — lawyer profiles with `verification_status` (pending/verified/rejected), bar license, specialties, years experience
- `consultation_requests` — consultation requests with `status` enum (requested, matched, in_progress, completed, cancelled, waitlist) and `handoff_snapshot` JSONB (`00036`, capped 100kb)
- `service_orders` — lawyer professional-service orders (payment boundary for lawyer-connected Stripe/Paystack, client pays directly, Dealenz takes cut, no ledger linkage — to be completed)
- `knowledge_items` — versioned legal/practice corpus with provenance, applicability, effective dates

All tables have Row Level Security enabled, scoped to `auth.uid()`. Two RPCs (`get_shared_document`, `sign_shared_document`) are `SECURITY DEFINER` with `EXECUTE` granted to `anon` — intentional, since the public client-facing share/sign flow needs to work without an authenticated session. This is a sound pattern as long as those two RPCs stay tightly scoped.

---

## Auth Flow

Supabase Auth (email/password + Google OAuth), email verification required before a user can run an analysis or generate documents (checked both in the route layer and inside the relevant Server Actions — defense in depth). Every Server Action independently re-fetches the user and validates their UUID rather than trusting a shared context — safe, but means there's no caching layer, so auth checks happen redundantly across components.

Identity model: one human maps to one canonical `auth.users.id`, with email/password and Google as identities on that row — never two Dealenz accounts for one person. Google is attached only through the explicit authenticated `linkIdentity` flow in settings (verified provider email required, pre/post user id must match); the application never merges accounts by comparing email strings, rewrites `user_id`, or deletes duplicates. Referral attribution, audits, credits, and conversations all key to the canonical `auth.users.id`, so linking preserves them unchanged.

Dealenz is authenticated-only. No anonymous analysis path exists. The `anonymous_rate_limits` table (`00040`) remains as infrastructure for other unauthenticated paths (share-view `20/hr`, auth log, client-error intake) — not as an analysis system.

---

## Request Flow (High Level)

```
User → Dealenz Web (landing/auth/chat/library/audit workspace)
     → Server Actions (authenticated: create audit, save
       input, upload files, run analysis, generate documents,
       chat threads, Ask)
     → Domain/AI layer (text extraction, AI extraction, deterministic
       risk engine, document generation, classifier)
     → Supabase (auth, Postgres, RLS, storage, usage tracking, logs)
```

The Domain/AI layer is the important seam: AI extraction produces structured deal data, and a separate deterministic rule engine scores risk against that data. The AI does not assign risk scores directly — see `product.md` for why this separation is a deliberate product decision, not just an implementation detail. Keep this seam intact when refactoring the AI provider layer below; swapping providers should never mean letting a provider's model output become the risk score directly.

Chat is the control layer. Work is the dominant output. A user objective travels through a single classifier → typed operation → existing pipeline, not through competing routers.

---

## Frontend Architecture

### Desktop — Resizable Split-Screen

`src/components/split-pane` exposes `SplitPane` + `useIsDesktop`. `src/components/chat/ChatThread.tsx` composes it:

**Chat / control layer | Work / output surface**

The work surface is wider and visually dominant. It renders findings, reports, documents, proposals, case files, execution progress, approvals, and other bounded work products. The chat column hosts the message list and `Composer`. Resizing is bounded; the work side is never allowed to collapse below its minimum.

No CRM-style dashboard. Navigation is Home + Library (`src/app/library/page.tsx`); `/vault` redirects to `/library` (`src/app/vault/page.tsx:6`). Account items (Settings, Billing, Help, Log out) live in the lower account menu, not in primary nav.

### Mobile — Single Column

`useIsDesktop()` selects layout. On narrow viewports there is no split pane. Structured work surfaces appear as cards and sections inside the conversation stream, stacked in reading order. The same work components render — only the layout changes. A compact `WorkspaceHeader` keeps deal context visible above the conversation.

### Workspace Header and Objective Workspaces

The work surface leads with a `WorkspaceHeader` (`src/components/chat/WorkspaceHeader.tsx`): deal title, objective-derived workspace mode, deal-type/jurisdiction chips, and state-aware links that render only when backing state exists (document versions, monitoring events). The mode comes from the pure `describeWorkspace` (`src/lib/work/workspace.ts`) over plan kind/status, execution status, the classified user objective (`classifyOperation`, client-safe), the latest structured message, signing participation, and verified counts — approval and running execution dominate, then batch/protection plan kinds, then the objective (proposal/negotiation/drafting), then signing engagement, then the latest card (confirm/review/draft/lawyer), with monitoring/documents/idle as fallbacks.

Modes with a dedicated surface render through `WorkspaceView` (`src/components/work/workspaces/`), composed of shared primitives over one verified bundle (findings with evidence, open items, versions, signers, signing events, checklist, monitoring events/alerts, negotiation points, deliverables, missing inputs): review (findings + open items + Ask/protect), proposal/SOW (version history + scope + missing inputs + freelance-gated generation), negotiation (key issues + persisted negotiation points + evidence), protection (interactive checklist + generated output), signing (versions, signer states, immutable event trail, state-machine-derived next action; acting stays on the document page), monitoring (event/alert CRUD through `src/lib/monitoring/actions.ts` with truthful Gmail state), batch (CSV preview + `createBatchWorkPlan` + per-row send via `/api/gmail/send`). Approval/execution keep the plan block; confirm/lawyer/idle keep the latest-card panel. Risk findings render attached evidence via `EvidenceLine` with per-finding Ask actions that prefill the `Composer`, keeping the loop Current work → Conversation → Updated work.

### Sidebar

- **Home** — threads and work (persistent deals, active work, recent activity, open items)
- **Library** — deals, documents, templates, knowledge, history/activity

Account: Settings · Billing · Help · Log out (grouped lower).

Do not expand primary nav into a CRM (no lead stages, funnels, scoring, pipelines, dashboards).

---

## Visual Language

- **Accent:** one burgundy/oxblood (OKLCH) used sparingly; risk-severity palette is separate
- **UI text:** plain sans-serif (Mona Sans Variable via `@fontsource-variable/mona-sans`) for controls, labels, interface
- **Work content:** serif typography for actual document and work content so output reads like a professional artifact
- **Aesthetic:** clean, minimal, professional, document/work-oriented
- **Prohibited:** gradients, chatbot sparkle, generic SaaS dashboard chrome, unnecessary visual noise

The work surface, not the chat chrome, carries the visual weight.

---

## AI Provider Layer

**Current state:** provider-agnostic interface (`callAI({ systemPrompt, userContent, temperature, maxTokens })`) with three adapters — Gemini (`src/lib/ai/providers/gemini.ts`), OpenAI-compatible (`src/lib/ai/providers/openai-compatible.ts`, covers NVIDIA NIM), and Anthropic Claude (`src/lib/ai/providers/anthropic.ts`, genuine Messages API contract: `POST /v1/messages`, `x-api-key` plus `anthropic-version` headers, text extracted from response content blocks).

**Surface (Phase 22C):** authenticated Deal Intelligence resolves via centralized `resolveSurfaceConfig("authenticated")` (`src/lib/ai/providers.ts`) to Claude Sonnet 5 (`AUTH_AI_MODEL`, default `claude-sonnet-5`) with a Claude Opus 5 fallback (`AUTH_AI_FALLBACK_MODEL`, default `claude-opus-5`) on retryable failure categories only (timeout, network, rate limit, provider, malformed response). Auth, config, and invalid-request failures never fall back. Domain functions (`extract`, `risk-analysis`, `negotiation`, `generate`) take an explicit surface parameter defaulting to authenticated. There is no anonymous surface.

**Failure model:** `AIProviderError` with categories config, auth, invalid_request, malformed_response, timeout, network, rate_limit, provider (`src/lib/ai/errors.ts`). Fallback metadata (primary attempted, failure category, fallback attempted and result) is logged metadata-only and surfaced through the existing `usedFallback` flag; provider diagnostics never reach users (authenticated paths use `publicErrorMessage`).

**Reason for this:** currently running on a budget key from a non-Gemini provider, with intent to serve authenticated intelligence from Claude once an Anthropic key is configured. Adapter swaps remain config changes, not rewrites.

**Response handling:** JSON extraction is provider-agnostic already — strips code fences, falls back to slicing the first `{…}` block, then coerces fields with defaults. This should keep working across providers, though non-Gemini models may follow the JSON-output instruction less reliably and exercise the fallback path more often — worth testing before trusting it for anything client-facing.

**Token usage:** adapters return measured usage where the provider reports it (Anthropic `usage`, Gemini `usageMetadata`, OpenAI-compatible `usage`), threaded into `SurfaceCallMeta.usage` (`src/lib/ai/providers.ts`). Absent usage stays absent, never zeroed. No adapter fabricates counts.

---

## Single Classifier / Brain

All user input enters through one classifier (`src/lib/conversation/classify.ts`):

- `isGreeting(text)` — deterministic fast-path for greetings (no AI, no ledger)
- `classifyOperation(text, hasDocument)` — maps free text to `AIOperation` (`proposal | negotiation | drafting | comparison | decision_support | explanation | document_analysis | conversation`)
- `inferIntent(text, operation)` — maps to `UserIntent` (`explore | understand | evaluate | negotiate | draft | compare | review | decide | propose`)

`Composer` (`src/components/chat/Composer.tsx`) and `src/lib/chat/actions.ts` (`createDealThread`) reuse the same functions for routing and for cost estimation. The conversation request pipeline (`src/lib/conversation/request.ts`) applies the same operation profile and intent without duplicating the decision.

Do not create multiple competing message routers. Do not introduce a second dispatch architecture. The classifier is the single brain; everything else is downstream handling.

---

## AI Response Architecture (Pre-5D Correction)

Dealenz is not a document analyzer with chat. Documents are one input; conversation is another. Both flow through one provider router, one context model, one knowledge resolver, and one credit economy:

```text
                    USER
                     │
          ┌──────────┴──────────┐
          ↓                     ↓
    Conversation            Documents
          │                     │
          └──────────┬──────────┘
                     ↓
               Intent / Goal
                     ↓
                  Context
                     ↓
                Knowledge
                     ↓
                   Rules
                     ↓
             Deterministic
               Evaluation
                     ↓
                 Findings
                     ↓
              AI Synthesis
                     ↓
        Response Constitution
                     ↓
              User Response
                     │
                     ↓
              AI Usage Record
                     │
                     ↓
              Credit Boundary
                     │
                     ↓
               Credit Ledger
```

- **Operations and intent** (`src/lib/ai/operations.ts`): an AI request originates from one of `document_analysis`, `conversation`, `negotiation`, `drafting`, `comparison`, `explanation`, `decision_support`. Input is distinct from intent (`UserIntent`: explore through decide); the user objective (`UserObjective`) is preserved separately from deal facts. Document analysis requires input; conversation explicitly does not. Each operation carries an output-budget tier and a context-selection policy (minimal for simple questions, expanded for deep analysis).

- **Response constitution** (`src/lib/ai/constitution.ts`): the durable behavior contract. Dealenz works for the user, never for closing the deal; facts, assumptions, and uncertainty stay separated; unknown never becomes false; plain complete sentences; em dashes banned from user-facing output (tested); concise by default and as detailed as the task requires; no sycophancy; no commercial bias. Structured machine-read prompts are excluded from the prose contract; user-facing prompts (today: negotiation points) receive it via `applyConstitution`. **AI proposes. It never decides.**

- **Credit economy:** `Ask` conversations consume credits through one accounting boundary (`src/lib/credits/policy.ts:41` `authorize→reserve→finalize/void`, `pricing.ts:19` `1/3/8` flat per-operation, `STANDARD_CREDIT_POLICY`). `AIUsageRecord` (`src/lib/ai/usage.ts`) represents operation, provider, model, measured tokens, credit charge, outcome; tokens never derive credits. Balances live in append-mostly `credit_ledger` (`00023`) with advisory-locked `reserve_credits` idempotent on `(user_id,idempotency_key)`. **Authenticated `analyzeDeal`/`generateProtectionPackage` are currently free and rate-limited `5/day` / `10/day` via atomic `increment_usage` (`00018`) `usage_tracking` — not billed through `credit_ledger`. This is intentional for the release candidate: core analysis is free, Ask is metered. `usage_tracking` remains the abuse rate-limit, `credit_ledger` remains the Ask economy; no double system.

- **Verticals and conversation (Phases 5E-6, 13-14, persisted in 10):** verticals plug into the same pipeline through a dispatcher (`src/lib/verticals/index.ts`, resolved by deal type): freelance/service deals (`src/lib/verticals/freelance/`, 9-rule pack), lease deals (`src/lib/verticals/lease/`, 9-rule pack), purchase/sale deals (`src/lib/verticals/purchase_sale/`, 8-rule pack, migration `00029`), employment deals (`src/lib/verticals/employment/`, 8-rule pack, migration `00030`), founder deals (`src/lib/verticals/founder/`, 8-rule pack, migration `00032`), and partnership deals (`src/lib/verticals/partnership/`, 8-rule pack, migration `00034`), each with deterministic fact projection from extraction output, a scoped rule pack evaluated in `analyzeDeal` and conversation, and knowledge filtering over shared resolver candidates. Shared observation helpers live in `src/lib/verticals/observe.ts`. Conversation is a backend request pipeline (`src/lib/conversation/request.ts`): question to operation to context to knowledge to rules to synthesis to usage to accounting, with document-free, document-required, and mixed flows. Greetings take a deterministic fast-path (no AI call, no ledger interaction). Lease, purchase/sale, employment, founder, and partnership audits persist their `deal_type` (`00027`/`00029`/`00030`/`00032`/`00034`); each non-freelance analysis uses the adaptive generic AI path plus its deterministic vertical rules, never the freelance 8-category engine. **Vertical knowledge:** founder/partnership keys are populated (Nigeria CAMA/CAC, migration `00035`); Tier 2 keys are populated by migration `00038` — `PURCHASE_SALE_KNOWLEDGE_KEYS` (6: US/UK/EU/DE/FR/NL sale sources), `LEASE_KNOWLEDGE_KEYS` (5: US-CA/UK/DE/FR/NL tenancy sources), `EMPLOYMENT_KNOWLEDGE_KEYS` (5: US/UK/DE/FR/NL employment sources); shared resolver still applies (global/unconstrained items), rules are `product_policy` only, and evidence `exact` is emitted only for `raw_input` matches from an inspectable audit.

- **Product surface and economy (Phases 5G + 10):** the Ask experience (`src/app/ask/`, `src/components/ask/`) puts the conversation pipeline behind an authenticated page with optional audit attachment, bounded caller history (server-truncated), per-answer credit display, conversation list/history, and findings/sources rendering. Pricing is explicit and provisional (`STANDARD_CREDIT_POLICY`: brief 1, standard 3, extended 8 credits per operation; flat per-operation charges, never token-derived). Estimated cost is shown before computation (0 for greetings, otherwise tier price) and every turn is authorized/reserved before the provider call. The first production corpus (migration `00026`, three web-verified freelance items) seeds published knowledge with real provenance.

- **Evidence mapping (Phases 7–9):** every affirmative vertical observation carries validated `Evidence` references (`src/lib/evidence/schema.ts`: source type, source id/version, exact/approximate/unavailable location, quote, observation key, method, bounded confidence, inspectable flag; deterministic content-derived ids). **Exact offsets are proven only for `raw_input` matches from an inspectable audit** (`src/lib/verticals/observe.ts`): the match index inside the verbatim pasted input yields `exact` offsets that verify at display time against the same `raw_input` text; every other section, non-inspectable source, or extraction-derived fact stays `approximate` or `unavailable` — offsets are never manufactured. After evaluation, `attachEvidence` (`src/lib/evidence/collect.ts`) walks each fired rule's condition and gathers the evidence behind the facts and knowledge it actually read; PASS/UNKNOWN results carry none. Findings embed their evidence (`Finding.evidence`), which flows through selection into the Ask UI's compact source lines and the workspace `FindingsPanel` (persisted findings with Inspect-source actions backed by the ownership-checked `src/app/audit/[id]/evidence-actions.ts` action and the `src/lib/evidence/inspect.ts` verifier). Synthesis inputs never truncate silently: negotiation receives the full FAIL set with an explicit bound, and conversation prompts state the focused/total finding counts when intent filtering narrows the set. Knowledge provenance is bridged by reference, never duplicated. No evidence table exists: evidence travels embedded in facts and findings and is never persisted beyond the existing audit payloads.

**Product principle:** Dealenz optimizes for useful intelligence, not maximum token consumption. Credits authorize computation, not influence over substantive answers.

Credits determine access to computation. Credits do not determine conclusions.

*Phase 5F live verification (linked Supabase project): migrations 00021 through 00025 applied; RLS probed live as anonymous, authenticated non-admin, and admin-metadata subjects (published-only for the first two, drafts visible to admins, non-admin writes denied); credit RPCs exercised live (reserve allow/deny, idempotent replay, finalize math, void release, admin grant gate both directions); all probe data removed afterwards. True-simultaneous concurrency, live provider calls, and remote CI remain unverified in this environment.*

---

## Work Execution Model

The target workflow is not a generic agent loop. It is a bounded product workflow:

**Objective → Plan + Cost → Human Approval → Execute → Observe → Adapt/Continue → Human Gate when needed → Work Product → Audit Trail**

This is the architecture behind `product.md` Work Execution Model. Chat accepts the objective; the system determines the work required; before substantial or expensive multi-step work the user sees the plan and the expected credit cost and approves; execution runs bounded capabilities; results are observable; the system can determine whether another bounded step is warranted; consequential actions (sending a proposal, inviting a counterparty, requesting a lawyer) require an explicit human gate; the work product is produced; an audit trail is preserved.

**Bounded capabilities are:** intake and file text extraction (`src/lib/text-extract.ts`), AI extraction (`src/lib/ai/extract.ts`), context inference and confirmation (`src/lib/context/*`), knowledge resolution (`src/lib/knowledge/*`), deterministic rule evaluation (`src/lib/rules/*` via `src/lib/verticals/*`), evidence attachment (`src/lib/evidence/collect.ts`), AI synthesis (`src/lib/ai/*`), protection intents and clause rendering (`src/lib/protection/*`), document assembly and generation (`src/lib/documents/*`, `src/lib/generate.ts`), lawyer handoff (`src/lib/consultation/handoff.ts`), sharing and signing (`src/app/api/document/*`), and monitoring for signed-deal dates/events with email alerts.

No unrestricted tool use. No self-directed business decisions. No hidden actions. No silent external communication. No generic workflow builder. The implementation remains the existing primitives composed by Server Actions (`src/app/audit/[id]/actions.ts:309` `analyzeDeal`, `src/lib/chat/actions.ts:51` `createDealThread` / `65` `analyzeAndPostRisk` / `157` `generateDocumentAndPost`); the agentic direction is about sequencing them with approval and observation, not replacing them.

The model moves Dealenz from:

> "Tell me what this contract means."

toward:

> "Help me prepare this deal."

without implying unlimited autonomy.

---

## Evidence / Clickable Findings and Auditability

**Finding → source** is a product requirement. A meaningful finding must be traceable to the exact relevant text and location in the source document.

The implementation uses the existing evidence model:

- `EXACT` / `APPROXIMATE` / `UNAVAILABLE` (`src/lib/evidence/schema.ts`) — never `UNKNOWN` as `PASS`/`FAIL`
- Deterministic, content-derived ids; offsets only for `raw_input` exact matches (proven, not manufactured)
- `Finding.evidence` embedded in rule results (`src/lib/rules/schema.ts`) via `attachEvidence`; no evidence table

**Current UX:** `FindingsPanel` (`src/components/audit/findings-panel.tsx`) and `src/lib/evidence/inspect.ts` with `src/app/audit/[id]/evidence-actions.ts` (ownership-checked) support Inspect-source. Full click-to-highlight that scrolls a document viewer to the precise span is part of the complete product (to be built) — listed as architectural direction, not claimed as implemented before it is.

**Auditability** for substantial work reuses `activity_events` (user actions, `audit_id` + `event_type` + `payload`), `system_logs` (phase/status/duration/error), `audits.structured_data` (persisted `deterministicFindings` + `extractedData`), `document_versions` (content + `generation_method`), `conversation_messages` (objective, plan, approval messages), and `credit_ledger` (what was charged, when). Bounded, explainable, auditable deal work — not a generic agent trace.

**Assumption / inference review before consequences:** Before sending or committing something consequential (proposal, external communication), the system must surface known vs inferred vs missing provenance so the user can review and approve. This maps to `ContextEnvelope` field `source` (`unknown` / `inferred` / `user_confirmed`) with bounded confidence (`src/lib/context/schema.ts:27`), and to `ProtectionIntent` / `ClauseTemplate` variable `{{var}}` preservation as `UNKNOWN` (`src/lib/protection/clauses.ts:30` `renderClauseTemplate`). A new generic provenance system is not introduced.

---

## Signatures

The intended signing model is:

1. Dealenz prepares the document.
2. The owner/user signs first (`POST /api/document/[auditId]/sign-owner`).
3. It is sent to the counterparty (`POST /api/document/[auditId]/send`, generates magic link to `/view/[token]` and optional `/sign/[token]`).
4. The counterparty signs (`POST /api/document/[auditId]/invite` multi-party, token-gated `get_signer_view`/`sign_as_invitee`).
5. Once fully signed, the document is locked (status `execution-locked` per `00048`).
6. It cannot be edited in place.
7. Changes require a new version or redraft (`document_versions` new row, `version_number` increment per `00048` unique constraint on `audit_id` + `document_type` + `version_number`).

Implemented via `document_versions` (`00012`, `00059` provenance/hash/status, `00060` `draft→ready_to_sign→owner_signed→counterparty_pending→fully_signed→locked→superseded` + `owner_signed_at/counterparty_signed_at/fully_signed_at/locked_at`, `enforce_document_version_lock` trigger, `signing_events` immutable `idempotency_key` unique, `sign_document_as_owner/counterparty` `SECURITY DEFINER` + `pg_advisory_xact_lock` + idempotency `plan:version:sign`, `create_redraft_version` preserving `parent_version_id/content_hash/provenance`), `document_signers`/`document_signatures`/`share_tokens` (`00013`, `00044` multi-party `sign_as_invitee/sign_as_owner` + token-gated `get_signer_view`), `src/lib/signing/transitions.ts` state machine + `store.ts` `redraftFromLocked` + `src/components/signing/SignReview.tsx` (version/parties/assumptions/missing/hash/locking). Fully signed → locked is server-enforced, not UI-only; redraft never mutates locked, creates new draft with history and `change_summary`.

---

## Signed-Deal Monitoring

Implemented for signed/locked deals (`00062` `monitoring_events` `renewal/expiration/notice_period/payment_due/obligation/deadline/material_event/custom` + `provenance exact/approximate/unknown/user_confirmed` + `evidence` JSONB + `due_date` + RLS, `monitoring_alerts` `idempotency_key` `alert:evt:dest:date` unique + `provider_message_id`, `src/lib/monitoring/extract.ts` deterministic patterns (`renewal date: YYYY-MM-DD` etc.) + findings-based `material_event` approximate, `src/lib/monitoring/store.ts` `createMonitoringEvent/createMonitoringAlert/sendMonitoringAlert` via Gmail `sendGmailForRow` idempotent `planId:ver:rowId:send`, `observation_failed` truthful, `trigger enforce_monitoring_for_signed_deal` preserves provenance). Alerts are explicit, attributable, auditable, idempotent, bounded (one per event+destination), with `eventId/alertId/destination/timestamp/providerMessageId` recorded. Keep bounded to deal lifecycle, not generic platform.

---

## Extraction & Risk Schema — Generalization Status

The deal-type generalization is partially built:

- **`deal_type` column exists** — migration `00019_add_deal_type.sql` adds `deal_type` to the `audits` table; the check constraint now allows `freelance, generic, lease, purchase_sale, employment, founder, partnership` (extended forward-only by `00027`, `00029`, `00030`, `00032`, `00034`).
- **Deal-type-specific extraction prompts exist** — `src/lib/ai/prompts.ts` has `EXTRACTION_SYSTEM_PROMPT` (freelance) and `GENERIC_EXTRACTION_SYSTEM_PROMPT` (generic). `src/lib/ai/extract.ts` selects the prompt based on `dealType`.
- **Generic mode has deterministic authority** — `src/lib/verticals/generic/` provides 7 deterministic rules plus `bucketForGenericFindings`; `analyzeDeal` overrides AI headline scores with the deterministic bucket (AI summary/recommendations kept). `src/lib/ai/risk-analysis.ts` provides `analyzeGenericRiskWithVisibleFailure` for adaptive AI themes.
- **Freelance deterministic rule engine is complete** — `src/lib/risk/engine.ts` implements the 8 freelance categories (scope, payment, timeline, communication, revision, legal, IP, client behavior) and is used as the fallback when the AI call fails.

**Current state:** every deal type has a deterministic rule pack (freelance 9 + 8-category engine, lease 9, purchase_sale 8, employment 8, generic 7, founder 8, partnership 8). Non-freelance analyses use adaptive generic AI themes plus a deterministic floor (`deterministicRiskFloor` in `src/lib/rules/result.ts`): an AI Low can never hide a deterministic FAIL, while an AI High with no FAIL is preserved as advisory. Freelance headline scoring remains AI-primary with the deterministic engine as fallback.

### Known Fidelity Gap

Conflicting material terms can currently collapse into a single extracted string before the rules layer sees them. Example: `payment due 14 days after invoice` vs `30 days after receiving completed work` may be generalized to a single `budget` or `timeline` string at `src/lib/ai/extract.ts:15` (`extractJson` + LLM prompt `src/lib/ai/prompts.ts:18`) before `src/lib/verticals/*/facts.ts` expose the value to rules. The `raw_input` survives in `audits.raw_input`, but `structured_data.extractedData` does not preserve competing observations, so no finding or mitigation can surface the conflict. This is an unresolved authenticated extraction fidelity issue (Phase 22C). Fix belongs in a focused extraction-fidelity phase (multi-value preservation + one conflict-detection rule), not bundled with work-execution or agentic changes. Do not obscure it.

---

## Local Development

```
npm run db:start     # spins up local Supabase (Postgres + Auth + Storage)
npm run db:migrate    # applies migrations in supabase/migrations/
npm run db:types      # regenerates TypeScript types from the DB schema
npm run dev           # Next.js dev server
```

Required env vars for a working local instance: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `AI_API_KEY`, `AI_PROVIDER`, `AI_BASE_URL`, `AI_MODEL`, `NEXT_PUBLIC_APP_URL`. See `.env.example` for the full list. No seed data currently exists — a fresh local DB starts empty, so testing the full loop means manually creating a user and running through intake yourself.

---

## Environment Variables (Reference)

| Var | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL, exposed to client |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key, exposed to client (safe — RLS enforces access) |
| `AI_PROVIDER` | Selects the AI adapter (`gemini` or `openai_compatible`) — shared/legacy path; authenticated intelligence uses `AUTH_AI_*` |
| `AI_API_KEY` | Key for the active provider |
| `AI_BASE_URL` | Endpoint for the active provider |
| `AI_MODEL` | Model name for the active provider |
| `ANTHROPIC_API_KEY` | Key for Claude authenticated calls (server-only, never committed) |
| `AUTH_AI_PROVIDER` | Adapter for authenticated calls (`anthropic` default; `gemini` or `openai_compatible` supported without cross-model fallback) |
| `AUTH_AI_MODEL` | Authenticated primary model (default `claude-sonnet-5`) |
| `AUTH_AI_FALLBACK_MODEL` | Authenticated fallback model (default `claude-opus-5`) |
| `ANTHROPIC_BASE_URL` | Optional Anthropic endpoint override (default `https://api.anthropic.com`) |
| `NEXT_PUBLIC_APP_URL` | Base URL used in generated share links |

Software billing is **Paddle** (`PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`, `PADDLE_PRICE_STARTER/STANDARD/PRO`). No `QUICK_REVIEW_*` vars — anonymous analysis is gone.

---

## File Upload & Storage

Uploaded deal files (briefs, PDFs, DOCX) go to the `audit-files` Supabase Storage bucket. Limits: 10MB per request body, 10MB per file, 10 files per audit. Storage RLS policies scope access by folder name matching `auth.uid()`, so a user can only reach their own uploaded files even though the bucket itself isn't fully private. Extraction reads these files server-side via `pdf-parse` / `mammoth` before AI extraction runs.

---

## Rate Limiting

Enforced via the `usage_tracking` table (unique per user/action-type/day) and an `increment_usage` RPC that checks the count before incrementing, not after — this was previously a bug (unconditional increment) and is now fixed. Limits: 5 deal analyses and 10 protection-package generations per user per day. This is a cost control on AI spend, not a monetization gate yet — there's no paid tier that raises these limits.

`anonymous_rate_limits` (`00040`) and `check_anonymous_rate_limit` remain for other unauthenticated paths (`/view/[token]` share view `20/hr`, auth logging, `POST /api/client-errors` `20/hr`) — not as an analysis quota.

---

## Security

Consolidated from what the audit verified plus standard practice for a SaaS handling other people's client/deal data.

**Authentication** — Supabase Auth (email/password), session refresh handled per-request. Email verification is required before a user can run analysis or generate documents, enforced at both the route layer and inside individual Server Actions (defense in depth, not a single point of failure). No 2FA currently — reasonable to defer at this stage, worth adding once there's real money or contracts flowing through signed documents.

**Email-verification policy (P0-3, authoritative)** — verification gates AI/cost-bearing or otherwise consequential actions, never reads of the caller's own data:
- **Blocked pre-verification:** `analyzeDeal`, `generateProtectionPackage`, `generateBusinessOwnerDraft`, context inference (`context-actions.ts`), all Ask actions including reads (`ask/actions.ts`), all work-plan mutations plus approval/execution/resume (`src/lib/work/actions.ts`), monitoring event/alert creation and alert sends (`src/lib/monitoring/actions.ts`), chat risk-analysis and document-generation posts (`src/lib/chat/actions.ts`).
- **Intentionally available pre-verification:** account creation, audit/draft creation (`audit/new`, `createDealThread`), file attach/remove on own audits, own-data reads (dashboard, thread messages, plan/work-product reads, monitoring state, vault list/chat — vault is pure reads over own audits with no AI, credits, or external effects).
- Downstream AI gates (`analyzeDeal`, `generateProtectionPackage`) still fail closed if reached indirectly — the per-surface checks above are defense in depth with a clear user message, not the only enforcement.

**Gmail OAuth state (P0-2)** — the OAuth `state` HMAC is keyed ONLY by the dedicated server-only `GMAIL_OAUTH_STATE_SECRET` (`src/lib/gmail/oauth-state.ts`, 10-minute expiry, `timingSafeEqual` compare). A missing secret fails closed (`500 Gmail not configured` on init, `400 Invalid state` on callback) with no fallback to `GOOGLE_CLIENT_SECRET`, the service role key, or a dev key, and no secret material in logs or responses. `GOOGLE_CLIENT_SECRET` remains in use solely for the server-side code-for-token exchange.

**Storage RLS (P0-1)** — the `20260903000001` storage draft is superseded and must stay unapplied: its remediation was carried forward idempotently by `00039` and then tightened by `00065`, which additionally binds the second path segment to a caller-owned audit (`foldername(name)[2]` must be the caller's `audits.id`). Effective enforcement is `bucket_id='audit-files'` + first-segment `auth.uid()` + audit-ownership EXISTS, on all four (upload/view/update/delete) policies. No migration in the chain issues `ALTER TABLE storage.objects` (hosted-unsafe); see `src/lib/security/migrations.test.ts` P0-1 block.

**Authorization** — Row Level Security on every table, scoped to `auth.uid()`. This is the primary authorization mechanism, not application-layer checks — meaning even a bug in a Server Action can't leak another user's data, because the database itself refuses the query. Two RPCs are `SECURITY DEFINER` with public (`anon`) execute grants, intentionally, to support the unauthenticated client-facing share/sign flow — any new `SECURITY DEFINER` function needs the same scrutiny: default to RLS, only bypass it when there's a specific, narrow, justified reason.

**Secrets management** — all keys via environment variables, never hardcoded. `.env*` is gitignored. `NEXT_PUBLIC_*` vars are intentionally public (safe because RLS enforces actual access); anything without that prefix is server-only. Standard practice worth adopting as the team or surface area grows: rotate keys on a schedule, use a secrets manager (Vercel env vars are fine at this stage) rather than passing `.env` files around manually.

**Input validation** — Server Actions whitelist allowed fields and status values rather than trusting arbitrary input. File uploads are checked for type and size before processing. Worth confirming: whether markdown rendered from AI output or user input goes through XSS sanitization before display — this wasn't confirmed in the last audit and is worth a direct check, since generated documents and shared client-facing pages are exactly where stored XSS would matter most.

**Transport & headers** — CSP is configured (`next.config.ts`), allowing the AI provider's domain and otherwise fairly locked down, though `unsafe-inline`/`unsafe-eval` are currently permitted for scripts — a common Next.js default but worth tightening once you know exactly what needs inline scripts. **Note:** The CSP `connect-src` only restricts browser-side requests. All AI provider calls (`callGeminiProvider`, `callOpenAICompatible`) run server-side in Server Actions (`src/app/audit/[id]/actions.ts`, `src/app/audit/new/actions.ts`), so they are not subject to the browser CSP. No CSP change is needed when switching providers. HTTPS is assumed via hosting platform, not something this app configures itself.

**Dependency security** — `npm audit` should run as part of any regular maintenance cadence, not just when an audit happens to be requested. Several high-severity issues existed as of the last check; the fix (patching to newer versions) should happen on a branch with a full build/typecheck pass, since some patches move outside currently declared version ranges.

**Data privacy** — this product stores client names, deal terms, contract content, and signed documents — this is sensitive business data even without being classic PII like SSNs. No stated data retention policy exists yet (how long is a completed/abandoned audit kept?). Worth deciding before there's real user data to worry about: a simple stance like "data is kept until the user deletes their account" is enough for now, but it should be a stated decision, not an accident of the schema having no deletion logic.

---

## Caching

No caching layer currently exists — every request hits Supabase directly. For this app's actual shape, caching mostly matters in a few specific places, not everywhere:

- **Templates library** (`/templates`) — static, same for every user, a good candidate for Next.js's built-in data cache with a long revalidate window, since it changes rarely.
- **Risk Intelligence static library** — same reasoning, the 9 static risk patterns don't need a fresh DB read on every page load.
- **Dashboard, deal list, audit detail** — these should stay uncached or very short-lived (or use React's per-request cache only), since they're personalized and RLS-scoped — caching these across users would be a data leak, and caching them per-user adds complexity that likely isn't worth it until there's a real performance problem.
- **AI extraction/risk/generation calls** — do not cache these. Each input is unique to a specific deal; caching AI output would mean either serving stale analysis or accidentally serving one user's extracted data to another.

The practical takeaway: cache what's read-heavy and identical for everyone, leave everything RLS-scoped and personalized uncached until there's a measured performance reason to do otherwise. Premature caching on user-specific data is a more likely bug source than a real win at current scale.

---

## Observability & Monitoring

Currently: `system_logs` records phase/status/duration for key operations, queried manually in Postgres. No error tracking service, no uptime monitoring, no alerting — if something breaks in production right now, the first sign is a user reporting it, not the system telling you.

Reasonable next steps for a solo-built SaaS, roughly in order of value per effort:

1. **Error tracking** (e.g. Sentry) — catches unhandled exceptions in Server Actions and client components with stack traces, instead of silent failures or generic error boundaries.
2. **Uptime monitoring** — a simple external ping (even a free-tier service) against the production URL, so you find out about downtime before a user does.
3. **Alerting on AI provider failures** — since AI calls silently fall back to templates/rule-engine on failure, it's possible for the product to degrade without anyone noticing (as already happened with the mismatched API key). A simple alert when the fallback path fires more than expected would catch this class of problem early. **Note:** Fallback events are already logged in `system_logs` with phase `risk_fallback` (see `src/app/audit/[id]/actions.ts:443`), but no alerting exists on this signal.

---

## Deployment (Default Assumption, Not Yet Confirmed)

No stated hosting decision exists yet. For a Next.js + Supabase app at this stage, the default path is Vercel for the app and Supabase's hosted platform for the database — this is the path of least friction and matches what the stack is already built for (Next.js Server Actions, Supabase SSR helpers). Treat this as the default until you decide otherwise, not as something already set up.

---

## CI/CD

Minimal pipeline exists: `.github/workflows/ci.yml` runs `npm ci`, typecheck, lint, `npm test`, and production build with CI dummy env values (no real secrets). No deployment job yet.

---

## Backup & Recovery

No stated RPO/RTO. Supabase's hosted platform includes automated daily backups on paid tiers, which is a reasonable default to lean on rather than building anything custom at this stage. Worth revisiting once real user data (signed contracts, deal history) makes data loss something that could actually hurt a freelancer, not just be an inconvenience.

---

## Non-Functional Targets

No stated targets exist beyond "works for a handful of founders and small business owners," which is the audit's own framing of current readiness. Not worth inventing artificial SLAs at this stage — but worth writing down once there's a real answer, since "no target" quietly becomes "no one notices when it's slow" otherwise.

---

## Technical Debt & Known Issues

- **State sprawl:** the deal workspace component holds 14+ `useState`, 5 `useRef`, 5 `useEffect` in one file. Works, but any new feature touching intake/analysis/generation risks conflicting with existing state transitions.
- **No pagination:** dashboard/deals/risk-intelligence pages use fixed `limit()` calls with no cursor. Fine at current scale, will need addressing before real usage volume.
- **Search is a full table scan:** `ILIKE` on title only, no index. Same scale caveat as above.
- **No background jobs:** document generation is synchronous inside a Server Action — 4 sequential AI calls per protection package, each with its own timeout. Long-tail latency risk as usage grows; will eventually need a queue for bounded execution steps.
- **Tests wired to CI:** `npm test` runs 146 Vitest files (1105 tests) and `.github/workflows/ci.yml` gates typecheck, lint, tests, and build on every push.
- **Dependency vulnerabilities:** several high-severity issues across Next.js, PostCSS, sharp, and a few transitive packages as of the last audit — needs a patch pass, ideally on a branch with a full build+typecheck before merging (some fixes bump Next outside the currently declared version range).
- **Extraction fidelity gap:** single-string `budget`/`timeline` in `ExtractedData` can collapse conflicting material terms before rules see them (see Fidelity Gap). Fix belongs in focused phase, not bundled with work-execution.

---

## UX / UI

### Design Principles (Stated, Apply Across the Product)

- **Accent:** one burgundy/oxblood, used sparingly
- **UI text:** plain sans-serif (Mona Sans Variable via `@fontsource-variable/mona-sans`)
- **Work content:** serif typography for actual document and work content so output reads like a professional artifact
- Clean, minimal, professional, document/work-oriented
- No gradients, no chatbot sparkle, no generic SaaS dashboard chrome, no unnecessary visual noise
- Reject AI-sounding copy and generic SaaS design defaults throughout — this applies to UI copy, empty states, and error messages, not just marketing pages.
- No em dashes anywhere in shipped copy.

### Information Architecture (As Built Today)

```
Landing (marketing, acquisition layer — see product.md)
  → Auth (login / register / email verification)
    → Chat (composer + persistent threads, classifier-routed)
      → Deal Thread (chat thread bound to an audit, split-pane work surface)
        → Analysis (extraction + deterministic findings + evidence)
        → Protection (intents, clauses, term-sheet drafting / freelance generation)
        → Documents (versions, share, sign)
    → Home (threads/work list, not a CRM)
    → Library (/library — deals, documents, templates, history; /vault → /library)
    → Deals (list, search)
    → Templates (12 vetted templates, filterable by deal type — generic for now)
    → Risk Intelligence (personal risk activity + static risk library)
    → Settings / Billing (Paddle balance, packages, history)
  → Client-facing (unauthenticated): shared document view → sign (token-gated)
```

### Frontend Structure

**Desktop** is a resizable split-screen (`SplitPane` + `useIsDesktop`, `src/components/split-pane`, `src/components/chat/ChatThread.tsx`). Chat/control on the left, work/output on the right and wider. Work surfaces (findings, reports, documents, proposals, case files, approvals) are richer than chat bubbles.

**Mobile** is a single column. `ChatThread` collapses the split; work surfaces render as cards and sections inside the conversation stream.

**Sidebar** is Home + Library only. Account items (Settings, Billing, Help, Log out) are grouped lower. No CRM pipeline nav.

See `product.md` Frontend Structure and Visual Language for the full product requirement.

### Landing Page

The public landing page (`src/app/page.tsx`) describes the product and links to the authenticated workspace with one-accent clean document-oriented styling. There is no anonymous analysis mode. There was previously a `/api/analyze-anonymous` + `landing-mini-dashboard.tsx` widget; both were removed in Phase 22C.

### What Changes for the Broader Audience

- **New Audit needs a deal-type step.** This is now built — the `DealTypeSelector` component (`src/components/audit/deal-type-selector.tsx`) presents Freelance, Purchase/Sale, Employment, Founder, Partnership, Lease, and Generic options and is used in `/audit/new`. The intake flow now branches on deal type for extraction and risk analysis.
- **"Client" language needs to become conditional or generic.** The dashboard, workspace, and document generation all say "client" throughout. For a lease audit, there's a landlord, not a client. Two options: genericize to a neutral term like "counterparty" everywhere (simpler, but loses some of the freelance flow's specificity), or keep deal-type-specific vocabulary that swaps based on the selected deal type (more work, better feel). This is a real UX decision, not just a find-and-replace — recommend deciding after the first non-freelance deal type is scoped, so there's a concrete second vocabulary to design against instead of guessing.
- **Protection Package needs a non-generation mode.** For deal types where the user is reviewing something they received (a lease, an offer) rather than sending something they wrote, the equivalent screen should show risk-annotated terms and negotiation points, not a proposal/SOW/contract generator. This is a distinct UI, not a relabel of the existing tabs.

### States Worth Designing Deliberately (Not Yet All Handled)

- **Empty states** — new user with no deals yet; a deal type with no matching template or risk ruleset (the generic fallback case).
- **AI degraded state** — when the AI call fails and the product falls back to the rule engine/templates, does the user know their result is lower-confidence? Today this fails silently (see the earlier Gemini key mismatch incident) — worth surfacing this in the UI, not just logging it server-side, especially as more deal types lean harder on AI-assisted scoring where no rule engine exists yet.
- **Deal-type-not-yet-supported state** — when generalization ships in phases, some deal types will exist as options before their risk engine is fully built. Decide upfront whether to hide unsupported types, show them as "coming soon," or route them into the generic fallback silently — this is a real product decision, not a UI afterthought.

---

## Target Full-Product Architecture (Planned Layers)

The following layers represent the **target full-product architecture**. Not all layers are implemented; see "Staged / Planned" below.

### 1. Acquisition
- Landing page directing to authenticated workspace
- Conversion to authenticated workspace

### 2. Identity & Account
- Supabase Auth (email/password, email verification)
- Team accounts, roles, invitations
- Profile, preferences, notification settings

### 3. Deal Intelligence
- **Context Resolution** — explicit context envelope (jurisdiction, governing law, party roles, industry, transaction structure, value, stage) with inference + user confirmation
- **Extraction** — deal-type-aware AI extraction with evidence mapping (source spans, EXACT/APPROXIMATE/UNAVAILABLE, not yet full click-to-highlight)
- **Knowledge Framework Resolution** — applicable law, regulation, industry practice, deal-type norms
- **Deterministic Risk Analysis** — pluggable rule engines per deal type, evidence-backed findings
- **AI Synthesis** — explanation, uncertainty flagging, negotiation questions, missing info prioritization

### 3b. Rules and Deterministic Findings (Phase 5D)
- **Context** — what the user confirmed or what was inferred (authoritative for context state; Phase 5B envelope reused directly, never duplicated).
- **Knowledge** — information that may apply (Phase 5C candidates observed by rules, never re-resolved or reinvented).
- **Rules** — deterministic logic in `src/lib/rules/` (schema, pure bounded evaluator, versioned code registry, built-in generic checks). Rules evaluate known facts, context, knowledge applicability, and structured extracted values. No LLM, no network, no wall clock except an explicit `evaluatedAt` input.
- **Findings** — internal authority objects (`RuleResult`: PASS, FAIL with finding, or UNKNOWN with reason). Findings state facts; they are not user prose and carry no numeric score.
- **AI** — reasoning, explanation, prioritization, and communication over findings (negotiation input carries selected FAIL findings; conflicts between asserted and deterministic statuses are detectable via `detectFindingConflicts`). AI never silently flips FAIL or UNKNOWN to PASS. The AI Constitution remains authoritative for all synthesis.

### 4. Knowledge (Planned Layer)
- **Structured Legal Rules** — versioned, jurisdictional, with citations, applicability conditions, effective dates
- **Industry Practices** — prevalence-tagged, jurisdiction-scoped, with commercial implications
- **Deal-Type Schemas** — extraction schemas, risk categories, rule sets, protection templates per deal type
- **Commercial Norms** — industry-specific commercial expectations
- **Versioning & Provenance** — every rule/practice has citation, effective date, version, supersession chain

### 5. Deal Protection (Current vs Planned)
- **Negotiation/protection intelligence** — available for every supported deal type (freelance, lease, purchase_sale, employment, founder, partnership, generic): deterministic FAIL findings under `FindingsPanel` plus AI synthesis under `NegotiationPointsView` where generated. Findings are authoritative, evidence-preserving, and vertical-scoped; PASS/UNKNOWN never become negative claims.
- **Protection intents (Phase 28)** — `ProtectionIntent` (`src/lib/protection/intents.ts`) maps each FAIL finding → structured intent `{id, category, title, problem, recommendation, rationale, priority, evidence, legalContext, variables, status}` via `protectionIntentsFromFindings` (never invents law/facts; missing variables → `UNKNOWN/NEEDS INPUT`). Legal context is a jurisdiction-aware `LegalCitation` from the international corpus (validated, allowlisted, temporal-aware; missing/UNKNOWN jurisdiction yields null, never a Nigeria default; state-scoped sources are region-gated). Tier 2 categories (payment, subject, delivery, warranty, term, termination, maintenance, compensation) map FAILs to protection intents with missing variables. Partnership structure distinction (LLP/LP/ordinary) via `facts.partnership.partnershipStructure`.
- **Clause library (Phase 28)** — `src/lib/protection/clauses.ts` curated Founder (8) + Partnership (8) `ClauseTemplate`s (`id, dealTypes, protectionCategories, title, purpose, variables{key,label,placeholder}, template{{var}}, warnings, legalContextIds, version`). Warnings always label drafting assistance vs legal authority (“This is drafting assistance, not a determination of enforceability.”). `renderClauseTemplate` preserves `{{var}}` for missing inputs; `clausesForProtectionCategory` enforces vertical isolation; clause source ids are filtered by jurisdiction prefix at render. Full document generation remains **partially implemented** — intents + clauses are draft-ready, `canGenerateDocuments` is still freelance-only; founder/partnership/purchase_sale/lease/employment workspace shows term-sheet drafting under Documents while generation stays `hasProtectionDraftSupport` honest.
- **Document generation** — freelance-only via `src/lib/generate.ts` (proposal/SOW/contract/checklist with AI + template fallback). Boundary is `src/lib/protection/index.ts:canGenerateDocuments` + `hasProtectionDraftSupport` (founder/partnership/purchase_sale/lease/employment draft support; families `purchase-terms-sheet`, `lease-terms-summary`, `employment-terms-summary` via `generateBusinessOwnerDraft`) — single source for server (`generateProtectionPackage`) and workspace UI. Workspace Protection renders as `What to negotiate` (FindingsPanel + NegotiationPointsView + ProtectionIntentsView for founder/partnership/Tier 2) / `Documents` (freelance generation or honest coming-soon) so intelligence is not coupled to generation. Provenance chain `deal → facts → findings → intents → clauses → legal research` is traceable; lawyer-handoff payload can consume `dealType, jurisdiction, facts, findings, evidence, risk, intents, citations, missingInfo`.
- **Annotated Agreements** — planned.

### 6. Human Legal / Professional Review (Founder/Partnership handoff now usable)
- **Structured Handoff Package** — `src/lib/consultation/handoff.ts` `HandoffPackage` (`deal, facts, findings, risk, protectionIntents, clauses, documentDraft, legalCitations, evidence, missingInformation, generatedAt`) built from authoritative pipeline (`buildHandoffPackage`), validated (`validateHandoffPackage` — no invented PASS→FAIL, no cross-vertical clause leak, no Nigerian leak into UK/US), jurisdiction explicit (`UNKNOWN` surfaced), `handoff_snapshot` JSONB `00036` (forward-only, RLS via row, capped 100kb, fallback without snapshot if column missing)
- **Consultation Request** — `src/app/audit/[id]/consultation-actions.ts:createConsultationRequest(auditId, note, handoffSnapshot?)` reuses auth/ownership/duplicate-pending/verified-lawyers→`requested` else `waitlist`, stores `handoff_snapshot` (or retries without), honest availability
- **Workspace** — Founder/Partnership `Protection` → `BusinessOwnerDocumentSection` → CTA `Have a lawyer review this deal` (`ShieldCheck`) → `LawyerHandoffReview` panel (Deal, Key issues, Protection, Evidence/legal context, Document, Missing as UNKNOWN, “Drafting assistance” notice, note, Submit) → `consultation_requests` with snapshot; Freelance still uses `LawyerEscalationCard` isolated
- **Review workflow (Phase 5)** — `consultation_status` extended (`accepted`, `changes_requested`, `client_review`); single server-side state machine (`src/lib/review/transitions.ts`); admin assignment, lawyer accept/decline/begin/propose/complete, owner respond/cancel; structured `review_comments` (finding/clause/fact/evidence/document/question targets, lawyer vs client provenance); lawyer revisions append `document_versions` (`lawyer_revision`) via narrow RPC; multi-party `document_signers` bound to exact versions with token-gated invitee signing (`get_signer_view`/`sign_as_invitee`/`decline_as_invitee`), execution derived (all signed); `service_orders` money boundary (no ledger linkage, no Paystack yet); lawyer workspace at `/lawyer/reviews`, client `ReviewPanel` in the workspace, activity_events trail throughout; lawyer reads flow through the scoped `get_lawyer_review_bundle` RPC (audits/document RLS stay owner-only)
- **Lawyer triggers** — recommended only when high-value/high-consequence AND real risky pattern via `src/lib/lawyer/trigger.ts` (`shouldRecommendLawyerReview`); user can always request. Not by deal type.
- **Feedback Loop / Privacy** — still planned (lawyer insights → knowledge, TTL)

### 7. Deal Execution (Future Layer)
- Obligation tracking (milestones, payments, deliverables, deadlines)
- Change order management (scope creep detection, change orders, amendments)
- Post-signature monitoring (scope creep alerts, deadline reminders, renewal tracking) — email required when implemented (future)
- Relationship intelligence (counterparty risk patterns across deals)

### 8. Commerce
- **Credit-based** — usage-based credits, not feature-gated tiers
- **Provider-agnostic billing** — adapter pattern for payment providers
- **Software vs Professional Services separation** — Paddle for software (`@paddle/paddle-node-sdk`, `PADDLE_API_KEY` / `PADDLE_WEBHOOK_SECRET`), lawyer-connected Stripe/Paystack + platform cut for services (future, no integration yet); different commercial/payment mechanisms
- **Credit ledger** — purchases, consumption, refunds, auditability
- **Minimal international credit purchase (Phase 29/31)** — `src/lib/billing/catalog.ts` provider-independent packages (starter 50 / standard 150 / pro 400 credits; USD/GBP/EUR minor units; no NGN), `src/lib/billing/provider.ts` Paddle Billing adapter isolated behind `ProviderAdapter`, server-authoritative `POST /api/billing/checkout` (auth, catalog lookup, throttle, safe return URLs), verified `POST /api/billing/webhook` (Paddle-Signature HMAC, `transaction.completed`/`transaction.paid` events, price→package resolution, amount floor/currency match, non-succeeded never credits, refunds observed without mutation), idempotent `credit_purchases` (`00037`, unique provider+tx; `00043` admits `lemonsqueezy` historically, `00051` adds `paddle`; Stripe rows preserved as history) + ledger `purchase:<tx>` idempotency key, allocation via existing `credit_ledger` grant (no second ledger), billing UI balance + packages + purchase history + processing-state honesty

### 9. Trust & Governance
- Policies as architecture requirements (not just footer links)
- Data governance (retention, deletion, AI provider data sharing, consent)
- Security principles (least privilege, RLS defense in depth, minimal exposure)

### 10. Work Execution & Agentic Direction

Implemented core: `work_plans`/`work_plan_steps`/`work_approvals`/`work_executions`/`work_products` (`00056`) + sequential executor (`src/lib/work/executor.ts`) + plan-level credit reservation (`work_plans.estimated_credits` → one `reserve_credits` after approval → `finalizeReservation(consumed)` per `src/lib/credits/ledger.ts`) + `PlanPreview`/`ExecutionProgress` (`src/components/work/*`) + `hash.ts` payload binding.

Not a generic agent framework. Architecture composes existing primitives via approved Server Actions — no new AI router, no new AI surface, no new conversation store, no new credit system, no new evidence system, no new rule engine. Extensions for the complete product are explicit and narrow: Gmail intake for the proposal/outreach workflow (row validation → personalization → assumptions review → batch approval → Gmail send → results → response back into work context) with spreadsheet as transient input, not a CRM; bounded signing lifecycle (draft → owner signs → counterparty signs → locked → new version); email-based monitoring for signed deals (renewal/deadline/material events). Parallel batch for independent drafts is to be built where the workflow requires it; executor is sequential today.

---

## Staged / Planned Implementation Phases

| Phase | Focus |
|-------|-------|
| **Current (Phase 3 — final product)** | **Complete: Business-owner first + International docs + Lawyer handoff + Work-first shell + Execution Core + Protection & Batch Outreach + Signing & Versioning + Monitoring & Alerts + Payments & Revenue + Parallel/Background + Observability:** Founder/Partnership Tier 1 + `00064` 10 US/UK/EU/FR/DE/NL seeds; Protection `Finding→Intent→Plan→Cost→Approval→Execution→Document→WorkProduct`; Spreadsheet batch `validate_rows/generate_draft/send_email` bounded concurrency 5 `planId:vVer:rIdx:hash`; Gmail `gmail_tokens` RLS server-side `planId:ver:rowId:send` idempotent; **Signing** `draft→ready_to_sign→owner_signed→counterparty_pending→fully_signed→locked→superseded` (`00060` widened status, `owner_signed_at/counterparty_signed_at/fully_signed_at/locked_at`, `signing_events` immutable `audit_id/document_version_id/idempotency_key` unique, `sign_document_as_owner/counterparty` `pg_advisory_xact_lock` + idempotency, `enforce_document_version_lock` trigger, `SignReview` UI); **Redraft** `create_redraft_version` (`parent_version_id`, new `content_hash`, `change_summary`, version history, source `superseded`); **Monitoring** `renewal/expiration/notice/payment/obligation/deadline/material_event` (`00062`, `provenance exact/approximate/unknown/user_confirmed`, `evidence` JSONB, `extractMonitoringEvents` deterministic, `monitoring_alerts` `alert:evt:dest:date` idempotent, Gmail `sendMonitoringAlert`); **Payments** `service_orders` `requested→quoted→paid→fulfilled→cancelled` + `00061` provider Stripe/Paystack `platform_fee 20%` `service_payments` append-only `lawyer_connected_accounts` no secrets `provider_webhook_events` unique `verifyStripe/PaystackSignature` timing-safe `record_service_payment`; **Parallel** executor DAG level parallel concurrency 5 `execution_mode foreground/background/parallel` `attempt/next_retry_at`; **Flywheel** `deal_intelligence_events` (`00063`, `consented`, `tenant_isolation`, 10k cap, cascade delete); **Observability** `system_logs` phase `signing/monitoring/lawyer/payment/gmail/work_execution/background`; Credits `reserve/finalize/void` 0-credit analyze + `Ask` 1/3/8 Paddle only; Evidence `EXACT` offsets; Home/Library `work_products` + `monitoring_alerts` + `pending approvals` attention |
| **Completed** | All core product capabilities implemented; no `Future` deferred product. Genuine boundaries remain only: CRM, generic agent framework, duplicate systems, anonymous analysis, Lemon Squeezy, credits-as-money, lawyer escrow — explicitly out of scope |
| **Verified** | End-to-end: `Deal→Analyze→Evidence→Protect→Generate→Review→Approve→OwnerSign→CounterpartySign→Locked→Monitor→Alert→Redraft→NewCycle` and `Finding→lawyer→review→revision→new version→signing` and `Spreadsheet→validate→generate→assumptions→plan→cost→approval→Gmail→observe→WorkProduct` — all idempotent, RLS, audited |

---

## Open / Unknown

1. **Knowledge sourcing strategy** — Partner with legal publisher? Build in-house with counsel? Crowdsource from lawyers?
2. **Lawyer compensation model** — Per-consultation? Subscription? Revenue share? Platform cut percentage for connected Stripe/Paystack already decided as model, rate still open.
3. **Jurisdiction coverage v1** — Explicit supported jurisdictions list needed
4. **Rule representation** — TypeScript functions + Zod schemas vs JSON AST vs custom DSL?
5. **Dependency vulnerabilities** — High-severity issues across Next.js, PostCSS, sharp, transitive packages
6. **CI/CD pipeline** — `.github/workflows/ci.yml` runs typecheck/lint/test/build; no deployment job yet
7. **Backup & recovery** — No stated RPO/RTO; relying on Supabase automated daily backups
8. **Data retention policy** — No stated policy; need decision before real user data
9. **Payment provider economics** — Paddle is the live software provider (Lemon Squeezy historical only); remaining question is payout availability, not provider selection
10. **Professional services payment** — Lawyer-connected Stripe/Paystack + platform cut (future); no integration yet

---

## Currently Observed (High-Level Repository Inspection)

- **Freelance deal type**: Fully implemented end-to-end (intake → extraction → risk analysis → protection intelligence + protection package generation → PDF export → e-signing)
- **Lease/Purchase/Employment/Founder/Partnership deal types**: deterministic protection intelligence (findings + negotiation points where applicable) plus jurisdiction-aware protection intents, suggested clauses, term-sheet drafting (`purchase-terms-sheet`, `lease-terms-summary`, `employment-terms-summary`), and lawyer handoff; **Generic**: findings + negotiation points, drafting honestly unavailable
- **Freelance deal type**: fully implemented end-to-end as before (proposal/SOW/contract/checklist generation stays freelance-only via `canGenerateDocuments`)
- **Referral MVP**: `referral_codes` + `referral_attributions` (00033), reward via credit ledger (provisional amount, pending sign-off)
- **Google account linking**: explicit `linkIdentity` flow in settings with verified-email check and allowlisted callback
- **Landing page**: Marketing landing page directing to the authenticated workspace (no anonymous analysis mode)
- **Authentication**: Supabase Auth (email/password + Google OAuth), email verification required
- **Database**: Supabase/Postgres with RLS on all tables, 56 forward migrations (`00056` work execution core: `work_plans`/`work_plan_steps`/`work_approvals`/`work_executions`/`work_products` with RLS + `00055` billing grants) plus 3 remediation drafts
- **AI Provider Layer**: Provider-agnostic interface (`callAI`) with Gemini, OpenAI-compatible, and Anthropic Claude adapters; authenticated surface on Claude Sonnet 5 with Opus 5 fallback; no anonymous surface
- **Risk Engine**: 8 freelance categories (scope, payment, timeline, communication, revision, legal, IP, client behavior) with deterministic rules + AI fallback
- **Document Generation**: Proposal → SOW → Contract → Checklist (sequential AI calls with template fallback)
- **Lawyer Handoff**: Contextual Founder/Partnership “Have a lawyer review this deal” CTA after protection/document, `LawyerHandoffReview` panel showing what will be shared (deal type/jurisdiction, critical findings, protection intents, evidence, legal citations/provenance, draft + missing `{{var}}`, honest limitations), submits via existing `consultation_requests` with `handoff_snapshot` `00036` (preserves evidence/VERIFIED…NOT_FOUND, jurisdiction explicit, no Nigeria leak, structure-aware), waitlist vs requested based on verified lawyers; triggers only on high-value + risky pattern (user can always request)
- **Frontend**: Chat-first, work-first split-pane — `ChatThread` (`src/components/chat/ChatThread.tsx`) uses `SplitPane` (`src/components/split-pane`) to render chat/control and work/output side-by-side on desktop (work wider), single-column cards on mobile; sidebar is Home + Library (`/library`, Vault redirects), account menu holds Settings/Billing/Help/Log out; visual language is one accent, sans-serif UI + serif work content, clean minimal professional document-oriented, no gradients/sparkle
- **Classifier**: Central `src/lib/conversation/classify.ts` (`isGreeting`, `classifyOperation` → `proposal/negotiation/drafting/comparison/decision_support/explanation/document_analysis/conversation`, `inferIntent`) drives Composer routing and cost estimation
- **Evidence**: `EXACT/APPROXIMATE/UNAVAILABLE` via `src/lib/verticals/observe.ts` + `src/lib/evidence/inspect.ts`; `attachEvidence` on FAIL findings; `FindingsPanel` Inspect-source actions (implemented) — full click-to-highlight future
- **Work Execution Core**: `work_plans` + `work_plan_steps` (ordered, `dependsOn` DAG, `estimated_credits` sum), `work_approvals` (immutable `payload_hash` + `plan_version` binding, `idempotency_key`, `actor_user_id`), `work_executions` (plan-level `reservation_id` → `credit_ledger`, `pending→running→succeeded/failed/needs_input`), `work_products` (`artifact_refs` + `snapshot`) — migration `00056`, sequential executor (`src/lib/work/executor.ts`), `PlanPreview`/`ExecutionProgress` surfaces (`src/components/work/*`), `hash.ts` binding, `transitions.ts` state machines, plan-level `estimatedCredits` → single reservation only after approval → finalize `consumed`
- **Auth Flow**: Supabase Auth + `src/proxy.ts` as middleware (detected by Next.js 16 by filename convention)
- **Billing**: Paddle is the live software billing provider (`src/lib/billing/provider.ts`); Lemon Squeezy rows are historical (`00043`)

---

## Preserve Existing Value

The current freelance intelligence flow is substantially built. The canonical architecture preserves its conceptual value:

```text
Existing Dealenz capabilities
        ↓
Preserve what is sound
        ↓
Reorient architecture
        ↓
Add context / knowledge / protection / human / execution layers
        ↓
Expand deal coverage
```

Do not recommend throwing away working functionality without evidence.

---

## Open Product Decisions

1. **Deal-type launch sequence**: Freelance (done) → Lease vs Founder vs Generic-first? *Recommendation: Lease next (clear rules, high demand, distinct from freelance)*
2. **Knowledge sourcing**: Partner with legal publisher? Build in-house with counsel? Crowdsource from lawyers?
3. **Generic mode future**: Keep as AI-only fallback? Build lightweight rule engine for common categories? *Recommend: lightweight rules for "contract quality" universals*
4. **Lawyer compensation model**: Per-consultation? Subscription? Revenue share? Platform cut model already locked (connected Stripe/Paystack + platform cut); rate still open.
5. **Jurisdiction coverage v1**: US (CA, NY, DE) + UK only? Or accept global with "limited coverage" disclaimer? *Recommend: explicit supported jurisdictions list*
6. **Context confirmation UX**: How many fields before user fatigue? *Recommend: progressive — required first, recommended inline, optional collapsible*
7. **Rule representation**: TypeScript functions + Zod schemas vs JSON AST vs custom DSL? *Recommend: TypeScript functions with Zod schemas for now; DSL if rule count > 100*
8. **AI provider lock-in**: Current abstraction handles Gemini + OpenAI-compatible + Anthropic. Sufficient? *Yes; Anthropic is now the primary authenticated surface.*
9. **Client intelligence (repeat counterparties)**: Build now or later? *Later — need volume first*
10. **Post-signature monitoring**: Build hooks now (event log) or full module later? *Build event log hooks now; execution module later — email required when built.*

---

## Preserve Existing Value

The current freelance intelligence flow is substantially built. The canonical architecture preserves its conceptual value:

```text
Existing Dealenz capabilities
        ↓
Preserve what is sound
        ↓
Reorient architecture
        ↓
Add context / knowledge / protection / human / execution layers
        ↓
Expand deal coverage
```

Do not recommend throwing away working functionality without evidence.
