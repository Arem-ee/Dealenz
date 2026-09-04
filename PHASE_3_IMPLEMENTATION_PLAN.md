# Phase 3 — Implementation Plan

## 1. Executive Summary

This plan converts the Phase 1A forensic baseline and the Phase 2 gap/dependency findings into an ordered, dependency-safe implementation sequence for the canonical Dealenz product defined in `PRODUCT.md` and `ARCHITECTURE.md`.

The central facts shaping this plan:

1. **A working freelance pipeline exists end to end.** Intake, extraction, deterministic risk analysis across 8 categories, protection package generation, PDF export, sharing, and e-sign all work. This is the asset to protect.
2. **The generic deal path contradicts the AI authority boundary.** `analyzeGenericRiskWithVisibleFailure` in `src/lib/ai/risk-analysis.ts` performs AI-only risk scoring with no deterministic fallback and throws on AI failure. The canonical rule is that AI must never be the final authority for risk conclusions. This is the highest-priority architectural contradiction to resolve, and the resolution is graceful degradation plus lightweight universal rules, not a bigger AI prompt.
3. **Context, knowledge, commerce, execution, and professional review workflow are missing.** There are no `src/lib/context`, `src/lib/knowledge`, `src/lib/deal-types`, `src/lib/protection`, `src/lib/lawyer`, or `src/lib/execution` modules. All six globs returned no files.
4. **No credit system exists.** Search of `src` for credit or ledger concepts returned only marketing copy about credit cards. Billing is a free-plan usage display.
5. **Security hardening must come first.** The proxy middleware naming risk, unaudited `usage_tracking` access patterns, AI error leakage to anonymous callers, and deal content in logs must be resolved or explicitly accepted before building on top of them.
6. **A new canonical Supabase project is asserted but unverified.** No `.env` file exists in the repository. Only `.env.local` and `.env.example` were found. No implementation may proceed against the new backend until the `NEW SUPABASE PROJECT VERIFIED` gate passes.

The plan therefore orders work as: verify the canonical backend, harden security foundations, generalize the domain model around the preserved freelance core, fix the generic path, add context then knowledge then pluggable analysis, prove the architecture with one new deal type, then protection, professional review, commerce, execution, and production hardening.

## 2. Planning Baseline

Authoritative inputs for this plan:

1. `PRODUCT.md` — read in full. Canonical direction: deal intelligence, protection, optional professional review, execution; credit-based monetization on workload; international-first; provider-agnostic commerce.
2. `ARCHITECTURE.md` — read in full. Canonical nine-layer target, AI as cross-cutting capability, staged phases, open questions.
3. `PHASE_1A_CODEBASE_AUDIT.md` — **not present in the repository.** A glob for `PHASE*` returned no files. The Phase 1A findings referenced in this plan are therefore drawn from direct repository inspection performed during planning, cited to exact files below, not from a stored audit document.
4. `PHASE_2_GAP_DEPENDENCY_MAP.md` — **not present in the repository.** Same handling as above. Gap and dependency conclusions below are derived from direct inspection plus the canonical documents.

Direct inspection performed for this plan (read or searched in full unless noted):

- `package.json:5-13` (scripts: no `test` script; vitest present at line 49), `next.config.ts:11` (CSP), `next.config.ts:15-19` (serverActions body limit)
- `src/proxy.ts` (auth guard + matcher), `src/proxy.test.ts`, `src/app/login/actions.test.ts`, `src/app/audit/[id]/actions.test.ts` (3 test files, no CI: glob `.github/**/*` returned nothing)
- `src/app/api/analyze-anonymous/route.ts` (anonymous Quick Review endpoint, in-memory rate limit, validation gate)
- `src/lib/ai/extract.ts:59-91` (validation thresholds), `src/lib/ai/risk-analysis.ts:124-214` (freelance fallback vs generic AI-only), `src/lib/risk/engine.ts` (8 freelance categories), `src/lib/generate.ts:229-299` (4 sequential doc generations with template fallback), `src/lib/ai/prompts.ts` (freelance + generic prompts), `src/lib/ai/providers.ts`, `src/lib/ai/providers/gemini.ts`, `src/lib/ai/providers/openai-compatible.ts`, `src/lib/ai/negotiation.ts`
- `src/app/audit/[id]/actions.ts` (analyze + protection flows, `extractAndValidate` at line 392, generic branch, `increment_usage` RPC call, `NEXT_PUBLIC_APP_URL` guards at lines 894-904), `src/app/audit/new/actions.ts`, `src/app/audit/[id]/consultation-actions.ts:43` (waitlist switch), `src/app/dashboard/page.tsx`, `src/app/billing/page.tsx` (free-plan display only), `src/app/lawyer-application/*`, `src/app/admin/lawyers/*`, `src/app/api/admin/lawyers/verify/route.ts`, `src/app/api/lawyer-application/*`, `src/app/api/lawyers/verified-count/route.ts`, `src/app/auth/callback/route.ts`
- `src/components/audit/workspace-client.tsx` (830 lines, `dealType` at line 149, `LawyerEscalationCard` at lines 713-717), `protection-package.tsx` (hardcoded freelance tabs), `risk-report.tsx`, `generic-risk-report.tsx`, `lawyer-escalation.tsx:35-64` (waitlist/active states), `deal-type-selector.tsx:12-23` (two options only), `landing-mini-dashboard.tsx`, `landing-hero.tsx`, `auth/SlideshowPanel.tsx`, `settings-client.tsx`
- `supabase/migrations/00001_create_audits.sql` through `00020_lawyers_and_consultations.sql` (20 files); `SECURITY DEFINER` found only in `00004_usage_tracking.sql:21`, `00013_share_and_sign.sql:61,128`, `00018_fix_rate_limit.sql:11`; no `CREATE EXTENSION` statements found
- `supabase/migrations/00019_add_deal_type.sql` (`CHECK (deal_type in ('freelance','generic'))`), `00020_lawyers_and_consultations.sql` (lawyers + consultation_requests with RLS)
- Searches: no credit or ledger domain code in `src` (only marketing copy); no payment provider code in `src` (no stripe, paystack, lemon squeezy, paddle, paypal matches); no background job infrastructure (only UI timers and AI abort timeouts); no hardcoded `supabase.co` URLs in `src`

## 3. Non-Negotiable Architectural Principles

These principles come from `PRODUCT.md` and constrain every phase below. Any implementation step that violates one is rejected regardless of convenience.

