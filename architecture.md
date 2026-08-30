# Dealenz — Architecture

Grounded in the 2026-08-29 codebase audit. Facts here are cited to real
files; anything not yet verified in code is marked UNVERIFIED rather than
assumed.

## Stack
- **Framework:** Next.js 16 (App Router), React 19, TypeScript (strict
  mode)
- **Styling:** Tailwind CSS v4, custom brand tokens (dark burgundy/oxblood
  primary via OKLCH, separate risk-severity palette)
- **UI primitives:** Radix UI + lucide-react + class-variance-authority
- **Database & Auth:** Supabase (Postgres + Supabase Auth, via
  `@supabase/ssr`)
- **Document generation:** `@react-pdf/renderer` for PDF export,
  `pdf-parse` / `mammoth` for reading uploaded PDFs/DOCX
- **AI:** Google Gemini today (being refactored to a provider-agnostic
  layer — see "AI provider layer" below)
- **Testing:** Vitest is installed but not wired into a `test` script;
  coverage is minimal (3 test files, no CI)

Single Next.js monolith — no separate backend service, no other
languages.

## Structure
- `src/app/` — routes, using Server Components for data fetching and
  Server Actions (`"use server"`) for mutations
- `src/components/ui/` — Radix-based primitives
- `src/components/audit/` — the deal workspace (largest, most complex
  surface — one 700+ line client component holding most of the intake/
  analyze/generate state)
- `src/components/landing/` — marketing pages
- `src/lib/ai/` — extraction, risk analysis, prompt templates, provider
  client
- `src/lib/risk/engine.ts` — rule-based fallback risk scorer (8
  categories), used when the AI call fails
- `src/lib/supabase/` — browser and server Supabase clients
- `src/lib/generate.ts` — document generation orchestration (proposal →
  SOW → contract → checklist, sequential AI calls with per-document
  template fallback)
- `supabase/migrations/` — 18 migrations, one Postgres schema, RLS
  enabled on every table

**Known naming risk:** route/session guarding lives in `src/proxy.ts`,
not the Next.js-conventional `middleware.ts`. Whether this actually runs
in production without a `middleware.ts` wrapper is unverified and should
be confirmed before relying on it for security — this affects session
refresh and auth route guarding.

## Data model (Supabase / Postgres)
Core tables: `audits` (the deal itself — raw input, structured extraction,
risk report, overall score, lock state), `client_profiles`,
`checklist_items`, `business_profiles`, `document_versions` (proposal/
SOW/contract/checklist, versioned, AI-or-template generation method
recorded), `share_tokens` + `document_signatures` (client-facing sharing
and e-signing), `usage_tracking` (daily rate-limit counters),
`system_logs`, `activity_events`.

All tables have Row Level Security enabled, scoped to `auth.uid()`. Two
RPCs (`get_shared_document`, `sign_shared_document`) are `SECURITY
DEFINER` with `EXECUTE` granted to `anon` — intentional, since the public
client-facing share/sign flow needs to work without an authenticated
session. This is a sound pattern as long as those two RPCs stay tightly
scoped.

## Auth flow
Supabase Auth (email/password), email verification required before a
user can run an analysis or generate documents (checked both in the
route layer and inside the relevant Server Actions — defense in depth).
Every Server Action independently re-fetches the user and validates
their UUID rather than trusting a shared context — safe, but means
there's no caching layer, so auth checks happen redundantly across
components.

## Request flow (high level)
```
User → Dealenz Web (landing/auth/dashboard/audit workspace)
     → Server Actions (authenticated operations: create audit, save
       input, upload files, run analysis, generate documents)
     → Domain/AI layer (text extraction, AI extraction, deterministic
       risk engine, document generation)
     → Supabase (auth, Postgres, RLS, storage, usage tracking, logs)
```
The Domain/AI layer is the important seam: AI extraction produces
structured deal data, and a separate deterministic rule engine scores
risk against that data. The AI does not assign risk scores directly —
see `product.md` for why this separation is a deliberate product
decision, not just an implementation detail. Keep this seam intact when
refactoring the AI provider layer below; swapping providers should never
mean letting a provider's model output become the risk score directly.

