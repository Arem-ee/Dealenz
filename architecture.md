# Dealenz — Architecture

Grounded in the 2026-08-29 codebase audit. Facts here are cited to real files; anything not yet verified in code is marked UNVERIFIED rather than assumed.

This document describes the **target full-product architecture** for Dealenz, distinguishing between what currently exists, what is staged/planned, and what is open/unknown.

---

## Stack

- **Framework:** Next.js 16 (App Router), React 19, TypeScript (strict mode)
- **Styling:** Tailwind CSS v4, custom brand tokens (dark burgundy/oxblood primary via OKLCH, separate risk-severity palette)
- **UI primitives:** Radix UI + lucide-react + class-variance-authority
- **Database & Auth:** Supabase (Postgres + Supabase Auth, via `@supabase/ssr`)
- **Document generation:** `@react-pdf/renderer` for PDF export, `pdf-parse` / `mammoth` for reading uploaded PDFs/DOCX
- **AI:** provider-agnostic layer with three adapters — Gemini, OpenAI-compatible (covers NVIDIA NIM), Anthropic Claude (see "AI provider layer" below)
- **Testing:** Vitest wired via `npm test` (81 test files, 600 tests); CI runs typecheck, lint, tests, and build (`.github/workflows/ci.yml`)

Single Next.js monolith — no separate backend service, no other languages.

---

## Structure

- `src/app/` — routes, using Server Components for data fetching and Server Actions (`"use server"`) for mutations
- `src/components/ui/` — Radix-based primitives
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
- `src/lib/protection/` — protection engine (Phases 26-28): `index.ts` freelance-only generation boundary (`canGenerateDocuments`/`hasProtectionDraftSupport`), `intents.ts` `ProtectionIntent` derived from    authoritative findings (never rediscovering; `protectionIntentsFromFindings`), `clauses.ts` curated founder
   (8) + partnership (8) + purchase_sale (3) + lease (4) + employment (3) clause templates with variables, warnings, and `legalContextIds` (drafting assistance
   vs legal authority; `renderClauseTemplate` preserves `{{var}}` as UNKNOWN; UI filters ids by jurisdiction prefix), `src/components/audit/protection-intents.tsx` priority-grouped UI (What to negotiate / Why it matters / Recommended protection / Evidence / Legal context / Suggested clause)
- `src/lib/legal-research/` — grounded international legal intelligence (Phases 27/30/31): `types.ts` jurisdiction/authority/`VeracityState` (VERIFIED/SUPPORTED/CONFLICTING/STALE/UNVERIFIED/NOT_FOUND/NEEDS_JURISDICTION), `allowlist.ts` Tier 1/2 domains + SSRF/size/timeout guards, `registry.ts` jurisdiction → authority-domain DATA registry (new jurisdictions = entries, never engine changes), `retrieval.ts` live bounded adapter (`createLiveRetrievalAdapter`: HTTPS-only, per-hop allowlist + SSRF re-validation, manual redirects, content-type allowlist text/html+text/plain, streaming byte cap, AbortController timeout, `htmlToText` string-only sanitization, no cookies/credentials/headers; optional Brave search behind `LEGAL_SEARCH_API_KEY`; `getResearchAdapter()` env-gated by `LEGAL_RESEARCH_LIVE=1`, default corpus-only), `validation.ts` provenance + temporal checks, `corpus.ts` Nigeria/US/UK/EU seeds, `research.ts` controlled query-planner → allowlist → retrieval → validation → relevance → citation pipeline (webpage content is DATA; UNKNOWN jurisdiction → NEEDS_JURISDICTION, never guessed; opt-in `revalidate` re-fetches top-2 corpus URLs to confirm currency, passage-gone → STALE; `meta` observability without private contents), `citations.ts` passage-∈-content helpers; Ask grounded via `src/lib/conversation/request.ts` (`shouldInvokeResearch` + live-or-corpus research, `legalCitations`/`researchState` in response, same operation cost — no separate research charge) and `src/components/ask/ask-client.tsx` Legal sources UI
- `src/lib/verticals/tier.ts` — business-owner priority tiers (1=founder/partnership, 2=purchase_sale/lease/employment, 3=freelance, 4=generic)
- `src/lib/lawyer/` — **PLANNED** lawyer workflow, handoff, feedback loop
- `src/lib/execution/` — **PLANNED** obligation tracking, change orders, monitoring
- `supabase/migrations/` — 35 forward migrations (`00001`–`00035`) plus 3 unapplied `20260903*` drafts, one Postgres schema, RLS enabled on every table

---

## Known Naming Risk

Route/session guarding lives in `src/proxy.ts`, not the Next.js-conventional `middleware.ts`. Next.js 16 detects and runs `src/proxy.ts` as middleware by filename convention — the build output shows `ƒ Proxy (Middleware)` and live testing confirms it runs: `GET /dashboard` unauthenticated returns a 307 redirect to `/login`, and `GET /login` unauthenticated returns 200. The proxy middleware runs in dev mode; verify it also runs in your production deployment before relying on it for security.

---

## Data Model (Supabase / Postgres)

### Core Tables (Currently Existing)