1. **AI proposes, rules decide, AI explains.** AI extracts facts, classifies, maps evidence, drafts, and explains. Deterministic rules assign scores. Lawyers provide judgment.
2. **No AI-only risk scoring.** If no applicable authoritative framework exists, the product returns limited findings plus uncertainty plus context requests plus professional review recommendations. It never invents a risk score.
3. **Evidence before assertion.** Every significant finding traces to source text plus rule or framework citation plus confidence.
4. **Legal, practice, commercial, and recommendation layers stay distinct.** A commercial concern is not presented as a legal violation. An unusual clause is not presented as illegal.
5. **Context gates analysis.** Insufficient context blocks authoritative analysis rather than degrading it silently.
6. **Uncertainty is a first-class output.** Low confidence, missing context, and inapplicable frameworks are shown, not hidden.
7. **Professional review is optional and conditional.** No mandatory escalation. No marketplace. No revenue-driven escalation.
8. **Lawyer opinions do not auto-promote.** Opinion becomes candidate insight, then expert validation, then versioned framework.
9. **Credits meter work, not tokens or deal types.** Pricing reflects workload. The model evolves from usage data. No frozen formula in this plan.
10. **Preserve the working freelance core.** Generalization wraps it. Nothing is removed until the replacement is proven equivalent.

## 4. Implementation Strategy

1. **Verify the backend first.** No product implementation may depend on Supabase until the new canonical project passes the verification gate (Phase 0).
2. **Harden before extending.** Fix or explicitly accept the proxy, RLS, error leakage, and logging findings before new features depend on those paths.
3. **Generalize by extraction, not rewrite.** Each high-risk file gets its freelance behavior preserved behind a compatibility boundary while shared infrastructure is extracted around it.
4. **Prove with one deal type.** A single new deal type validates the whole generalization stack before a second one is attempted.
5. **Gate on decisions, not dates.** Phases advance when acceptance criteria and decision gates pass, not on a calendar.
6. **Parallelize research, serialize architecture.** Knowledge sourcing, payment research, and legal operating model research run alongside implementation. Core pipeline changes stay sequential.

## 5. Phase Sequence

1. Phase 0, Canonical Supabase Backend Verification (prerequisite for everything that touches the database)
2. Phase A, Production and Security Foundation
3. Phase B, Domain and Foundation Generalization (shared model, registries, boundaries)
4. Phase C, Context Resolution
5. Phase D, Knowledge Foundation (minimal viable)
6. Phase E, Analysis Generalization (pluggable engine plus generic-path resolution)
7. Phase F, First Additional Deal Type
8. Phase G, Protection Generalization
9. Phase H, Professional Review
10. Phase I, Credits and Commerce
11. Phase J, Deal Execution
12. Phase K, Trust, Governance, and Production Hardening

## 6. Phase-by-Phase Plans

### Phase 0, Canonical Supabase Backend Verification

**Objective:** Establish the new Supabase project as the verified canonical backend before any implementation depends on it.

**Scope:** Environment verification, forward-only migration application to the new project, schema verification, RLS verification, auth verification, storage verification, old-project reference audit, deployment environment mapping, data migration decision, verification gate.

**Dependencies:** None (this is the root prerequisite). Requires human access to the Supabase dashboard for project confirmation.

**Areas and files affected:** `.env*` handling (no code changes), `supabase/migrations/00001` through `00020`, `src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`, `src/proxy.ts`, storage bucket `audit-files`, Auth configuration.

**Prerequisites:** Dashboard access to confirm the new project ref and to confirm the old project is retired or retained read-only.

**Outputs:**
- Confirmed Supabase URL and anon key wired for local, preview, and production environments without secret leakage
- All 20 existing migrations applied forward-only to the new project
- Verified schema inventory (tables, enums, keys, indexes, constraints, functions, triggers, RLS policies, storage policies)
- Verified auth flows (signup, login, logout, email verification, password reset, session persistence, proxy behavior)
- Verified storage buckets and policies
- Old-project reference audit table completed
- Explicit data migration decision recorded

**Tests:** Connection smoke test per environment; migration apply on a clean project; RLS checks for own-data access, cross-user denial, anonymous denial, service-role paths; auth flow checks; storage upload, read, delete checks.

**Security requirements:** Browser code receives only anon key plus public URL. Service-role key, if one exists, stays server-side only. RLS remains the boundary on every table.

**Migration requirements:** Forward-only application of the existing 20 migrations in order. No silent edits to historical migrations. Any incompatibility is fixed with a new compensating migration.

**Acceptance criteria:** Application connects to the new project in all environments. Migrations apply cleanly. Schema inventory matches the migration set. RLS verified per table. Auth flows verified. Storage verified. No unintended old-project references remain. Local flows work against the new project.

**Rollback and safety:** No production cutover until the gate passes. Old project left untouched until the cutover decision is recorded.

**Must not be touched yet:** Application code, migration contents, product features, credit or commerce logic.

**Completion gate:** `NEW SUPABASE PROJECT VERIFIED` (see Phase 0 detail in section 8 and the verification checklist in section 12).

### Phase A, Production and Security Foundation

**Objective:** Resolve the findings that everything else depends on for safe operation.

**Scope:** Proxy middleware verification, `usage_tracking` access review, AI error response sanitization, deal-content log redaction, CSP review, secrets and environment review, baseline observability decision.

**Dependencies:** Phase 0 (needs a verified backend to test RLS and auth behavior truthfully).

**Areas affected:** `src/proxy.ts`, `src/app/api/analyze-anonymous/route.ts:149`, `src/lib/logger.ts`, `src/app/audit/[id]/actions.ts` (logging calls), `next.config.ts:11`, `usage_tracking` RPC chain (`src/lib/rate-limit.ts`, migrations `00004`, `00018`).

**Prerequisites:** Phase 0 gate passed.

**Outputs:** Production proxy behavior confirmed or migrated to standard middleware; `usage_tracking` access model documented and secured; anonymous error responses sanitized; deal content excluded from logs or explicitly accepted with a retention rule; CSP posture recorded.

**Tests:** Unauthenticated `/dashboard` returns login redirect in production build; authenticated `/login` behavior; RLS denial tests for cross-user reads; anonymous error response contains no internals.

**Security requirements:** This phase IS security work. RLS stays the boundary. No new `SECURITY DEFINER` functions.

**Migration requirements:** Only if RLS fixes require new policies (forward-only compensating migration).

**Acceptance criteria:** Proxy behavior proven in the production build, not just dev. Anonymous endpoint never leaks internals. Logs contain no deal text. Rate limiting cannot be bypassed by direct table access.

**Rollback:** Each fix ships independently behind the existing behavior; proxy changes verified in preview before production.

**Must not be touched yet:** Risk engine, prompts, document generation, deal-type logic, commerce.

