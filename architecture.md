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
- **AI:** Google Gemini today (being refactored to a provider-agnostic layer — see "AI provider layer" below)
- **Testing:** Vitest wired via `npm test` (6 test files); CI runs typecheck, lint, tests, and build (`.github/workflows/ci.yml`)

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
- `src/lib/knowledge/` — **PLANNED** structured legal rules, industry practices, deal-type schemas, versioned with provenance
- `src/lib/deal-types/` — **PLANNED** deal-type registry, module loader, per-deal-type modules
- `src/lib/protection/` — **PLANNED** clause library, template engine, document generator
- `src/lib/lawyer/` — **PLANNED** lawyer workflow, handoff, feedback loop
- `src/lib/execution/` — **PLANNED** obligation tracking, change orders, monitoring
- `supabase/migrations/` — 19 migrations, one Postgres schema, RLS enabled on every table

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

Supabase Auth (email/password), email verification required before a user can run an analysis or generate documents (checked both in the route layer and inside the relevant Server Actions — defense in depth). Every Server Action independently re-fetches the user and validates their UUID rather than trusting a shared context — safe, but means there's no caching layer, so auth checks happen redundantly across components.

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

---

## Extraction & Risk Schema — Generalization Status

The deal-type generalization is partially built:

- **`deal_type` column exists** — migration `00019_add_deal_type.sql` adds `deal_type text not null default 'freelance' check (deal_type in ('freelance', 'generic'))` to the `audits` table.
- **Deal-type-specific extraction prompts exist** — `src/lib/ai/prompts.ts` has `EXTRACTION_SYSTEM_PROMPT` (freelance) and `GENERIC_EXTRACTION_SYSTEM_PROMPT` (generic). `src/lib/ai/extract.ts` selects the prompt based on `dealType`.
- **Generic mode has AI-assisted risk scoring** — `src/lib/ai/risk-analysis.ts` provides `analyzeGenericRiskWithVisibleFailure` which calls the AI with `GENERIC_RISK_ANALYSIS_SYSTEM_PROMPT` and transforms the dynamic category output. No deterministic rule engine exists for generic mode yet — it relies entirely on AI scoring.
- **Freelance deterministic rule engine is complete** — `src/lib/risk/engine.ts` implements the 8 freelance categories (scope, payment, timeline, communication, revision, legal, IP, client behavior) and is used as the fallback when the AI call fails.

**What remains unbuilt:** a deterministic rule engine per deal type (only freelance exists). The generic mode uses AI-only scoring with no rule-engine validation. Sequencing which deal type or generic mode ships first is a product decision under "Open product decisions" in `product.md`.

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

- **New Audit needs a deal-type step.** This is now built — the `DealTypeSelector` component (`src/components/audit/deal-type-selector.tsx`) presents Freelance vs Generic options and is used in `/audit/new`. The intake flow now branches on deal type for extraction and risk analysis.
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

### 4. Knowledge (Planned Layer)
- **Structured Legal Rules** — versioned, jurisdictional, with citations, applicability conditions, effective dates
- **Industry Practices** — prevalence-tagged, jurisdiction-scoped, with commercial implications
- **Deal-Type Schemas** — extraction schemas, risk categories, rule sets, protection templates per deal type
- **Commercial Norms** — industry-specific commercial expectations
- **Versioning & Provenance** — every rule/practice has citation, effective date, version, supersession chain

### 5. Deal Protection
- **Negotiation Intelligence** — AI-generated talking points tied to specific risk findings
- **Clause Library** — deal-type-specific, risk-conditioned clauses
- **Document Template Engine** — proposal/SOW/contract/checklist/amendment/addendum generation
- **Annotated Agreements** — risk flags inline on original agreement
- **Lawyer Handoff Package** — structured package for professional review

### 6. Human Legal / Professional Review (Planned Layer)
- **Structured Handoff Package** — original input + extracted facts + context + risk findings + evidence + uncertainties + user concerns
- **Lawyer Workflow** — review → annotate → advise → return structured opinion
- **Feedback Loop** — lawyer insights → knowledge base / rule refinement
- **Privacy** — user consent, data minimization, lawyer sees only what's needed, TTL on access

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

### 9. Trust & Governance
- Policies as architecture requirements (not just footer links)
- Data governance (retention, deletion, AI provider data sharing, consent)
- Security principles (least privilege, RLS defense in depth, minimal exposure)

---

## Staged / Planned Implementation Phases

| Phase | Focus |
|-------|-------|
| **Current** | Freelance end-to-end + Generic AI-only + Anonymous Quick Review + Lawyer waitlist + Context Resolution foundation (envelope, gate, confirmation UI) |
| **Next** | Lease deal type (deterministic rules) + Knowledge layer v1 (rules DB) + Lawyer workflow |
| **Next** | Founder deal type + Knowledge layer v1 (rules DB) + Context resolution engine |
| **Future** | Employment/Contractor + Partnership + Purchase/Sale + Full lawyer workflow |
| **Future** | Deal Execution (obligations, change orders, monitoring) |
| **Future** | Client intelligence (repeat counterparties) + Relationship history |

---

## Open / Unknown

1. **Knowledge sourcing strategy** — Partner with legal publisher? Build in-house with counsel? Crowdsource from lawyers?
2. **Lawyer compensation model** — Per-consultation? Subscription? Revenue share?
3. **Jurisdiction coverage v1** — Explicit supported jurisdictions list needed
4. **Rule representation** — TypeScript functions + Zod schemas vs JSON AST vs custom DSL?
5. **Dependency vulnerabilities** — High-severity issues across Next.js, PostCSS, sharp, transitive packages
6. **CI/CD pipeline** — No pipeline exists; need `npm test` wired first
7. **Backup & recovery** — No stated RPO/RTO; relying on Supabase automated daily backups
8. **Data retention policy** — No stated policy; need decision before real user data
9. **Payment provider** — Lemon Squeezy vs Stripe vs Paystack — international coverage, MoR, tax/compliance
10. **Professional services payment** — Separate mechanism from software credits?

---

## Currently Observed (High-Level Repository Inspection)

- **Freelance deal type**: Fully implemented end-to-end (intake → extraction → risk analysis → protection package generation → PDF export → e-signing)
- **Generic deal type**: AI-only risk scoring fallback, no deterministic rule engine
- **Landing page**: Anonymous Quick Review with mini-dashboard (paste/upload/describe → `/api/analyze-anonymous`)
- **Authentication**: Supabase Auth (email/password), email verification required
- **Database**: Supabase/Postgres with RLS on all tables, 19 migrations
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