## AI provider layer
**Current state:** hardcoded to Gemini's request/response shape in
`src/lib/ai/client.ts`.

**In progress:** refactoring to a provider-agnostic interface
(`callAI({ systemPrompt, userContent, temperature, maxTokens })`) with
swappable adapters — a Gemini adapter (existing) and an OpenAI-compatible
adapter (covers NVIDIA NIM now, and Groq/OpenRouter/Together later
without new code, since they share the same `/chat/completions` shape).
Prompts (`src/lib/ai/prompts.ts`) stay provider-agnostic strings and are
not touched by this refactor. Env vars: `AI_PROVIDER`, `AI_API_KEY`,
`AI_BASE_URL`, `AI_MODEL`.

Reason for this: currently running on a budget key from a
non-Gemini provider, with intent to swap back to Gemini once
affordable. The abstraction exists so that swap is a config change, not
a rewrite.

**Response handling:** JSON extraction is provider-agnostic already —
strips code fences, falls back to slicing the first `{…}` block, then
coerces fields with defaults. This should keep working across providers,
though non-Gemini models may follow the JSON-output instruction less
reliably and exercise the fallback path more often — worth testing before
trusting it for anything client-facing.

## Extraction & risk schema — generalization needed
`src/lib/ai/prompts.ts` currently hardcodes freelancer-deal assumptions:
`EXTRACTION_SYSTEM_PROMPT` extracts an 8-field freelancer schema (scope,
budget, timeline, deliverables, etc.), and `RISK_ANALYSIS_SYSTEM_PROMPT`
scores against the same 8 freelance-specific categories (scope, payment,
timeline, communication, revision, legal, IP, client behavior). Neither
prompt currently branches on deal type, because deal type doesn't exist
as a concept in the schema yet.

To support the broadened product (see `product.md` → "Deal types"),
this needs:

1. A `deal_type` field captured at intake (user-selected or AI-inferred
   from the input), persisted on the `audits` row alongside the existing
   fields.
2. Deal-type-specific extraction prompts — or one prompt with a
   deal-type-conditioned field schema, so a lease audit doesn't get asked
   to extract "deliverables" and "revision rounds," and a freelance audit
   doesn't get asked about "security deposit."
3. Deal-type-specific risk category sets in `src/lib/risk/engine.ts` —
   the deterministic engine needs its own rule set per deal type, not
   just a relabeled version of the freelance categories. This is the
   larger piece of work: the freelance rule engine took real iteration to
   get right, and each new deal type needs the same treatment, not a
   quick copy-paste.
4. For the generic/fallback deal type (see product.md's recommendation
   to ship this first), a looser schema and category set that trades
   precision for coverage — this can lean more on AI-assisted scoring
   with the rule engine doing lighter-touch validation, since there's no
   time to hand-write rules for "any possible agreement."

This is a genuine engineering project, not a prompt tweak — sequencing
it (which deal type or generic mode first) is a product decision, listed
under "Open product decisions" in `product.md`.