**Completion gate:** Security findings in section 18 marked resolved or explicitly accepted with owner and date.

### Phase B, Domain and Foundation Generalization

**Objective:** Introduce the smallest shared domain boundaries that let new deal types plug in without touching the freelance core.

**Scope:** Shared deal model extensions (context envelope carrier, evidence carrier), extensible deal-type registry (replacing the two-value check constraint path), analysis boundary contracts (extraction output contract, risk report contract), registry for risk category definitions.

**Dependencies:** Phase 0 and Phase A.

**Areas affected:** `audits.deal_type` handling, `src/components/audit/deal-type-selector.tsx`, `src/app/audit/new/actions.ts`, `src/components/audit/workspace-client.tsx` (deal-type plumbing only, no behavior change).

**Prerequisites:** Decision gate: first additional deal type selected (recommendation from canonical docs is lease, still to confirm).

**Outputs:** Extensible deal-type registry; freelance behavior unchanged; new types addable without editing six scattered conditionals.

**Tests:** Freelance regression suite green before and after; registry returns freelance module for existing audits; unknown types route to the generic degraded path, not to invented analysis.

**Security requirements:** RLS unchanged. No new privileged paths.

**Migration requirements:** If the `deal_type` check constraint is widened, a forward-only migration plus data validation. Existing `freelance` and `generic` rows untouched.

**Acceptance criteria:** Freelance flow byte-equivalent in behavior. A third deal-type key can be registered without modifying the freelance engine file.

**Rollback:** Registry defaults to legacy two-type behavior if disabled.

**Must not be touched yet:** Rule contents, prompts, knowledge content, commerce.

**Completion gate:** Registry exists, freelance untouched and green, generic path unchanged in behavior.

### Phase C, Context Resolution

**Objective:** Make context explicit, inferred where possible, confirmed where required, and iterative as the canonical lifecycle demands.

**Scope:** Context inference from input, extraction-assisted resolution, progressive confirmation UI (required first, recommended inline, optional collapsible), jurisdiction and governing-law distinction, party roles, industry, transaction structure, value, stage, cross-border indicators, context confidence, refinement after analysis.

**Dependencies:** Phase B (needs the shared deal model and registry).

**Areas affected:** New context module plus intake UI in `workspace-client.tsx` and `/audit/new` flow; `structured_data` context envelope.

**Prerequisites:** Decision gate: required vs recommended vs optional field set for the first generalized deal type.

**Outputs:** Context envelope persisted per audit; inference with confidence; confirmation UI; unresolved context blocks authoritative analysis with a clear message.

**Tests:** Unit tests for inference and validation; integration tests for infer, extract, resolve, confirm, analyze, refine loop.

**Security requirements:** Context fields validated server-side. No PII beyond what the deal already contains.

**Migration requirements:** Additive context columns or JSONB envelope fields only. No destructive changes to `audits`.

**Acceptance criteria:** Required context missing blocks authoritative analysis with explicit messaging. Inferred context shows source and confidence. User-confirmed context overrides inference.

**Rollback:** Context step skippable for freelance legacy path until proven.

**Must not be touched yet:** Knowledge content, rule contents, commerce.

**Completion gate:** Context-gated analysis demonstrated on freelance plus the generic degraded path.

### Phase D, Knowledge Foundation (Minimal Viable)

**Objective:** Stand up the smallest knowledge infrastructure that can support one authoritative deal type.

**Scope:** Rule and practice storage shape, provenance fields (citation, jurisdiction, effective date, version), applicability metadata, versioning approach, conflict handling policy, sourcing pipeline definition (not content).

**Dependencies:** Phase B and Phase C. Blocked on the knowledge sourcing decision gate.

**Areas affected:** New knowledge module and tables (planned in a future migration, not this phase). No freelance rule changes yet.

**Prerequisites:** Decision gates: knowledge sourcing strategy, jurisdiction coverage v1, rule representation (recommendation is TypeScript plus Zod schemas until rule count justifies a DSL).

**Outputs:** Knowledge schema and governance process; empty or seeded-minimal store with full provenance; applicability resolver stub.

**Tests:** Schema validation tests; applicability resolver unit tests; versioning tests.

**Security requirements:** Knowledge reads are public-within-app; writes are admin-gated.

**Migration requirements:** New tables only, additive. No changes to existing tables.

**Acceptance criteria:** A rule can be stored, versioned, cited, and resolved by jurisdiction plus deal type with an auditable trail.

**Rollback:** Knowledge layer additive; existing hardcoded engine untouched.

**Must not be touched yet:** Legal content authoring at scale, CMS UI beyond minimal admin needs.

**Completion gate:** One sample rule set loads, resolves, versions, and cites correctly end to end in a test harness.

### Phase E, Analysis Generalization

**Objective:** Convert the freelance engine into a pluggable architecture and resolve the generic AI-only contradiction without inventing a universal legal scorer.

**Scope:** Rule registration and execution per deal type; evidence mapping with source spans and rule IDs; AI synthesis boundaries; graceful unsupported-framework behavior (limited findings plus uncertainty plus context requests plus professional review recommendation).

**Dependencies:** Phases B, C, D.

**Areas affected:** `src/lib/risk/engine.ts`, `src/lib/ai/risk-analysis.ts`, `src/lib/ai/extract.ts`, `src/components/audit/risk-report.tsx`, `src/components/audit/generic-risk-report.tsx`.

**Prerequisites:** Decision gate: generic mode target behavior (recommendation is lightweight contract-quality rules plus graceful degradation, not AI-only scoring).

**Outputs:** Pluggable analyzer registry; freelance engine migrated as the first plugin with identical outputs; generic path replaced by limited analysis plus uncertainty handling; evidence model with source spans and rule IDs.

**Tests:** Freelance regression suite must pass byte-equivalent outputs before and after. Generic degraded-path tests for empty, trivial, and framework-less inputs. AI boundary tests (malformed output, timeout, hallucinated evidence rejected).

**Security requirements:** No new privileged paths. AI outputs validated against schemas before use.

**Migration requirements:** None to the database. Code-level migration with coexistence: old and new paths run side by side behind the registry until equivalence is proven.

**Acceptance criteria:** Freelance outputs unchanged. Generic no longer invents risk scores. Unsupported inputs produce explicit uncertainty plus next steps.

**Rollback:** Registry flag reverts to legacy freelance plus legacy generic paths.

**Must not be touched yet:** New deal-type rule content beyond the generic universals; commerce; execution.

**Completion gate:** Freelance equivalence proven by regression suite; generic contradiction closed by test.

### Phase F, First Additional Deal Type

**Objective:** Prove the generalized architecture with exactly one new deal type.