- `audits` — the deal itself (raw input, structured extraction, risk report, overall score, lock state, `deal_type`)
- `client_profiles` — per-user client list
- `checklist_items` — deliverables checklist items
- `business_profiles` — user's business info for document generation
- `document_versions` — proposal/SOW/contract/checklist, versioned, AI-or-template generation method recorded
- `share_tokens` + `document_signatures` — client-facing sharing and e-signing
- `usage_tracking` — daily rate-limit counters
- `system_logs` — phase/status/duration for key operations
- `activity_events` — audit trail of user actions

### Tables Added by Migration 00020 (Lawyers & Consultations)

- `lawyers` — lawyer profiles with `verification_status` (pending/verified/rejected), bar license, specialties, years experience
- `consultation_requests` — consultation requests with `status` enum (requested, matched, in_progress, completed, cancelled, waitlist)

All tables have Row Level Security enabled, scoped to `auth.uid()`. Two RPCs (`get_shared_document`, `sign_shared_document`) are `SECURITY DEFINER` with `EXECUTE` granted to `anon` — intentional, since the public client-facing share/sign flow needs to work without an authenticated session. This is a sound pattern as long as those two RPCs stay tightly scoped.

---

## Auth Flow

Supabase Auth (email/password + Google OAuth), email verification required before a user can run an analysis or generate documents (checked both in the route layer and inside the relevant Server Actions — defense in depth). Every Server Action independently re-fetches the user and validates their UUID rather than trusting a shared context — safe, but means there's no caching layer, so auth checks happen redundantly across components.

Identity model: one human maps to one canonical `auth.users.id`, with email/password and Google as identities on that row — never two Dealenz accounts for one person. Google is attached only through the explicit authenticated `linkIdentity` flow in settings (verified provider email required, pre/post user id must match); the application never merges accounts by comparing email strings, rewrites `user_id`, or deletes duplicates. Referral attribution, audits, credits, and conversations all key to the canonical `auth.users.id`, so linking preserves them unchanged.

---

## Request Flow (High Level)

```
User → Dealenz Web (landing/auth/dashboard/audit workspace)
     → Server Actions (authenticated operations: create audit, save
       input, upload files, run analysis, generate documents)
     → Domain/AI layer (text extraction, AI extraction, deterministic
       risk engine, document generation)
     → Supabase (auth, Postgres, RLS, storage, usage tracking, logs)
```

The Domain/AI layer is the important seam: AI extraction produces structured deal data, and a separate deterministic rule engine scores risk against that data. The AI does not assign risk scores directly — see `product.md` for why this separation is a deliberate product decision, not just an implementation detail. Keep this seam intact when refactoring the AI provider layer below; swapping providers should never mean letting a provider's model output become the risk score directly.

---

## AI Provider Layer

**Current state:** provider-agnostic interface (`callAI({ systemPrompt, userContent, temperature, maxTokens })`) with three adapters — Gemini (`src/lib/ai/providers/gemini.ts`), OpenAI-compatible (`src/lib/ai/providers/openai-compatible.ts`, covers NVIDIA NIM), and Anthropic Claude (`src/lib/ai/providers/anthropic.ts`, genuine Messages API contract: `POST /v1/messages`, `x-api-key` plus `anthropic-version` headers, text extracted from response content blocks).

**Surface split (Phase 5A):** authenticated Deal Intelligence resolves via centralized `resolveSurfaceConfig("authenticated")` (`src/lib/ai/providers.ts`) to Claude Sonnet 5 (`AUTH_AI_MODEL`, default `claude-sonnet-5`) with a Claude Opus 5 fallback (`AUTH_AI_FALLBACK_MODEL`, default `claude-opus-5`) on retryable failure categories only (timeout, network, rate limit, provider, malformed response). Auth, config, and invalid-request failures never fall back. The anonymous Quick Review resolves via `resolveSurfaceConfig("quick_review")` to the legacy shared-env selection unless `QUICK_REVIEW_AI_PROVIDER` / `QUICK_REVIEW_AI_MODEL` pin it elsewhere, and never touches the authenticated models. Domain functions (`extract`, `risk-analysis`, `negotiation`, `generate`) take an explicit surface parameter defaulting to authenticated; only `src/app/api/analyze-anonymous/route.ts` passes `quick_review`.

**Failure model:** `AIProviderError` with categories config, auth, invalid_request, malformed_response, timeout, network, rate_limit, provider (`src/lib/ai/errors.ts`). Fallback metadata (primary attempted, failure category, fallback attempted and result) is logged metadata-only and surfaced through the existing `usedFallback` flag; provider diagnostics never reach users (anonymous paths keep the fixed safe-error string).

**Reason for this:** currently running on a budget key from a non-Gemini provider, with intent to serve authenticated intelligence from Claude once an Anthropic key is configured. Adapter swaps remain config changes, not rewrites.

**Response handling:** JSON extraction is provider-agnostic already — strips code fences, falls back to slicing the first `{…}` block, then coerces fields with defaults. This should keep working across providers, though non-Gemini models may follow the JSON-output instruction less reliably and exercise the fallback path more often — worth testing before trusting it for anything client-facing.

**Token usage:** adapters return measured usage where the provider reports it (Anthropic `usage`, Gemini `usageMetadata`, OpenAI-compatible `usage`), threaded into `SurfaceCallMeta.usage` (`src/lib/ai/providers.ts`). Absent usage stays absent, never zeroed. No adapter fabricates counts.

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