## Local development
```
npm run db:start     # spins up local Supabase (Postgres + Auth + Storage)
npm run db:migrate    # applies migrations in supabase/migrations/
npm run db:types      # regenerates TypeScript types from the DB schema
npm run dev           # Next.js dev server
```
Required env vars for a working local instance: `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `AI_API_KEY`, `AI_PROVIDER`,
`AI_BASE_URL`, `AI_MODEL`, `NEXT_PUBLIC_APP_URL`. See `.env.example` for
the full list. No seed data currently exists — a fresh local DB starts
empty, so testing the full loop means manually creating a user and
running through intake yourself.

## Environment variables (reference)
| Var | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL, exposed to client |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key, exposed to client (safe — RLS enforces access) |
| `AI_PROVIDER` | Selects the AI adapter (`gemini` or `openai_compatible`) |
| `AI_API_KEY` | Key for the active provider |
| `AI_BASE_URL` | Endpoint for the active provider |
| `AI_MODEL` | Model name for the active provider |
| `NEXT_PUBLIC_APP_URL` | Base URL used in generated share links |

## File upload & storage
Uploaded deal files (briefs, PDFs, DOCX) go to the `audit-files` Supabase
Storage bucket. Limits: 10MB per request body, 10MB per file, 10 files
per audit. Storage RLS policies scope access by folder name matching
`auth.uid()`, so a user can only reach their own uploaded files even
though the bucket itself isn't fully private. Extraction reads these
files server-side via `pdf-parse` / `mammoth` before AI extraction runs.

## Rate limiting
Enforced via the `usage_tracking` table (unique per user/action-type/day)
and an `increment_usage` RPC that checks the count before incrementing,
not after — this was previously a bug (unconditional increment) and is
now fixed. Limits: 5 deal analyses and 10 protection-package generations
per user per day. This is a cost control on AI spend, not a monetization
gate yet — there's no paid tier that raises these limits.

## Security
Consolidated from what the audit verified plus standard practice for a
SaaS handling other people's client/deal data.

**Authentication** — Supabase Auth (email/password), session refresh
handled per-request. Email verification is required before a user can
run analysis or generate documents, enforced at both the route layer
and inside individual Server Actions (defense in depth, not a single
point of failure). No 2FA currently — reasonable to defer at this stage,
worth adding once there's real money or contracts flowing through
signed documents.

**Authorization** — Row Level Security on every table, scoped to
`auth.uid()`. This is the primary authorization mechanism, not
application-layer checks — meaning even a bug in a Server Action can't
leak another user's data, because the database itself refuses the query.
Two RPCs are `SECURITY DEFINER` with public (`anon`) execute grants,
intentionally, to support the unauthenticated client-facing share/sign
flow — any new `SECURITY DEFINER` function needs the same scrutiny:
default to RLS, only bypass it when there's a specific, narrow,
justified reason.

**Secrets management** — all keys via environment variables, never
hardcoded. `.env*` is gitignored. `NEXT_PUBLIC_*` vars are intentionally
public (safe because RLS enforces actual access); anything without that
prefix is server-only. Standard practice worth adopting as the team or
surface area grows: rotate keys on a schedule, use a secrets manager
(Vercel env vars are fine at this stage) rather than passing `.env`
files around manually.

**Input validation** — Server Actions whitelist allowed fields and
status values rather than trusting arbitrary input. File uploads are
checked for type and size before processing. Worth confirming: whether
markdown rendered from AI output or user input goes through XSS
sanitization before display — this wasn't confirmed in the last audit
and is worth a direct check, since generated documents and shared
client-facing pages are exactly where stored XSS would matter most.

**Transport & headers** — CSP is configured (`next.config.ts`), allowing
the AI provider's domain and otherwise fairly locked down, though
`unsafe-inline`/`unsafe-eval` are currently permitted for scripts — a
common Next.js default but worth tightening once you know exactly what
needs inline scripts. HTTPS is assumed via hosting platform, not
something this app configures itself.

**Dependency security** — `npm audit` should run as part of any regular
maintenance cadence, not just when an audit happens to be requested.
Several high-severity issues existed as of the last check; the fix
(patching to newer versions) should happen on a branch with a full
build/typecheck pass, since some patches move outside currently declared
version ranges.

**Data privacy** — this product stores client names, deal terms,
contract content, and signed documents — this is sensitive business data
even without being classic PII like SSNs. No stated data retention
policy exists yet (how long is a completed/abandoned audit kept?). Worth
deciding before there's real user data to worry about: a simple stance
like "data is kept until the user deletes their account" is enough for
now, but it should be a stated decision, not an accident of the schema
having no deletion logic.

## Caching
No caching layer currently exists — every request hits Supabase
directly. For this app's actual shape, caching mostly matters in a few
specific places, not everywhere:

- **Templates library** (`/templates`) — static, same for every user,
  a good candidate for Next.js's built-in data cache with a long
  revalidate window, since it changes rarely.
- **Risk Intelligence static library** — same reasoning, the 9 static
  risk patterns don't need a fresh DB read on every page load.
- **Dashboard, deal list, audit detail** — these should stay uncached
  or very short-lived (or use React's per-request cache only), since
  they're personalized and RLS-scoped — caching these across users would
  be a data leak, and caching them per-user adds complexity that likely
  isn't worth it until there's a real performance problem.
- **AI extraction/risk/generation calls** — do not cache these. Each
  input is unique to a specific deal; caching AI output would mean
  either serving stale analysis or accidentally serving one user's
  extracted data to another.

The practical takeaway: cache what's read-heavy and identical for
everyone, leave everything RLS-scoped and personalized uncached until
there's a measured performance reason to do otherwise. Premature caching
on user-specific data is a more likely bug source than a real win at
current scale.

## Observability & monitoring
Currently: `system_logs` records phase/status/duration for key
operations, queried manually in Postgres. No error tracking service, no
uptime monitoring, no alerting — if something breaks in production right
now, the first sign is a user reporting it, not the system telling you.

Reasonable next steps for a solo-built SaaS, roughly in order of value
per effort:
1. **Error tracking** (e.g. Sentry) — catches unhandled exceptions in
   Server Actions and client components with stack traces, instead of
   silent failures or generic error boundaries.
2. **Uptime monitoring** — a simple external ping (even a free-tier
   service) against the production URL, so you find out about downtime
   before a user does.
3. **Alerting on AI provider failures** — since AI calls silently fall
   back to templates/rule-engine on failure, it's possible for the
   product to degrade without anyone noticing (as already happened with
   the mismatched API key). A simple alert when the fallback path fires
   more than expected would catch this class of problem early.



## Deployment (default assumption, not yet confirmed)
No stated hosting decision exists yet. For a Next.js + Supabase app at
this stage, the default path is Vercel for the app and Supabase's hosted
platform for the database — this is the path of least friction and
matches what the stack is already built for (Next.js Server Actions,
Supabase SSR helpers). Treat this as the default until you decide
otherwise, not as something already set up.

## CI/CD (currently absent)
No pipeline exists. Given there's no wired test script yet either, the
honest first step isn't a full CI/CD pipeline — it's wiring `npm test`
to actually run the 3 existing test files, then adding a basic GitHub
Actions workflow that runs build + typecheck + test on every push. CI
before tests exist is checking nothing; get the test script working
first.

## Backup & recovery
No stated RPO/RTO. Supabase's hosted platform includes automated daily
backups on paid tiers, which is a reasonable default to lean on rather
than building anything custom at this stage. Worth revisiting once real
user data (signed contracts, deal history) makes data loss something
that could actually hurt a freelancer, not just be an inconvenience.

## Non-functional targets
No stated targets exist beyond "works for a handful of freelancers,"
which is the audit's own framing of current readiness. Not worth
inventing artificial SLAs at this stage — but worth writing down once
there's a real answer, since "no target" quietly becomes "no one
notices when it's slow" otherwise.


- **State sprawl:** the deal workspace component holds 14+ `useState`,
  5 `useRef`, 5 `useEffect` in one file. Works, but any new feature touching
  intake/analysis/generation risks conflicting with existing state
  transitions.
- **No pagination:** dashboard/deals/risk-intelligence pages use fixed
  `limit()` calls with no cursor. Fine at current scale, will need
  addressing before real usage volume.
- **Search is a full table scan:** `ILIKE` on title only, no index. Same
  scale caveat as above.
- **No background jobs:** document generation is synchronous inside a
  Server Action — 4 sequential AI calls per protection package, each with
  its own timeout. Long-tail latency risk as usage grows; will eventually
  need a queue.
- **No CI, minimal tests:** Vitest is installed but not wired to a test
  script. Three test files exist with light coverage. No automated check
  currently catches a regression before it ships.
- **Dependency vulnerabilities:** several high-severity issues across
  Next.js, PostCSS, sharp, and a few transitive packages as of the last
  audit — needs a patch pass, ideally on a branch with a full
  build+typecheck before merging (some fixes bump Next outside the
  currently declared version range).

## UX / UI

### Design principles (stated, apply across the product)
- Light/white backgrounds for the core app (consumer-facing product);
  dark editorial styling reserved for the personal-brand/landing context
  only.
- System font stack (SF Pro / -apple-system) — no monospace fonts, no
  generic SaaS-default typefaces.
- Reject AI-sounding copy and generic SaaS design defaults throughout —
  this applies to UI copy, empty states, and error messages, not just
  marketing pages.
- No em dashes anywhere in shipped copy.
- Dark burgundy/oxblood as the core brand primary color, with a distinct
  risk-severity palette (separate from brand color) so risk levels stay
  legible and don't fight the brand color for attention.

### Information architecture (as built today)
```
Landing (marketing, acquisition layer — see product.md)
  → Auth (login / register / email verification)
    → Dashboard (Needs Attention, Risk Alerts, In Progress, Recent Activity)
      → New Audit (deal type selection — NEW, not yet built)
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