**Scope:** Full vertical for one type: context requirements, extraction schema and prompt, deterministic rules, evidence mapping, protection outputs, negotiation points, lawyer handoff fields.

**Dependencies:** Phases B through E.

**Areas affected:** New deal-type module; intake UI vocabulary for the new type; workspace branching for the new type; protection outputs for the new type.

**Prerequisites:** Decision gates: which type first (canonical recommendation is lease), jurisdiction coverage, knowledge sourcing for that type.

**Outputs:** One fully working non-freelance deal type with deterministic analysis and appropriate protection outputs.

**Tests:** Full vertical integration tests; regression tests confirming freelance untouched.

**Security requirements:** Same RLS and validation posture as freelance.

**Migration requirements:** Deal-type registry update; possibly widened `deal_type` constraint via forward-only migration.

**Acceptance criteria:** The new type completes intake through protection with evidence-backed findings; freelance suite still green.

**Rollback:** New type flaggable off; freelance unaffected.

**Must not be touched yet:** Second new deal type; execution; commerce.

**Completion gate:** One new type live behind its own flag with passing vertical tests.

### Phase G, Protection Generalization

**Objective:** Generalize negotiation intelligence, clause selection, document generation, and the lawyer handoff package.

**Scope:** Risk-conditioned clause selection; versioned clause library; deal-type-specific templates; document generation boundaries; negotiation intelligence; annotated agreements; structured lawyer handoff.

**Dependencies:** Phases B through F.

**Areas affected:** `src/lib/generate.ts`, `src/components/audit/protection-package.tsx`, negotiation points generation, new clause library module.

**Prerequisites:** At least one non-freelance deal type proven (Phase F).

**Outputs:** Clause library with versioning; template engine per deal type; lawyer handoff package structure.

**Tests:** Template rendering tests; clause selection tests per risk profile; document generation fallback tests.

**Security requirements:** Generated document access stays RLS-scoped; share and sign flows unchanged.

**Migration requirements:** Additive template and clause storage; document versioning preserved.

**Acceptance criteria:** Freelance package output unchanged. New deal type produces appropriate protection outputs. Handoff package contains facts, risk, evidence, uncertainties, and user concerns.

**Rollback:** Legacy freelance generation path retained until equivalence proven.

**Must not be touched yet:** Commerce; execution.

**Completion gate:** Protection outputs verified per supported deal type with regression suite green.

### Phase H, Professional Review

**Objective:** Build the managed lawyer capability as a workflow inside Dealenz, not a marketplace.

**Scope:** Structured handoff, lawyer workspace, review lifecycle, annotations, opinion and advice capture, user communication, privacy and TTL, governance gate for feedback-to-knowledge promotion.

**Dependencies:** Phases B through G (needs structured intelligence and protection outputs to hand off).

**Areas affected:** Existing waitlist and consultation flow generalized; new lawyer workspace; handoff package builder; opinion schema.

**Prerequisites:** Decision gates: legal operating model, lawyer compensation, liability model, confidentiality and privilege structure, professional-service payment rail.

**Outputs:** End-to-end managed review flow with structured handoff and structured opinion; governance gate preventing auto-promotion of opinions to rules.

**Tests:** Handoff completeness tests; access boundary tests (lawyer sees only assigned case); TTL enforcement tests; governance gate tests.

**Security requirements:** Lawyer access scoped to assigned cases with expiry; explicit user consent for handoff; audit trail on all lawyer access.

**Migration requirements:** Extend `consultation_requests` and add opinion and annotation storage via additive migrations.

**Acceptance criteria:** A user can request review, a lawyer receives the full structured package, delivers a structured opinion, and no opinion becomes a global rule without expert validation.

**Rollback:** Waitlist mode retained as fallback.

**Must not be touched yet:** Marketplace features (browsing, comparison, messaging outside workflow).

**Completion gate:** Full review loop demonstrated with governance gate enforced by test.

### Phase I, Credits and Commerce

**Objective:** Introduce workload-based credits with an auditable ledger and a provider-agnostic payment adapter.

**Scope:** Credit accounts, immutable ledger, credit packages, purchases, grants, refunds, reservations, consumption, workload assessment with estimated ranges, provider abstraction, webhooks, reconciliation, software versus professional-service separation.

**Dependencies:** Identity and auth (exists), workload instrumentation hooks in intake and analysis (additive).

**Areas affected:** New commerce domain; billing UI replacement; usage tracking migration path; payment adapter.

**Prerequisites:** Decision gates: payment provider choice, professional-service payment rail, credit economics model (ranges, not frozen formula), rollover and refund policy.

**Outputs:** Working credit purchase and consumption with ledger auditability; workload estimates shown before confirmation; provider adapter with one live provider.

**Tests:** Ledger integrity tests (double-entry invariants); reservation and consumption tests; refund tests; webhook idempotency tests; RLS tests on ledger.

**Security requirements:** Ledger append-only; service-role writes only via constrained RPCs; user reads scoped to own ledger; webhook signature verification.

**Migration requirements:** New commerce tables; migrate existing `usage_tracking` history to ledger events or archive it read-only.

**Acceptance criteria:** Credits purchasable, consumable, refundable, and auditable; workload estimates shown pre-confirmation; provider swappable behind the adapter.

**Rollback:** Free-plan rate limiting retained until commerce passes reconciliation tests.

**Must not be touched yet:** Execution monetization specifics beyond hooks.

**Completion gate:** Live purchase-to-consumption-to-ledger loop reconciles to zero drift.

### Phase J, Deal Execution

**Objective:** Extend the lifecycle past signing with obligations, change management, monitoring, and relationship intelligence.

**Scope:** Signed deal state, obligation extraction, milestones, deliverables, payments, deadlines, changes and change orders, amendments, renewals, disputes and escalation, monitoring, relationship and deal history.

**Dependencies:** Intelligence, protection, and signed state. Professional review may intersect but execution must not require a lawyer.

**Areas affected:** New execution domain; document versioning relationship to amendments; dashboard surfaces for obligations and deadlines.

**Prerequisites:** Protection package stable per supported deal type.

**Outputs:** Obligation tracking, change order flow, monitoring alerts, renewal and dispute entry points.

**Tests:** Obligation extraction tests; change order lifecycle tests; monitoring trigger tests.

**Security requirements:** Same RLS posture; execution data scoped to deal owner.

**Migration requirements:** New execution tables, additive.

**Acceptance criteria:** A signed freelance deal yields trackable obligations and a working change order loop.

**Rollback:** Execution additive; intelligence and protection unaffected.

**Must not be touched yet:** Cross-user relationship intelligence until volume and consent model are resolved.