- **Response constitution** (`src/lib/ai/constitution.ts`): the durable behavior contract. Dealenz works for the user, never for closing the deal; facts, assumptions, and uncertainty stay separated; unknown never becomes false; plain complete sentences; em dashes banned from user-facing output (tested); concise by default and as detailed as the task requires; no sycophancy; no commercial bias. Structured machine-read prompts are excluded from the prose contract; user-facing prompts (today: negotiation points) receive it via `applyConstitution`.
- **Credit economy:** `Ask` conversations consume credits through one accounting boundary (`src/lib/credits/policy.ts:41` `authorize→reserve→finalize/void`, `pricing.ts:19` `1/3/8` flat per-operation, `STANDARD_CREDIT_POLICY`). `AIUsageRecord` (`src/lib/ai/usage.ts`) represents operation, provider, model, measured tokens, credit charge, outcome; tokens never derive credits. Balances live in append-mostly `credit_ledger` (`00023`) with advisory-locked `reserve_credits` idempotent on `(user_id,idempotency_key)`. **Authenticated `analyzeDeal`/`generateProtectionPackage` are currently free and rate-limited `5/day` / `10/day` via atomic `increment_usage` (`00018`) `usage_tracking` — not billed through `credit_ledger`. This is intentional for the release candidate: core analysis is free, Ask is metered. `usage_tracking` remains the abuse rate-limit, `credit_ledger` remains the Ask economy; no double system.
- **Verticals and conversation (Phases 5E-6, 13-14, persisted in 10):** verticals plug into the same pipeline through a dispatcher (`src/lib/verticals/index.ts`, resolved by deal type): freelance/service deals (`src/lib/verticals/freelance/`, 9-rule pack), lease deals (`src/lib/verticals/lease/`, 9-rule pack), purchase/sale deals (`src/lib/verticals/purchase_sale/`, 8-rule pack, migration `00029`), employment deals (`src/lib/verticals/employment/`, 8-rule pack, migration `00030`), founder deals (`src/lib/verticals/founder/`, 8-rule pack, migration `00032`), and partnership deals (`src/lib/verticals/partnership/`, 8-rule pack, migration `00034`), each with deterministic fact projection from extraction output, a scoped rule pack evaluated in `analyzeDeal` and conversation, and knowledge filtering over shared resolver candidates. Shared observation helpers live in `src/lib/verticals/observe.ts`. Conversation is a backend request pipeline (`src/lib/conversation/request.ts`): question to operation to context to knowledge to rules to synthesis to usage to accounting, with document-free, document-required, and mixed flows. Greetings take a deterministic fast-path (no AI call, no ledger interaction). Lease, purchase/sale, employment, founder, and partnership audits persist their `deal_type` (`00027`/`00029`/`00030`/`00032`/`00034`); each non-freelance analysis uses the adaptive generic AI path plus its deterministic vertical rules, never the freelance 8-category engine. **Vertical knowledge:** founder/partnership keys are populated (Nigeria CAMA/CAC, migration `00035`); Tier 2 keys are populated by migration `00038` — `PURCHASE_SALE_KNOWLEDGE_KEYS` (6: US/UK/EU/DE/FR/NL sale sources), `LEASE_KNOWLEDGE_KEYS` (5: US-CA/UK/DE/FR/NL tenancy sources), `EMPLOYMENT_KNOWLEDGE_KEYS` (5: US/UK/DE/FR/NL employment sources); shared resolver still applies (global/unconstrained items), rules are `product_policy` only, and evidence `exact` is emitted only for `raw_input` matches from an inspectable `audit_input` per `observe.ts:192-230`. Since Phase 10, Ask persists per-user conversations and messages (`conversations` + `conversation_messages`, migration `00028`, RLS owned) with server-truncated bounded history and re-validated audit attachment.
- **Product surface and economy (Phases 5G + 10):** the Ask experience (`src/app/ask/`, `src/components/ask/`) puts the conversation pipeline behind an authenticated page with optional audit attachment, bounded caller history (server-truncated), per-answer credit display, conversation list/history, and findings/sources rendering. Pricing is explicit and provisional (`STANDARD_CREDIT_POLICY`: brief 1, standard 3, extended 8 credits per operation; flat per-operation charges, never token-derived). Estimated cost is shown before computation (0 for greetings, otherwise tier price) and every turn is authorized/reserved before the provider call. The first production corpus (migration `00026`, three web-verified freelance items) seeds published knowledge with real provenance.
- **Evidence mapping (Phases 7–9):** every affirmative vertical observation carries validated `Evidence` references (`src/lib/evidence/schema.ts`: source type, source id/version, exact/approximate/unavailable location, quote, observation key, method, bounded confidence, inspectable flag; deterministic content-derived ids). **Exact offsets are proven only for `raw_input` matches from an inspectable audit** (`src/lib/verticals/observe.ts`): the match index inside the verbatim pasted input yields `exact` offsets that verify at display time against the same `raw_input` text; every other section, non-inspectable source, or extraction-derived fact stays `approximate` or `unavailable` — offsets are never manufactured. After evaluation, `attachEvidence` (`src/lib/evidence/collect.ts`) walks each fired rule's condition and gathers the evidence behind the facts and knowledge it actually read; PASS/UNKNOWN results carry none. Findings embed their evidence (`Finding.evidence`), which flows through selection into the Ask UI's compact source lines and the workspace `FindingsPanel` (persisted findings with Inspect-source actions backed by the ownership-checked `src/app/audit/[id]/evidence-actions.ts` action and the `src/lib/evidence/inspect.ts` verifier). Synthesis inputs never truncate silently: negotiation receives the full FAIL set with an explicit bound, and conversation prompts state the focused/total finding counts when intent filtering narrows the set. Knowledge provenance is bridged by reference, never duplicated. No evidence table exists: evidence travels embedded in facts and findings and is never persisted beyond the existing audit payloads.

