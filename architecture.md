# Dealenz — Architecture

Companion to `product.md` (product decides what, this decides how it is
built). Grounded in the post-wipe codebase: landing + auth + public pages +
API + lib engine survive; all app UI was rebuilt tab by tab from a blank
slate. Anything cited here to a file exists; anything planned is marked
planned, never assumed.

## Stack

- **Framework:** Next.js 16 (App Router), React 19, TypeScript (strict mode)
- **Styling:** Tailwind CSS v4, orthogonal system (zero radius, hairlines,
  flat, no shadows), pine/brick/ink color tokens, Bodoni Moda display +
  Mona Sans body
- **UI primitives:** Radix UI (menus/navigation only — never content
  dialogs) + lucide-react + class-variance-authority
- **Database & Auth:** Supabase (Postgres + Supabase Auth, via `@supabase/ssr`)
- **AI:** provider-agnostic layer (Gemini, OpenAI-compatible, Anthropic
  Claude adapters); per-message model choice, BYOK encrypted server-side
- **Testing:** Vitest (`npm test`); CI runs typecheck, lint, tests, build

Single Next.js monolith — no separate backend, no other languages.

## Route Map

Public (no auth): `/` landing, `/login`, `/register`, `/auth/*`,
`/pricing`, `/terms`, `/privacy`, `/dpa`, `/terms-policies`,
`/methodology`, `/security`, `/status`, `/help`, `/insights/*`,
`/api/*` (self-authenticating).

App (auth-gated, proxy-enforced, one prefix per tab, added as tabs land):
`/dashboard` (Home), `/inbox`, `/drafts`, `/signing`, `/tracker`,
`/clauses`, `/templates`, `/compare`, `/approvals`, `/reports`, `/lab`,
`/team`, `/chat/new` (empty workspace), `/chat/[id]` (deal thread).

App routes live under `src/app/(app)/` behind one shell. The proxy
(`src/proxy.ts`) does session refresh plus two rules only: signed-in users
off the auth pages, signed-out users off guarded prefixes. API routes
authenticate themselves (webhooks verify signatures; nothing trusts the
proxy for authorization).

## Shell & Chrome

- **Top bar** (`src/components/top-bar.tsx`): logo left, inline search
  center (typing in the pill, results dropdown beneath — no modal), credit
  count + avatar right with an inline account panel (email + sign out).
  Pinned, orthogonal, no popups.
- **Sidebar** (`src/components/sidebar.tsx`): fixed icon rail, expands to
  full labels on hover. Entries render from `PRIMARY_NAV` (`src/lib/nav.ts`)
  and grow tab by tab — currently all twelve. Active entry is a marker bar
  plus weight, never an inverted fill.
- **Shell** (`src/components/app-shell.tsx`): auth gate (signed-out →
  login, unverified → notice), loads business name, credit balance, and the
  search thread list, then top bar + sidebar + page. No hover chrome, no
  trigger strips, no skeleton rail.
- **Mobile**: hamburger drawer (Sheet) with nav + New action. No bottom
  tab bar, no floating pills.

## Deal Workspace

`src/components/workspace/` — the foundation. Split pane (chat 1 /
work 1.4, work dominant), single column on narrow screens with work cards
stacking under their message.

- **Composer** (`composer.tsx`): attach (+) · `Ask` field · mic · round
  send · Model picker (Auto default). Per-message model choice is allowed
  because verdicts stay rule-determined; the active model is logged on
  every finding, and BYOK keys never reach the client bundle.
- **Classifier routing** (functions phase): proposes operation (analysis /
  question / draft / compare) and deal type from the material, shows its
  shot with one-tap correction. Silent rerouting is forbidden.
- **New-deal entries** across all tabs point at `/chat/new` (empty
  workspace). No form page, no wizard, no modal.

## Frontend Rules

- **Inline surfaces only.** Search results, account panel, model options,
  consent, editors, viewers render in-flow. The mobile drawer is the only
  overlay in the product. `fixed inset-0` content overlays and `aria-modal`
  dialogs are banned — grep enforces it.
- **No inversions.** State emphasis via borders, weight, muted fills.
  Nothing renders light-text-on-dark-fill except deliberate brand blocks
  (hero, final CTA).
- **Color tokens** (`globals.css`): pine (primary actions + verified/
  success; AA 5.25:1 light, 9.1:1 dark), brick
  (danger/critical/overdue/destructive), ink/neutral (text + neutral
  emphasis). `--destructive` resolves brick. Landing ink blocks bypass
  action tokens by design.
- **One search**: the top bar pill. Tabs filter with chips, never a second
  search box.