**Completion gate:** One deal type demonstrates sign-to-monitor loop.

### Phase K, Trust, Governance, and Production Hardening

**Objective:** Close the remaining trust, compliance, and operational gaps.

**Scope:** Privacy, terms, AI disclosure, legal scope disclaimer, retention and deletion, professional-service terms, auditability, observability (error tracking, uptime, AI fallback alerting), backup and recovery posture, 2FA where justified, provider data handling, operational controls.

**Dependencies:** All prior phases for complete coverage; can start research and policy drafting in parallel earlier.

**Areas affected:** Policy pages, retention jobs, observability wiring, auth hardening.

**Prerequisites:** Decision gates: retention policy, backup RPO and RTO, 2FA scope.

**Outputs:** Published policies reflected in product behavior; retention and deletion working; observability alerting on AI fallback rate; backup posture documented.

**Tests:** Retention and deletion tests; audit trail tests; alerting tests.

**Security requirements:** This phase is security and compliance work.

**Migration requirements:** Only as needed for retention (tombstoning vs hard delete).

**Acceptance criteria:** Launch blockers from section 16 cleared; hardening items scheduled; later items explicitly deferred with owners.

**Rollback:** Policy and observability changes are additive.

**Must not be touched yet:** Nothing; this is the final hardening pass.

**Completion gate:** Launch blocker list empty; hardening list owned and scheduled.

## 7. High-Risk Refactor Migration Plans

### `src/lib/risk/engine.ts`
1. **Wrong today:** 8 hardcoded freelance categories and freelance-specific regex patterns in one file.
2. **Behavior to preserve:** Identical freelance scores, severities, findings, mitigations, and summary for all existing inputs.
3. **Target responsibility:** Plugin host plus rule execution utilities only; category and rule content moves into deal-type modules.
4. **Extract first:** Pure helpers (`severityFromScore`, `clampScore`, `matchSignals`, `generateSummary`) into a shared rules utility.
5. **Tests required:** Golden-file regression suite over representative freelance inputs before any move.
6. **Coexistence:** Legacy engine and new registry run side by side; registry delegates freelance to the legacy implementation initially.
7. **Safest order:** Extract helpers, then move one category at a time behind the registry, verifying equivalence each step.
8. **Deletion criteria:** Legacy file removed only after the registry produces byte-equivalent freelance outputs across the golden suite.

### `src/lib/ai/risk-analysis.ts`
1. **Wrong today:** Generic path (`analyzeGenericRiskWithVisibleFailure`) performs AI-only scoring with no deterministic fallback and throws on failure.
2. **Behavior to preserve:** Freelance AI path plus deterministic fallback; generic response shape for existing callers during transition.
3. **Target responsibility:** Thin orchestration over the analyzer registry; no scoring logic inline.
4. **Extract first:** Response parsing and output transformation helpers.
5. **Tests required:** AI failure tests (timeout, malformed output, hallucinated categories rejected), generic degraded-path tests.
6. **Coexistence:** Legacy functions remain until the registry routes all callers.
7. **Safest order:** Add registry plus generic degraded path first; migrate freelance routing; then remove legacy branching.
8. **Deletion criteria:** No direct callers of legacy functions remain; generic contradiction closed by test.

### `src/lib/ai/extract.ts`
1. **Wrong today:** Two hardcoded prompts selected by a binary conditional; validation thresholds inline.
2. **Behavior to preserve:** Current freelance and generic extraction outputs for existing inputs.
3. **Target responsibility:** Extraction orchestration over a deal-type-aware prompt and schema registry.
4. **Extract first:** JSON parsing, response coercion, and the validation function as standalone tested units.
5. **Tests required:** Schema validation tests, malformed output tests, insufficient-input tests per deal type.
6. **Coexistence:** Registry delegates to existing prompts initially.
7. **Safest order:** Extract validation and parsing helpers; then registry-backed prompt selection.
8. **Deletion criteria:** All prompt selection flows through the registry.

### `src/lib/generate.ts`
1. **Wrong today:** Hardcoded freelance document types and risk-conditioned clause logic inline across 299 lines.
2. **Behavior to preserve:** Current freelance proposal, SOW, contract, and checklist outputs.
3. **Target responsibility:** Orchestration over a template engine plus clause library; per-document AI with template fallback preserved as a pattern.
4. **Extract first:** Template rendering helpers and clause selection functions.
5. **Tests required:** Golden-file tests per document before and after extraction.
6. **Coexistence:** Freelance templates remain the default while the engine is extracted around them.
7. **Safest order:** Extract clause helpers, then template registry, then per-deal-type templates.
8. **Deletion criteria:** No hardcoded freelance strings remain in orchestration logic.

### `src/app/audit/[id]/actions.ts`
1. **Wrong today:** 1215-line monolith covering intake persistence, file handling, analysis orchestration, protection generation, sharing, checklist, business profile, and logging.
2. **Behavior to preserve:** Every Server Action contract and RLS posture.
3. **Target responsibility:** Thin action handlers delegating to domain services (intake service, analysis service, protection service).
4. **Extract first:** Pure helpers (UUID validation, field whitelisting, business profile merge) into tested units.
5. **Tests required:** Existing `actions.test.ts` green; add per-service unit tests before extraction.
6. **Coexistence:** Extract services behind identical action signatures; callers unchanged.
7. **Safest order:** Helpers, then file handling, then analysis orchestration, then protection orchestration.
8. **Deletion criteria:** File contains only thin handlers; all logic lives in tested domain services.

### `src/components/audit/workspace-client.tsx`
1. **Wrong today:** 830-line client component holding intake, analysis, protection, timeline, and lawyer escalation state.
2. **Behavior to preserve:** Stage transitions, save behavior, analysis flow, document flow, escalation flow.
3. **Target responsibility:** Composition shell over stage components with explicit state machine.
4. **Extract first:** Stage derivation logic and timeline mapping into tested hooks.
5. **Tests required:** Stage transition tests; regression tests per stage before extraction.
6. **Coexistence:** Extract one stage panel at a time; shell unchanged.
7. **Safest order:** Timeline mapping, then intake panel, then report panel, then protection panel.
8. **Deletion criteria:** File under a strict size budget with all panels extracted.

### `src/components/audit/protection-package.tsx`
1. **Wrong today:** Hardcoded freelance tabs (proposal, SOW, contract, checklist) plus sharing, PDF, regeneration, and review tracking in one component.
2. **Behavior to preserve:** Tab behavior, share and sign flows, PDF export, regeneration, review tracking.
3. **Target responsibility:** Generic document tab shell driven by a deal-type output registry.
4. **Extract first:** Share status logic and review tracking hooks.
5. **Tests required:** Tab and share flow tests before extraction.
6. **Coexistence:** Freelance tab set remains the default registry entry.
7. **Safest order:** Extract share and review hooks, then tab registry, then per-type outputs.
8. **Deletion criteria:** No hardcoded document type lists remain.