**Product principle:** Dealenz optimizes for useful intelligence, not maximum token consumption. Credits authorize computation, not influence over substantive answers.

Credits determine access to computation. Credits do not determine conclusions.

*Phase 5F live verification (linked Supabase project): migrations 00021 through 00025 applied; RLS probed live as anonymous, authenticated non-admin, and admin-metadata subjects (published-only for the first two, drafts visible to admins, non-admin writes denied); credit RPCs exercised live (reserve allow/deny, idempotent replay, finalize math, void release, admin grant gate both directions); all probe data removed afterwards. True-simultaneous concurrency, live provider calls, and remote CI remain unverified in this environment.*

---

## Extraction & Risk Schema — Generalization Status

The deal-type generalization is partially built:

- **`deal_type` column exists** — migration `00019_add_deal_type.sql` adds `deal_type` to the `audits` table; the check constraint now allows `freelance, generic, lease, purchase_sale, employment, founder, partnership` (extended forward-only by `00027`, `00029`, `00030`, `00032`, `00034`).
- **Deal-type-specific extraction prompts exist** — `src/lib/ai/prompts.ts` has `EXTRACTION_SYSTEM_PROMPT` (freelance) and `GENERIC_EXTRACTION_SYSTEM_PROMPT` (generic). `src/lib/ai/extract.ts` selects the prompt based on `dealType`.
- **Generic mode has deterministic authority** — `src/lib/verticals/generic/` provides 7 deterministic rules plus `bucketForGenericFindings`; `analyzeDeal` overrides AI headline scores with the deterministic bucket (AI summary/recommendations kept). `src/lib/ai/risk-analysis.ts` still provides `analyzeGenericRiskWithVisibleFailure` for AI themes and anonymous Quick Review.
- **Freelance deterministic rule engine is complete** — `src/lib/risk/engine.ts` implements the 8 freelance categories (scope, payment, timeline, communication, revision, legal, IP, client behavior) and is used as the fallback when the AI call fails.

**Current state:** every deal type has a deterministic rule pack (freelance 9 + 8-category engine, lease 9, purchase_sale 8, employment 8, generic 7, founder 8, partnership 8). Non-freelance analyses use adaptive generic AI themes plus a deterministic floor (`deterministicRiskFloor` in `src/lib/rules/result.ts`): an AI Low can never hide a deterministic FAIL, while an AI High with no FAIL is preserved as advisory. Freelance headline scoring remains AI-primary with the deterministic engine as fallback.

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
| `AI_PROVIDER` | Selects the AI adapter (`gemini` or `openai_compatible`) |
| `AI_API_KEY` | Key for the active provider |
| `AI_BASE_URL` | Endpoint for the active provider |
| `AI_MODEL` | Model name for the active provider |
| `ANTHROPIC_API_KEY` | Key for Claude authenticated calls (server-only, never committed) |
| `AUTH_AI_PROVIDER` | Adapter for authenticated calls (`anthropic` default; `gemini` or `openai_compatible` supported without cross-model fallback) |
| `AUTH_AI_MODEL` | Authenticated primary model (default `claude-sonnet-5`) |
| `AUTH_AI_FALLBACK_MODEL` | Authenticated fallback model (default `claude-opus-5`) |
| `QUICK_REVIEW_AI_PROVIDER` | Optional independent provider for anonymous Quick Review (unset = legacy shared selection) |
| `QUICK_REVIEW_AI_MODEL` | Optional independent model for anonymous Quick Review |
| `ANTHROPIC_BASE_URL` | Optional Anthropic endpoint override (default `https://api.anthropic.com`) |
| `NEXT_PUBLIC_APP_URL` | Base URL used in generated share links |

---

## File Upload & Storage

Uploaded deal files (briefs, PDFs, DOCX) go to the `audit-files` Supabase Storage bucket. Limits: 10MB per request body, 10MB per file, 10 files per audit. Storage RLS policies scope access by folder name matching `auth.uid()`, so a user can only reach their own uploaded files even though the bucket itself isn't fully private. Extraction reads these files server-side via `pdf-parse` / `mammoth` before AI extraction runs.

---

## Rate Limiting

Enforced via the `usage_tracking` table (unique per user/action-type/day) and an `increment_usage` RPC that checks the count before incrementing, not after — this was previously a bug (unconditional increment) and is now fixed. Limits: 5 deal analyses and 10 protection-package generations per user per day. This is a cost control on AI spend, not a monetization gate yet — there's no paid tier that raises these limits.

Anonymous Quick Review uses a separate in-memory IP+fingerprint map (`anonymousRateLimits`), 3 requests per hour per anonymous identity. Distinct from the authenticated `usage_tracking` system.

---

## Security

Consolidated from what the audit verified plus standard practice for a SaaS handling other people's client/deal data.