### What changes for the broader audience
- **New Audit needs a deal-type step.** This doesn't exist today —
  intake goes straight to paste/upload/form. Adding deal type as the
  first decision point is the single highest-leverage UI change for the
  broadened product, since everything downstream (extraction fields,
  risk categories, whether a protection package even makes sense)
  depends on it.
- **"Client" language needs to become conditional or generic.** The
  dashboard, workspace, and document generation all say "client"
  throughout. For a lease audit, there's a landlord, not a client. Two
  options: genericize to a neutral term like "counterparty" everywhere
  (simpler, but loses some of the freelance flow's specificity), or keep
  deal-type-specific vocabulary that swaps based on the selected deal
  type (more work, better feel). This is a real UX decision, not just a
  find-and-replace — recommend deciding after the first non-freelance
  deal type is scoped, so there's a concrete second vocabulary to design
  against instead of guessing.
- **Protection Package needs a non-generation mode.** For deal types
  where the user is reviewing something they received (a lease, an
  offer) rather than sending something they wrote, the equivalent screen
  should show risk-annotated terms and negotiation points, not a
  proposal/SOW/contract generator. This is a distinct UI, not a relabel
  of the existing tabs.
- **Templates library** should eventually filter or group by deal type
  once more than one exists; today all 12 are freelance-oriented.
- **Risk Intelligence's static library** (9 patterns) is freelance-
  specific content and will need parallel content per deal type, or a
  reframed "risk library" that's deal-type-aware from the start rather
  than freelance content with other categories bolted on.

### States worth designing deliberately (not yet all handled)
- **Empty states** — new user with no deals yet; a deal type with no
  matching template or risk ruleset (the generic fallback case).
- **AI degraded state** — when the AI call fails and the product falls
  back to the rule engine/templates, does the user know their result is
  lower-confidence? Today this fails silently (see the earlier Gemini
  key mismatch incident) — worth surfacing this in the UI, not just
  logging it server-side, especially as more deal types lean harder on
  AI-assisted scoring where no rule engine exists yet.
- **Deal-type-not-yet-supported state** — when generalization ships in
  phases, some deal types will exist as options before their risk engine
  is fully built. Decide upfront whether to hide unsupported types, show
  them as "coming soon," or route them into the generic fallback
  silently — this is a real product decision, not a UI afterthought.


Anything above sourced from the 2026-08-29 audit is file-cited in that
document. Treat this architecture doc as a snapshot, not a living
source of truth — re-verify against the code rather than this file
whenever precision matters, since it will drift as the codebase changes
and this doc won't auto-update.