### `src/app/audit/[id]/consultation-actions.ts`
1. **Wrong today:** Waitlist switch plus basic CRUD, but handoff carries only `auditId` plus note.
2. **Behavior to preserve:** Waitlist versus requested switching, duplicate prevention, ownership checks.
3. **Target responsibility:** Thin actions over a professional review domain service with structured handoff builder.
4. **Extract first:** Handoff package builder as a tested pure function.
5. **Tests required:** Waitlist switch tests, duplicate prevention tests, ownership tests.
6. **Coexistence:** Existing actions unchanged while the handoff builder is added alongside.
7. **Safest order:** Handoff builder, then opinion schema, then lawyer workspace.
8. **Deletion criteria:** Legacy note-only handoff replaced only after structured handoff is proven.

### `src/proxy.ts`
1. **Wrong today:** Nonstandard filename with production behavior to verify.
2. **Behavior to preserve:** Session refresh plus the exact redirect matrix (authenticated root and auth pages to dashboard; unauthenticated protected routes to login).
3. **Target responsibility:** Same behavior under the standard middleware filename if verification fails.
4. **Extract first:** Nothing; this is a verification-then-possibly-rename task.
5. **Tests required:** Existing `src/proxy.test.ts` plus production-build redirect probes.
6. **Coexistence:** Rename only after preview verification; keep the old file until the new one is proven.
7. **Safest order:** Verify production behavior first; rename only if needed.
8. **Deletion criteria:** One canonical middleware file with passing redirect tests in production build.

## 8. Database Migration Strategy

1. **Forward-only always.** All schema changes ship as new numbered migrations. Historical migrations are never edited to make a new environment work.
2. **Protect existing data.** `audits`, `auth.users`, `lawyers`, `consultation_requests`, `document_versions`, and freelance records are never destructively migrated. Additive changes only.
3. **RLS on every new table.** Every new table ships enabled with owner-scoped policies plus explicit admin and lawyer-assignment policies where the domain requires them, mirroring migration `00020_lawyers_and_consultations.sql`.
4. **Constraint widening is explicit.** Widening `audits.deal_type` beyond `freelance` and `generic` requires its own migration with data validation, not a silent edit of migration `00019_add_deal_type.sql`.
5. **New domains get new tables.** Context envelopes, knowledge rules, clause library entries, credit ledger entries, obligations, change orders, and lawyer opinions each get dedicated tables. No stuffing new domains into `structured_data` JSONB beyond transitional carriers.
6. **Rollback means compensating migration.** Supabase has no down-migration convention in this repo; every risky migration ships with a documented compensating migration plan.
7. **Seed data is explicit.** No implicit seeds. Any required reference data ships as a clearly labeled seed migration.

### Phase 0 Supabase Bootstrap Detail

1. **Environment verification.** Confirm which file supplies each environment (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `AI_PROVIDER`, `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL`, `NEXT_PUBLIC_APP_URL`). Current finding: `.env.example` documents all of these; `.env.local` exists; **no `.env` file was found** (glob `.env*` returned only `.env.local` and `.env.example`), so the asserted pre-population of `.env` with new canonical credentials is unverified and must be confirmed by a human before implementation.
2. **Migration application.** Apply migrations `00001` through `00020` in order to the new project via `npm run db:migrate` (`package.json:12`, `supabase db push`). Do not recreate schema by hand.
3. **Ordering and dependency review.** Known RPC and policy dependencies: `increment_usage` (`00004_usage_tracking.sql:21`, fixed in `00018_fix_rate_limit.sql:11`), share and sign RPCs (`00013_share_and_sign.sql:61,128`), storage policies (`00014_storage_rls.sql`, `00002_expand_audits.sql`), deal-type constraint (`00019`), lawyers and consultations (`00020`). No `CREATE EXTENSION` statements were found in migrations.
4. **Schema verification checklist.** Tables, enums (`lawyer_verification_status`, `consultation_status`), foreign keys, indexes, constraints, functions and RPCs, triggers (none found in inspected migrations), RLS enablement per table, RLS policies per table, storage buckets and storage policies, auth dependencies.
5. **Old-project reference audit.** No hardcoded `supabase.co` URLs were found in `src`. `NEXT_PUBLIC_APP_URL` is referenced with a localhost guard in `src/app/audit/[id]/actions.ts:894-904`. The old paused project ref is known from workspace history, not from current file evidence, and must be confirmed retired. Any documentation referencing the old project is historical only.
6. **Data migration decision.** Default: treat the new project as a clean canonical environment initialized from migrations. No old data is migrated unless a written requirement with owner and scope exists.

## 9. Testing Strategy

### Unit Tests (new, required before refactors)
- Context inference and validation; extraction response coercion and validation thresholds; rule evaluation per category; evidence mapping (source span plus rule ID); workload factor computation (no frozen formula, test the plumbing); credit ledger invariants (append-only, balance reconciliation); authorization helpers.

### Integration Tests
- Full freelance analysis flow (intake through risk report); document generation with per-document fallback; anonymous Quick Review flow including rate limiting and insufficient-input handling; protection generation; professional handoff package completeness; credit reservation through consumption.

### Database and RLS Tests
- Ownership (own rows readable and writable); cross-user denial; anonymous denial on private tables; lawyer assignment boundaries (assigned cases visible, others denied); service-role RPC behavior for `increment_usage`, `get_shared_document`, `sign_shared_document`; ledger integrity (no negative balances except defined refund paths, reconciliation to zero drift).

### Regression Tests (blocking for every refactor)
- Golden-file freelance extraction outputs, risk reports, and all four documents across representative inputs. No high-risk refactor merges with a red freelance suite.

### AI Tests
- Malformed model output rejected; provider timeout handled; unsupported analysis produces degraded path instead of invented scores; hallucinated evidence (no source span) rejected; authority-boundary violations flagged (score assignment, legal determination, invented categories).

## 10. CI and CD Strategy

1. Wire `npm test` to run the existing 3 test files (`src/proxy.test.ts`, `src/app/login/actions.test.ts`, `src/app/audit/[id]/actions.test.ts`), then extend coverage per section 9.
2. Every push runs lint (`package.json:9`), typecheck, build, and tests.
3. Migration verification: apply migrations to a clean ephemeral project and run RLS checks before merge.
4. Deployment checks: production-build redirect probes for the proxy middleware matrix; environment presence checks for required public vars without printing secret values.