**Authentication** — Supabase Auth (email/password), session refresh handled per-request. Email verification is required before a user can run analysis or generate documents, enforced at both the route layer and inside individual Server Actions (defense in depth, not a single point of failure). No 2FA currently — reasonable to defer at this stage, worth adding once there's real money or contracts flowing through signed documents.

**Authorization** — Row Level Security on every table, scoped to `auth.uid()`. This is the primary authorization mechanism, not application-layer checks — meaning even a bug in a Server Action can't leak another user's data, because the database itself refuses the query. Two RPCs are `SECURITY DEFINER` with public (`anon`) execute grants, intentionally, to support the unauthenticated client-facing share/sign flow — any new `SECURITY DEFINER` function needs the same scrutiny: default to RLS, only bypass it when there's a specific, narrow, justified reason.

**Secrets management** — all keys via environment variables, never hardcoded. `.env*` is gitignored. `NEXT_PUBLIC_*` vars are intentionally public (safe because RLS enforces actual access); anything without that prefix is server-only. Standard practice worth adopting as the team or surface area grows: rotate keys on a schedule, use a secrets manager (Vercel env vars are fine at this stage) rather than passing `.env` files around manually.

**Input validation** — Server Actions whitelist allowed fields and status values rather than trusting arbitrary input. File uploads are checked for type and size before processing. Worth confirming: whether markdown rendered from AI output or user input goes through XSS sanitization before display — this wasn't confirmed in the last audit and is worth a direct check, since generated documents and shared client-facing pages are exactly where stored XSS would matter most.

**Transport & headers** — CSP is configured (`next.config.ts`), allowing the AI provider's domain and otherwise fairly locked down, though `unsafe-inline`/`unsafe-eval` are currently permitted for scripts — a common Next.js default but worth tightening once you know exactly what needs inline scripts. **Note:** The CSP `connect-src` only restricts browser-side requests. All AI provider calls (`callGeminiProvider`, `callOpenAICompatible`) run server-side in Server Actions (`src/app/audit/[id]/actions.ts`, `src/app/audit/new/actions.ts`) and the anonymous API route (`src/app/api/analyze-anonymous/route.ts`), so they are not subject to the browser CSP. No CSP change is needed when switching providers. HTTPS is assumed via hosting platform, not something this app configures itself.

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

No stated targets exist beyond "works for a handful of freelancers," which is the audit's own framing of current readiness. Not worth inventing artificial SLAs at this stage — but worth writing down once there's a real answer, since "no target" quietly becomes "no one notices when it's slow" otherwise.

---

## Technical Debt & Known Issues

- **State sprawl:** the deal workspace component holds 14+ `useState`, 5 `useRef`, 5 `useEffect` in one file. Works, but any new feature touching intake/analysis/generation risks conflicting with existing state transitions.
- **No pagination:** dashboard/deals/risk-intelligence pages use fixed `limit()` calls with no cursor. Fine at current scale, will need addressing before real usage volume.
- **Search is a full table scan:** `ILIKE` on title only, no index. Same scale caveat as above.
- **No background jobs:** document generation is synchronous inside a Server Action — 4 sequential AI calls per protection package, each with its own timeout. Long-tail latency risk as usage grows; will eventually need a queue.
- **Tests wired to CI:** `npm test` runs 6 Vitest files and `.github/workflows/ci.yml` gates typecheck, lint, tests, and build on every push.
- **Dependency vulnerabilities:** several high-severity issues across Next.js, PostCSS, sharp, and a few transitive packages as of the last audit — needs a patch pass, ideally on a branch with a full build+typecheck before merging (some fixes bump Next outside the currently declared version range).

---

## UX / UI

### Design Principles (Stated, Apply Across the Product)

- Light/white backgrounds for the core app (consumer-facing product); dark editorial styling reserved for the personal-brand/landing context only.
- **Font:** Mona Sans Variable via `@fontsource-variable/mona-sans` (self-hosted variable font). System font stack is no longer used.
- Reject AI-sounding copy and generic SaaS design defaults throughout — this applies to UI copy, empty states, and error messages, not just marketing pages.
- No em dashes anywhere in shipped copy.
- Dark burgundy/oxblood as the core brand primary color, with a distinct risk-severity palette (separate from brand color) so risk levels stay legible and don't fight the brand color for attention.

### Information Architecture (As Built Today)

```
Landing (marketing, acquisition layer — see product.md)
  → Auth (login / register / email verification)
    → Dashboard (Needs Attention, Risk Alerts, In Progress, Recent Activity)
      → New Audit (deal type selection — BUILT: DealTypeSelector component)
        → Audit Workspace
            Intake (paste / upload / guided form)
            → Analyze (extraction + risk scoring, processing state)
            → Risk Report (category breakdown, findings, severity)
            → Protection Package (proposal/SOW/contract/checklist tabs,
              PDF export, share/sign) — freelance deal type only today
      → Deals (list, search)
      → Clients (list, detail — currently stubbed/preview)
      → Templates (12 vetted templates, filterable)
      → Risk Intelligence (personal risk activity + static risk library)
      → Settings / Billing (billing currently stub-only)
  → Client-facing (unauthenticated): shared document view → sign
```

### Landing Page Redesign

The landing page has been rebuilt with a light theme (`#F2F0ED` page background, `#FDFBF9` card), extreme glassmorphism (`glass-extreme` at 40% white / 40px blur, `glass-extreme-panel` at 40% white / 40px blur with stronger border/shadow), asymmetric hero with rotated glass cards, trust marquee inside the main card, and a full-width mini-dashboard section outside the card. Mona Sans Variable font throughout.