- **Copy voice**: enterprise-terse. Empty states carry benefit + exactly
  one primary action.

## Data Model

### Search (lexical v1; semantic banked)

Stored generated `content_tsv` columns + GIN on `audits`,
`document_versions`, `corpus_clauses`; trigram indexes on titles for
typo-tolerant name search. One RLS-scoped RPC (`search_deals`,
SECURITY INVOKER — table policies are the boundary, per doctrine);
`websearch_to_tsquery` syntax, `ts_rank_cd` ranking, `ts_headline`
snippets. Top-bar pill is the only surface; chips constrain. pgvector +
RRF hybrid is the documented second phase. Basis:
`research/contract-search/`. Canary tests assert cross-user denial.

### Surviving tables (kept through the wipe, RLS throughout)

- `audits` — the deal (raw input, structured extraction, risk report,
  `deal_type`, `context_envelope`, `structured_data.deterministicFindings`)
- `document_versions` — versioned drafts/outputs, lifecycle statuses
  (`draft → … → fully_signed → locked → superseded`), content hashes,
  parent pointers, server-enforced lock
- `monitoring_events` / `monitoring_alerts` — renewals, expirations,
  obligations, deadlines, material events with provenance + evidence
- `conversations` / `conversation_messages` — threads and messages
- `credit_ledger` / `credit_purchases` — append-mostly, idempotent
  (`user_id, idempotency_key`), advisory-locked reservations
- `work_plans` / `work_plan_steps` / `work_approvals` / `work_executions` /
  `work_products` — bounded execution core (plan + cost → approval →
  execute → observe → product → audit trail)
- `business_profiles`, `client_profiles`, `knowledge_items`
  (jurisdiction-keyed legal corpus), `organization_members`,
  `share_tokens`, `activity_events`, `system_logs`, referral tables

User data and credits were never touched by the UI wipe. Cascade delete on
account removal until a formal retention policy replaces it.

### Planned tables (functions phase, in tab order)

- **Playbook**: `playbook_positions` (workspace-scoped standing rules,
  versioned) + `playbook_versions`. Positions quote in findings.
- **Corpus index**: clause-level extraction over signed/locked versions
  (`corpus_clauses`: audit, clause key, text hash, offsets) powering
  cross-contract conflict checks.
- **Clause tracking**: `clause_states` (deal × clause → suggested / draft /
  needs-input / signed), derived where provable, stored where the user
  acted (accept/edit/dismiss).
- **Approvals**: decision queue rows (requested action, cost/risk snapshot,
  requester, approver or group, verdict, audit trail). Reuses the
  `work_approvals` pattern, surfaced per-tab.
- **Prompt Lab**: `prompt_templates` (versioned) + `prompt_runs` (input,
  output, model, cost, eval note).
- **Team**: `team_invites` (email, role, expiry, resend), `permission_groups`
  + `group_members`. Roles resolve Owner > Admin > Member > Viewer; Team
  tab renders for Owner/Admin only, others redirect Home.
- **Models**: `user_model_keys` (provider, encrypted secret, label).
  Resolution order per call: message choice → workspace default → system
  default. Every call logs provider + model.
- **Batch**: `batch_jobs` (manifest: file list, type mix, estimate, status)
  + `batch_items` (per-file state, credits cap, evidence ref). Estimate
  approval mandatory before fan-out; fixed worker concurrency; per-file
  failure isolation; rollup artifact linking each file.

## AI & Authority Pipeline

Provider-agnostic `callAI` with per-call model resolution (above). The
pipeline per analysis:

```text
material → classify (show shot) → context → playbook positions →
corpus conflicts → jurisdiction law → base rules → findings →
AI synthesis (model-logged) → approval gate → work product → audit trail
```

- Findings cite authority in order: playbook section → corpus clause →
  statute → base rule. Linked positions cite through to their library
  variant and ladder rung; linked language is the only auto-suggested
  insertion source. Playbook-vs-law contradictions surface as blocking
  or advisory by severity, never silent. Basis:
  `research/clause-playbook-pairing/`.
- Deterministic rules keep their shape (`RuleResult` PASS/FAIL/UNKNOWN,
  evidence-embedded) and remain the only verdict source. AI never flips a
  verdict; a model can only affect explanation quality.
- Evidence: EXACT/APPROXIMATE/UNAVAILABLE preserved; no offsets invented.
- Unknown stays unknown — the system asks or qualifies, never guesses.

## Server-Side Doctrine

Browser renders and captures input. Every decision, secret, and cent
stays server-side — verdicts, keys, credits, and audit integrity can
never live in the client, because anything the client decides, the
client can forge. Tenant isolation is a data-layer guarantee (RLS per
`auth.uid()` + workspace membership), never an app-layer promise.