## 11. Parallel Work

Safe to run alongside core pipeline work because the dependency analysis shows no conflicts:

- Security hardening research and non-blocking fixes (CSP tightening research, log redaction patterns)
- Knowledge sourcing research (legal publisher outreach, rule curation process design)
- Payment provider research (Stripe, Paystack, Lemon Squeezy evaluation against international-first criteria)
- Legal operating model research (lawyer relationship, compensation, liability, privilege structure)
- UI and design-system work (shared primitives, empty states, uncertainty presentation patterns)
- Testing infrastructure (harness, fixtures, golden files, RLS test helpers)
- Execution domain research (obligation models, change order patterns)
- Documentation and policy research (retention, AI disclosure, professional-service terms)

Research tracks must not merge implementation code. Implementation tracks stay on the dependency graph in section 13.

## 12. Decision Gates

| Decision | Why it matters | Must resolve before | Current status | Owner and type |
|---|---|---|---|---|
| New canonical Supabase project verified | All implementation depends on the backend | Phase A and everything after | OPEN, blocking | Founder, infrastructure |
| Old project retired or retained read-only | Prevents split-brain data and auth | Phase 0 gate | OPEN, blocking | Founder, infrastructure |
| Production proxy behavior | Auth guarding must work in production | Phase A completion | OPEN, blocking | Engineering, infrastructure |
| First additional deal type | Sets knowledge, context, and protection scope | Phase F | OPEN, recommendation is lease | Product |
| Knowledge sourcing strategy | Determines knowledge layer build | Phase D | OPEN | Product and legal |
| Jurisdiction coverage v1 | Determines rule and practice scope | Phase D | OPEN, recommendation is explicit list | Product and legal |
| Rule representation | Determines engine implementation | Phase E | OPEN, recommendation is TypeScript plus Zod | Architecture |
| Generic mode target behavior | Closes the AI-only contradiction | Phase E | OPEN, recommendation is lightweight universals plus degradation | Product and architecture |
| Legal operating model (lawyer relationship) | Determines workflow and compliance | Phase H | OPEN | Business and legal |
| Lawyer compensation model | Determines commerce shape | Phase H and I | OPEN | Business |
| Liability model (Dealenz vs lawyer) | Determines terms and workflow | Phase H | OPEN | Legal |
| Confidentiality and privilege structure | Determines handoff and TTL design | Phase H | OPEN | Legal |
| Payment provider choice | Determines adapter implementation | Phase I | OPEN, research only | Business and engineering |
| Professional-service payment rail | May differ from software credits rail | Phase I | OPEN | Business and finance |
| Credit economics (ranges, rollover, refunds) | Determines ledger and UX | Phase I | OPEN, formula explicitly not frozen | Business |
| AI provider strategy beyond current two | Cost, reliability, fallback posture | Ongoing | OPEN, current abstraction sufficient | Engineering |
| Background processing need | Document generation latency at scale | Phase G or J | OPEN, investigate under load | Architecture |
| Observability stack | Production readiness | Phase K | OPEN | Engineering |
| Data retention policy | Legal compliance and storage | Phase K, needed before real user data | OPEN | Legal |
| Backup RPO and RTO | Recovery posture | Phase K | OPEN | Infrastructure |

## 13. Dependency Graph

```text
Phase 0: Canonical Supabase Verified
  |
  +---> Phase A: Security Foundation (proxy, RLS, error hygiene, logging)
  |       |
  |       +---> Phase B: Domain Generalization (registry, shared model)
  |                 |
  |                 +---> Phase C: Context Resolution
  |                 |         |
  |                 |         +---> Phase D: Knowledge Foundation
  |                 |                   |
  |                 |                   +---> Phase E: Analysis Generalization
  |                 |                             (includes generic-path resolution)
  |                 |                             |
  |                 |                             +---> Phase F: First New Deal Type
  |                 |                                       |
  |                 |                                       +---> Phase G: Protection
  |                 |                                                 |
  |                 |                                                 +---> Phase H: Professional Review
  |                 |
  |                 +---> (Phase C also feeds Protection directly for context-aware clauses)
  |
  +---> Phase I: Credits and Commerce (needs Identity; workload hooks from Intake/Analysis)
  |       |
  |       +---> professional-service commerce (needs Phase H decisions)
  |
  +---> Phase J: Deal Execution (needs Intelligence + Protection + signed state;
  |       lawyer optional, never required)
  |
  +---> Phase K: Trust, Governance, Hardening (cross-cutting; completes last)

Cross-cutting throughout: Trust and Governance, Testing, CI and CD.
Parallel research tracks: knowledge sourcing, payment research, legal operating model,
execution research, UI system work (no implementation merges until gates pass).
```

Correction to any linear reading: context and knowledge are mutually informative (knowledge tells the system which context is required; context selects which knowledge applies). The graph above orders context UI before knowledge population because resolution UX can be built against stubbed applicability metadata, but the knowledge content and context requirements must be co-designed, not frozen independently.

## 14. Existing Value Protection Matrix

| Existing capability | Must preserve | Migration strategy | Regression test | Planned replacement or generalization |
|---|---|---|---|---|
| Freelance intake (paste, upload, form) | Yes | Wrap in intake service with identical contracts | Golden inputs through intake | Shared intake service |
| Extraction pipeline | Yes | Extract parsing and validation helpers; registry-backed prompts | Golden extraction outputs | Deal-type prompt registry |
| Deterministic freelance risk engine | Yes | Extract helpers; move categories behind registry one at a time | Byte-equivalent golden reports | Pluggable rule engine |
| Protection package (4 docs) | Yes | Extract clause helpers; template registry around current templates | Golden documents | Deal-type template engine |
| PDF export | Yes | Unchanged until engine extraction complete | Export smoke tests | None planned |
| Sharing and e-sign | Yes | Unchanged; RPC posture reviewed | Share, sign, revoke tests | None planned |
| Anonymous Quick Review | Yes | Unchanged; error hygiene only | Rate limit, validation, report tests | Workload hooks added later |
| Landing page | Yes | Unchanged | Visual regression (manual until harness) | None planned |
| Authentication and RLS | Yes | Unchanged; hardening only | Cross-user denial tests | None planned |
| Lawyer application and verification | Yes | Unchanged until workflow phase | Application, verify, reject tests | Structured workflow later |
| Consultation request flow (waitlist switch) | Yes | Unchanged until handoff phase | Waitlist vs requested tests | Structured handoff later |
| Rate limiting (`usage_tracking`) | Yes | Review access model; keep limits | Limit enforcement tests | Credit ledger later (migration path defined) |