### Anonymous Analyze API & Landing Mini-Dashboard

`src/app/api/analyze-anonymous/route.ts` — unauthenticated POST endpoint used by the landing page mini-dashboard. Accepts `prompt` (text), `dealType` ("freelance" or "generic"), and optional file uploads (PDF, DOCX, TXT up to 10MB). Runs extraction and risk analysis for the selected deal type, returns the full risk report directly without creating an audit row or requiring authentication.

**Rate limiting** — separate in-memory IP+fingerprint map (`anonymousRateLimits`), 3 requests per hour per anonymous identity. Distinct from the authenticated `usage_tracking` system (5 analyses / 10 packages per user per day).

`src/components/landing/landing-mini-dashboard.tsx` — full-width section below the main landing card. Presents paste/upload/describe input UI, calls `/api/analyze-anonymous`, displays the resulting risk report inline (score gauge, category cards, findings, recommendations). Includes "Save & Get Full Report" CTA linking to `/register`.

### What Changes for the Broader Audience

- **New Audit needs a deal-type step.** This is now built — the `DealTypeSelector` component (`src/components/audit/deal-type-selector.tsx`) presents Freelance, Purchase/Sale, Employment, Founder, Partnership, Lease, and Generic options and is used in `/audit/new`. The intake flow now branches on deal type for extraction and risk analysis.
- **"Client" language needs to become conditional or generic.** The dashboard, workspace, and document generation all say "client" throughout. For a lease audit, there's a landlord, not a client. Two options: genericize to a neutral term like "counterparty" everywhere (simpler, but loses some of the freelance flow's specificity), or keep deal-type-specific vocabulary that swaps based on the selected deal type (more work, better feel). This is a real UX decision, not just a find-and-replace — recommend deciding after the first non-freelance deal type is scoped, so there's a concrete second vocabulary to design against instead of guessing.
- **Protection Package needs a non-generation mode.** For deal types where the user is reviewing something they received (a lease, an offer) rather than sending something they wrote, the equivalent screen should show risk-annotated terms and negotiation points, not a proposal/SOW/contract generator. This is a distinct UI, not a relabel of the existing tabs.
- **Templates library** should eventually filter or group by deal type once more than one exists; today all 12 are freelance-oriented.
- **Risk Intelligence's static library** (9 patterns) is freelance-specific content and will need parallel content per deal type, or a reframed "risk library" that's deal-type-aware from the start rather than freelance content with other categories bolted on.

### States Worth Designing Deliberately (Not Yet All Handled)

- **Empty states** — new user with no deals yet; a deal type with no matching template or risk ruleset (the generic fallback case).
- **AI degraded state** — when the AI call fails and the product falls back to the rule engine/templates, does the user know their result is lower-confidence? Today this fails silently (see the earlier Gemini key mismatch incident) — worth surfacing this in the UI, not just logging it server-side, especially as more deal types lean harder on AI-assisted scoring where no rule engine exists yet.
- **Deal-type-not-yet-supported state** — when generalization ships in phases, some deal types will exist as options before their risk engine is fully built. Decide upfront whether to hide unsupported types, show them as "coming soon," or route them into the generic fallback silently — this is a real product decision, not a UI afterthought.

---

## Target Full-Product Architecture (Planned Layers)

The following layers represent the **target full-product architecture**. Not all layers are implemented; see "Staged / Planned" below.

### 1. Acquisition
- Landing page, Quick Review, conversion funnel
- Anonymous Quick Review (anonymous analyze API + mini-dashboard)
- Conversion to authenticated workspace

### 2. Identity & Account
- Supabase Auth (email/password, email verification)
- Team accounts, roles, invitations
- Profile, preferences, notification settings

### 3. Deal Intelligence
- **Context Resolution** — explicit context envelope (jurisdiction, governing law, party roles, industry, transaction structure, value, stage) with inference + user confirmation
- **Extraction** — deal-type-aware AI extraction with evidence mapping (source spans)
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
- **Document generation** — freelance-only via `src/lib/generate.ts` (proposal/SOW/contract/checklist with AI + template fallback). Boundary is `src/lib/protection/index.ts:canGenerateDocuments` +
`hasProtectionDraftSupport` (founder/partnership/purchase_sale/lease/employment draft support; families `purchase-terms-sheet`, `lease-terms-summary`, `employment-terms-summary` via `generateBusinessOwnerDraft`) — single source for server (`generateProtectionPackage`) and workspace UI. Workspace Protection renders as `What to negotiate` (FindingsPanel + NegotiationPointsView + ProtectionIntentsView for founder/partnership/Tier 2) / `Documents` (freelance generation or honest coming-soon) so intelligence is not coupled to generation. Provenance chain `deal → facts → findings → intents → clauses → legal research` is traceable; lawyer-handoff payload can consume `dealType, jurisdiction, facts, findings, evidence, risk, intents, citations, missingInfo`.
- **Annotated Agreements** — planned.