Server Actions carry fast mutations only. They dispatch sequentially,
cannot abort, and die under platform timeouts — so anything long,
parallel, or cancellable runs on the worker layer instead: enqueue →
worker executes with retries → progress via polling/SSE → audit trail
records each step. Analysis runs, folder batches, and monitoring sweeps
are worker workloads; single-record mutations stay in actions.

Enterprise identity and evidence roadmap (before the first regulated
customer): SSO (SAML/OIDC) + SCIM provisioning, MFA, append-only
exportable audit logs (SIEM streaming; admins cannot delete them), data
residency, SOC 2/ISO evidence. Deployment stays multi-tenant SaaS; worker
code lives in portable `lib/` modules so dedicated-tenant/VPC stays an
option, never a rewrite.

## Batch Workers

Not agents: bounded operations with approval gates. Manifest (N files,
types, languages, estimate) → user approval → fan-out at fixed
concurrency → per-file classify → route to rulepack → findings + evidence →
threshold-routed review (critical files pause at Approvals, clean files pass)
→ portfolio rollup into Reports + Home. Per-file credit ceiling, failure
isolation with isolated retry, idempotent items (`job:file:hash`). No
autonomous looping, no unapproved spend, no silent actions.

Execution reuses the work core — no parallel batch tables (D8): the
manifest is computed, a batch is a work plan with one analysis step per
deal, approval gates through `work_approvals`, and the rollup reads steps
+ per-deal outcomes. Estimate approval mandatory before fan-out; fixed
worker concurrency; per-file failure isolation; rollup artifact linking
each file. Basis: `research/phase-c-batch-portals/` (D1–D3, D8).

## Teams & Permissions Enforcement

- RLS is the primary mechanism, scoped to `auth.uid()` + workspace
  membership + role. Application checks are UX, never the boundary.
- Groups resolve to member lists server-side at approval/access time
  (frozen snapshot per decision for auditability, live list for routing).
- Guests/external participants are distinct principals (token/scoped
  grants), never members. Member tables and guest grants never mix.
  One external surface serves all audiences; each grant is audience-typed
  (`employee` / `supplier` / `customer`) and scoped to its contracts.
  Counterparty uploads stage outside version control until accepted.
  Grants expire and auto-revoke. Vendor-admins manage their own users;
  invites stay internal-owner-only. Basis:
  `research/phase-c-batch-portals/` (D4–D7).
- Sensitive actions (invite, remove, role change, ownership transfer,
  workspace delete) require confirmation and write the audit trail.

## Credits & Billing

Workload-priced credits; estimate-before-spend everywhere (single
analysis, folder batch, prompt runs). Paddle for software (webhook
HMAC-verified, idempotent allocation, no second ledger). Credits never
become money; professional-service payments (if any) run through
connected accounts. No subscriptions gating features; guard-style
recurring value (renewal/obligation monitoring) is the only recurring
shape and must exist before being sold.

## Security Principles

Least privilege, RLS defense in depth, server-side authority, validated
inputs/files (10MB/file, 10 files, type-checked), controlled document
access, auditable sensitive actions, minimal exposure, explicit consent
for AI processing and handoffs, encrypted secrets, no unnecessary
retention. CSP configured; AI calls are server-side only.

## Observability

`system_logs` (phase/status/duration), `activity_events` (user actions),
credit ledger (what was charged, when), approval verdicts (who decided
what). No silent fallbacks: degraded output is labeled degraded in the
UI, not just logged. Error tracking + uptime monitoring + provider-failure
alerting land before the first paying workspace.

## Build Method (Binding)

Foregrounds first (structure, spacing, states, empty states — never fake
data, never function-implying buttons), functions second in tab order.
Each tab's functions land complete before the next starts. All twelve
foregrounds stand as of this writing; functions begin at the workspace
(classifier → creation → analysis) and proceed outward.

## Open Decisions

1. Playbook format (structured upload vs freeform vs both) and conflict UX.
2. Corpus indexing timing (at-signing vs lazy on first check).
3. Batch defaults (concurrency, per-file ceiling, estimate model).
4. Jurisdiction corpus order after the base.
5. Built-in model catalog + BYOK provider scope.
6. Pricing (per-outcome prices, bundles, guard subscription).
7. Formal data-retention policy.
8. Error tracking / uptime / alerting vendor picks.
9. Dependency patch cadence (post-wipe baseline audit due).
10. SSO provider scope (SAML + OIDC minimum) and SCIM sequencing.
11. SIEM export format and retention policy for audit streams.