## 15. Risk Register

| Risk | Likelihood | Impact | Mitigation | Dependency | Trigger | Fallback |
|---|---|---|---|---|---|---|
| Generic AI-only scoring ships authority violations | High (exists today) | High (trust, legal exposure) | Phase E replaces with degraded path plus lightweight rules; add boundary tests now | Phase E | Any new deal type without rules | Degraded path: limited findings plus uncertainty plus review recommendation |
| Freelance regression during generalization | Medium | High (core revenue path) | Golden suite before any refactor; coexistence flags; no deletion until equivalence | Phase B, E, G | Golden suite red | Revert flag to legacy path |
| Proxy middleware fails in production | Medium | High (auth bypass or lockout) | Phase A production-build probes; standard filename migration if needed | Phase A | Probe failure | Pin to verified middleware file |
| `usage_tracking` bypass | Medium | Medium (cost overrun) | RLS review plus RPC-only writes plus tests | Phase A | Direct table write succeeds | Restrict to RPC; revoke direct grants |
| Deal content in logs | High (exists) | Medium (privacy) | Redact deal text; log metadata only | Phase A | Log contains input text | Redaction filter plus retention rule |
| Anonymous error leakage | High (exists at `route.ts:149`) | Medium (internals exposed) | Sanitize anonymous errors | Phase A | Internals in response | Generic failure message |
| Knowledge content never sourced | Medium | High (blocks authoritative analysis) | Sourcing decision gate in Phase D; degraded path meanwhile | Phase D gate | No sourcing decision | Stay in degraded mode; do not invent rules |
| Lawyer workflow without operating model | Medium | High (liability, compliance) | Gate Phase H on legal and business decisions | Phase H gates | Missing liability model | Waitlist only; no live reviews |
| Credit economics mispriced | Medium | Medium (margin loss or churn) | Evolvable workload model; reconciliation alerts; no frozen formula | Phase I | Ledger drift | Adjust factors; honor existing balances |
| Payment provider lock-in | Low | Medium (migration cost) | Adapter pattern from day one; no provider logic in domain | Phase I | Provider-specific fields in domain | Adapter extraction refactor |
| Background job absence causes timeouts | Medium | Medium (latency, failures) | Timeouts plus fallbacks exist; queue evaluated under load | Phase G or J | P95 growth | Introduce queue for generation |
| Dependency vulnerabilities | High (known) | Medium (security) | Patch branch with full build and typecheck | Phase A or K | Audit report | Pin and schedule |
| Data retention noncompliance | Medium | High (legal) | Retention decision before real user data; tombstone design | Phase K | Real user data without policy | Freeze launch of retention-sensitive features |
| New Supabase project misconfigured | Medium | High (all phases blocked or insecure) | Phase 0 gate with per-environment checks | Phase 0 | Gate failure | No implementation proceeds |

## 16. Launch Blockers vs Hardening vs Later

**Launch blockers** (must resolve before any production launch depending on them):
- Phase 0 `NEW SUPABASE PROJECT VERIFIED` gate
- Production proxy behavior proven
- Generic AI-only contradiction resolved (degraded path live)
- `usage_tracking` access model secured
- Anonymous error responses sanitized
- Deal content removed from logs or retention explicitly accepted
- Data retention policy decided before real user data
- Professional-service terms and liability model decided before live lawyer reviews

**Important hardening** (do during implementation, not after):
- CSP tightening research and nonce migration
- 2FA scoping for accounts touching money or signatures
- Secret rotation cadence
- AI fallback rate alerting (signal already logged as `risk_fallback`)
- RLS test suite in CI
- Migration verification in CI

**Later improvements** (explicitly deferred):
- Second and third deal types beyond the first
- Full execution layer (obligations, change orders, monitoring)
- Relationship intelligence across counterparties
- Advanced caching beyond static libraries
- Multi-provider AI orchestration beyond the current two adapters

## 17. Open Questions

1. Which deal type comes first after freelance (recommendation stands at lease, still to confirm)?
2. Who sources legal knowledge, and under what license and review process?
3. Which jurisdictions are explicitly supported at each stage?
4. TypeScript plus Zod schemas versus a rule DSL, and at what rule count does that change?
5. Per-consultation versus subscription versus revenue share for lawyer compensation?
6. Separate payment rail for professional services, or one rail for everything?
7. Credit economics: initial ranges, rollover, refunds, team pooling?
8. Payment provider choice against international-first criteria?
9. Background processing: at what measured latency does document generation move to a queue?
10. Observability stack: error tracking, uptime, alerting choices?
11. Data retention periods per data class?
12. Backup RPO and RTO commitments?
13. 2FA scope: all users or money and signature paths only?
14. Context confirmation UX budget: how many fields before fatigue, and which are truly blocking?
15. Professional liability allocation between Dealenz and reviewing lawyers?
16. Confidentiality and privilege structure for lawyer handoff content and notes?

## 18. Recommended Immediate Next Step

1. Resolve the Supabase prerequisite: confirm the new project, wire environments per Phase 0, and pass the `NEW SUPABASE PROJECT VERIFIED` gate. Nothing that touches the database proceeds until this passes.
2. In parallel, run the decision-gate research that unblocks Phase D and Phase F: knowledge sourcing options, jurisdiction coverage v1, and first-deal-type confirmation.
3. Then execute Phase A security foundation, with the freelance golden regression suite built first so every later refactor has a safety net.
4. Do not start deal-type content, knowledge population, commerce implementation, or execution until Phases 0 through B gates pass.

## 19. Final Implementation Order

```text
0. Canonical Supabase Backend Verification (prerequisite gate)
1. Foundation and Security (proxy, RLS, error hygiene, logging)
2. Domain Generalization (registry, shared model, boundaries)
3. Context Resolution (inference, confirmation, confidence)
4. Knowledge Foundation (minimal viable store plus governance)
5. Analysis Generalization (pluggable engine plus generic-path resolution)
6. First New Deal Type (one vertical proving the stack)
7. Protection Generalization (clauses, templates, handoff package)
8. Professional Review (workflow, governance gate, privacy and TTL)
9. Credits and Commerce (ledger, workload, provider adapter)
10. Execution (obligations, changes, monitoring)
11. Trust, Governance, and Production Hardening (policies, retention, observability, compliance)
```

Security and governance verification runs cross-cutting throughout; Phase 11 closes whatever remains.

## Phase 3 Status

Status: COMPLETE

Code Changes: NONE

Next Phase: Phase 4, Supabase verification execution followed by security foundation implementation, each gated as defined above.

Phase 4 may begin only after reviewing and accepting this plan.