### 6. Human Legal / Professional Review (Founder/Partnership handoff now usable)
- **Structured Handoff Package** — `src/lib/consultation/handoff.ts` `HandoffPackage` (`deal, facts, findings, risk, protectionIntents, clauses, documentDraft, legalCitations, evidence, missingInformation, generatedAt`) built from authoritative pipeline (`buildHandoffPackage`), validated (`validateHandoffPackage` — no invented PASS→FAIL, no cross-vertical clause leak, no Nigerian leak into UK/US), jurisdiction explicit (`UNKNOWN` surfaced), `handoff_snapshot` JSONB `00036` (forward-only, RLS via row, capped 100kb, fallback without snapshot if column missing)
- **Consultation Request** — `src/app/audit/[id]/consultation-actions.ts:createConsultationRequest(auditId, note, handoffSnapshot?)` reuses auth/ownership/duplicate-pending/verified-lawyers→`requested` else `waitlist`, stores `handoff_snapshot` (or retries without), honest availability
- **Workspace** — Founder/Partnership `Protection` → `BusinessOwnerDocumentSection` → CTA `Have a lawyer review this deal` (`ShieldCheck`) → `LawyerHandoffReview` panel (Deal, Key issues, Protection, Evidence/legal context, Document, Missing as UNKNOWN, “Drafting assistance” notice, note, Submit) → `consultation_requests` with snapshot; Freelance still uses `LawyerEscalationCard` isolated
- **Review workflow (Phase 5)** — `consultation_status` extended (`accepted`, `changes_requested`, `client_review`); single server-side state machine (`src/lib/review/transitions.ts`); admin assignment, lawyer accept/decline/begin/propose/complete, owner respond/cancel; structured `review_comments` (finding/clause/fact/evidence/document/question targets, lawyer vs client provenance); lawyer revisions append `document_versions` (`lawyer_revision`) via narrow RPC; multi-party `document_signers` bound to exact versions with token-gated invitee signing (`get_signer_view`/`sign_as_invitee`/`decline_as_invitee`), execution derived (all signed); `service_orders` money boundary (no ledger linkage, no Paystack yet); lawyer workspace at `/lawyer/reviews`, client `ReviewPanel` in the workspace, activity_events trail throughout; lawyer reads flow through the scoped `get_lawyer_review_bundle` RPC (audits/document RLS stay owner-only)
- **Feedback Loop / Privacy** — still planned (lawyer insights → knowledge, TTL)

### 7. Deal Execution (Future Layer)
- Obligation tracking (milestones, payments, deliverables, deadlines)
- Change order management (scope creep detection, change orders, amendments)
- Post-signature monitoring (scope creep alerts, deadline reminders, renewal tracking)
- Relationship intelligence (counterparty risk patterns across deals)

### 8. Commerce
- **Credit-based** — usage-based credits, not feature-gated tiers
- **Provider-agnostic billing** — adapter pattern for payment providers
- **Software vs Professional Services separation** — different commercial/payment mechanisms
- **Credit ledger** — purchases, consumption, refunds, auditability
- **Minimal international credit purchase (Phase 29/31)** — `src/lib/billing/catalog.ts` provider-independent packages (starter 50 / standard 150 / pro 400 credits; USD/GBP/EUR minor units; no NGN), `src/lib/billing/provider.ts` Paddle Billing adapter isolated behind `ProviderAdapter` (`@paddle/paddle-node-sdk`, transaction-driven checkout, custom_data for user binding), server-authoritative `POST /api/billing/checkout` (auth, catalog lookup, throttle, safe return URLs), verified `POST /api/billing/webhook` (Paddle-Signature HMAC, `transaction.completed`/`transaction.paid` events, price→package resolution, amount floor/currency match, non-succeeded never credits, refunds observed without mutation), idempotent `credit_purchases` (`00037`, unique provider+tx; `00043` admits `lemonsqueezy` historically, `00051` adds `paddle`; Stripe rows preserved as history) + ledger `purchase:<tx>` idempotency key, allocation via existing `credit_ledger` grant (no second ledger), billing UI balance + packages + purchase history + processing-state honesty

### 9. Trust & Governance
- Policies as architecture requirements (not just footer links)
- Data governance (retention, deletion, AI provider data sharing, consent)
- Security principles (least privilege, RLS defense in depth, minimal exposure)

---

## Staged / Planned Implementation Phases

| Phase | Focus |
|-------|-------|
| **Current** | **Founder/Partnership Tier 1:** 8 rules each + Nigeria CAMA/CAC legal corpus (`00035`, `FOUNDER_KNOWLEDGE_KEYS`/`PARTNERSHIP_KNOWLEDGE_KEYS` populated, `NIGERIA_LEGAL_CORPUS`) + grounded Ask (`shouldInvokeResearch` → `performResearch` → `VERIFIED/SUPPORTED/CONFLICTING/STALE/UNVERIFIED/NOT_FOUND` + citations) + DealTypeSelector founder/partnership-first (`src/lib/verticals/tier.ts`) + Protection engine (`ProtectionIntent` per FAIL + curated Founder 8/Partnership 8 clause library with `{{var}}` UNKNOWN, `renderClauseTemplate`, `protectionIntentsFromFindings`) + **International document generation** (`src/lib/documents` families `founder-agreement`/`llp-agreement` etc., `assembleDraft` jurisdiction-aware `Nigeria`/`Testland` neutral, `generateBusinessOwnerDraft` server action with `canGenerateDocuments`/`hasProtectionDraftSupport` boundaries, `BusinessOwnerDocumentSection` UI) + **Lawyer handoff** (`src/lib/consultation/handoff.ts` `HandoffPackage` from authoritative intelligence, `00036` `handoff_snapshot` JSONB, `LawyerHandoffReview` CTA + review panel, jurisdiction UNKNOWN surfaced, evidence/legal provenance preserved) + Lease/Purchase/Employment Tier 2 + Freelance Tier 3 (existing `src/lib/generate.ts` preserved, isolated) + Generic Tier 4 + Google linking + Referral MVP + Anonymous Quick Review + Context/Knowledge/Evidence/Conversation/Credits |
| **Next** | Nigeria legal corpus expansion (contract, employment, property, IP, NDPA/NDPC, tax, CAC/SEC/FIRS/CBN/NITDA sources) + partnership structure-aware clause variants + execution-aware templates |
| **Future** | Execution/monitoring + background jobs + execution-aware protection templates |
| **Future** | Deal Execution (obligations, change orders, monitoring) |
| **Future** | Client intelligence (repeat counterparties) + Relationship history |

---

## Open / Unknown

1. **Knowledge sourcing strategy** — Partner with legal publisher? Build in-house with counsel? Crowdsource from lawyers?
2. **Lawyer compensation model** — Per-consultation? Subscription? Revenue share?
3. **Jurisdiction coverage v1** — Explicit supported jurisdictions list needed
4. **Rule representation** — TypeScript functions + Zod schemas vs JSON AST vs custom DSL?
5. **Dependency vulnerabilities** — High-severity issues across Next.js, PostCSS, sharp, transitive packages
6. **CI/CD pipeline** — `.github/workflows/ci.yml` runs typecheck/lint/test/build; no deployment job yet
7. **Backup & recovery** — No stated RPO/RTO; relying on Supabase automated daily backups
8. **Data retention policy** — No stated policy; need decision before real user data
9. **Payment provider economics** — Lemon Squeezy is implemented (Merchant of Record; `credit_purchases` admits historical Stripe rows, production writes Lemon Squeezy); remaining question is payout availability, not provider selection
10. **Professional services payment** — Separate mechanism from software credits?

---

## Currently Observed (High-Level Repository Inspection)

- **Freelance deal type**: Fully implemented end-to-end (intake → extraction → risk analysis → protection intelligence + protection package generation → PDF export → e-signing)
- **Lease/Purchase/Employment/Founder/Partnership deal types**: deterministic protection intelligence (findings + negotiation points where applicable) plus jurisdiction-aware protection intents, suggested clauses, term-sheet drafting (`purchase-terms-sheet`, `lease-terms-summary`, `employment-terms-summary`), and lawyer handoff; **Generic**: findings + negotiation points, drafting honestly unavailable
- **Freelance deal type**: fully implemented end-to-end as before (proposal/SOW/contract/checklist generation stays freelance-only via `canGenerateDocuments`)
- **Referral MVP**: `referral_codes` + `referral_attributions` (00033), reward via credit ledger (provisional amount, pending sign-off)
- **Google account linking**: explicit `linkIdentity` flow in settings with verified-email check and allowlisted callback
- **Landing page**: Anonymous Quick Review with mini-dashboard (paste/upload/describe → `/api/analyze-anonymous`)
- **Authentication**: Supabase Auth (email/password + Google OAuth), email verification required
- **Database**: Supabase/Postgres with RLS on all tables, 34 forward migrations
- **AI Provider Layer**: Provider-agnostic interface (`callAI`) with Gemini, OpenAI-compatible, and Anthropic Claude adapters; authenticated surface on Sonnet 5 with Opus 5 fallback, Quick Review on the independent cheaper path
- **Risk Engine**: 8 freelance categories (scope, payment, timeline, communication, revision, legal, IP, client behavior) with deterministic rules + AI fallback
- **Document Generation**: Proposal → SOW → Contract → Checklist (sequential AI calls with template fallback)
- **Lawyer Escalation**: Waitlist-based consultation requests with admin verification UI
- **Anonymous Analyze API**: `/api/analyze-anonymous` with IP+fingerprint rate limiting (3/hr)
- **Landing Mini-Dashboard**: Paste/upload/describe → inline risk report
- **Design System**: Mona Sans Variable, light theme (`#F2F0ED`/`#FDFBF9`), extreme glassmorphism (`glass-extreme` 40% white/40px blur)
- **Auth Flow**: Supabase Auth + `src/proxy.ts` as middleware (detected by Next.js 16 by filename convention)

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
4. **Lawyer compensation model**: Per-consultation? Subscription? Revenue share?
5. **Jurisdiction coverage v1**: US (CA, NY, DE) + UK only? Or accept global with "limited coverage" disclaimer? *Recommend: explicit supported jurisdictions list*
6. **Context confirmation UX**: How many fields before user fatigue? *Recommend: progressive — required first, recommended inline, optional collapsible*
7. **Rule representation**: TypeScript functions + Zod schemas vs JSON AST vs custom DSL? *Recommend: TypeScript functions with Zod schemas for now; DSL if rule count > 100*
8. **AI provider lock-in**: Current abstraction handles Gemini + OpenAI-compatible. Sufficient? *Yes for now; add Anthropic when needed*
9. **Client intelligence (repeat counterparties)**: Build now or later? *Later — need volume first*
10. **Post-signature monitoring**: Build hooks now (event log) or full module later? *Build event log hooks now; execution module later*

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