# Dealenz Ground-Truth Audit — 2026-09-12

## Summary

The codebase is healthy and substantially matches the product ambition: 140 test files / 1070 tests pass, TypeScript and ESLint are clean, all 7 deal verticals are wired through a single dispatcher, commerce is real (Lemon Squeezy HMAC webhook → idempotent ledger), and the AI/security boundaries from prior phases are intact in code. The biggest surprise vs `product.md` is that the `CURRENTLY OBSERVED` section is stale on facts, not vision: it claims 33–35 migrations (there are 50 files, `00001`–`00048` + 3 drafts), old design tokens (`#F2F0ED`, glass-extreme as current), and an in-memory anonymous limiter that was replaced by a Postgres-backed one. The single highest-priority gap is external, not internal: no live verification exists for provider calls, webhooks, RLS, or OAuth against real credentials — everything green is static or mocked.

## Verified Claims

- **7 verticals wired end to end through one dispatcher.** `src/lib/verticals/index.ts:14-60` imports facts/rules/knowledge for freelance, lease, purchase_sale, employment, founder, partnership, generic. Rule counts (actual `ruleKey:` definitions): freelance 9, lease 9, purchase_sale 8, employment 8, founder 8, partnership 8, generic 7.
- **`canGenerateDocuments` boundary is real.** `src/lib/protection/index.ts` (`DOCUMENT_GENERATION_SUPPORTED = ["freelance"]`); founder/partnership/purchase_sale/lease/employment route to `src/lib/documents` families, never `src/lib/generate.ts`; honest unavailable messages per type.
- **Founder/Partnership depth is real.** 8 `founder-*` + 8 `partnership-*` clause IDs (`src/lib/protection/clauses.ts`, counted); LLP/LP/ordinary structure awareness in templates (clauses.ts:190,205,220,237,250,294); `ProtectionIntent` carries priority/rationale/legalContext/variables/status (`src/lib/protection/intents.ts:42-59`); missing vars stay UNKNOWN (`clauses.ts:5`).
- **Document assembly is jurisdiction-aware.** `src/lib/documents/assembly.ts:36-48` (Testland-neutral branch line 39; Nigeria/US/UK/EU/DE/FR/NL set line 42; no-Nigeria-leak comment line 48); families `founder-agreement`, `llp-agreement`, `purchase-terms-sheet`, `lease-terms-summary`, `employment-terms-summary` (`src/lib/documents/families.ts:13,78,116,130,145`); `generateBusinessOwnerDraft` exists (`src/app/audit/[id]/actions.ts:1018`).
- **Lawyer handoff is wired.** CTA + `LawyerHandoffReview` + `buildHandoffPackage` in `src/components/audit/workspace-client.tsx:35,43,148-150,476`; `handoff_snapshot` written with pre-migration fallback (`consultation-actions.ts:109,123-124`); waitlist-vs-requested branching on verified-lawyer count (`consultation-actions.ts:90-96`); auto-assign RPC + sync-back-to-waitlist logic (`consultation-actions.ts:44-54`, tested lines 105-130).
- **Referrals persist + reward is set.** Attribution lifecycle pending→qualified→rewarded with `no_self_referral` check (`00033_referral_system.sql:8-27`); reward grant `v_amount := 5` (`00033:159,190`) matching `REFERRAL_REWARD_CREDITS = 5` (`src/lib/referrals/policy.ts:10`); still flagged provisional in both places, as the doc says.
- **Lemon Squeezy is real, not a stub.** HMAC-SHA256 verification (`src/lib/billing/provider.ts:12,86-88`); variant resolution, amount floor, idempotent `purchase:<tx>` grants (verified in prior phase: 10 webhook tests covering replay/repair/refund-observe-only). No Stripe in live path; no Paystack code.
- **All three AI adapters are implemented.** Gemini, OpenAI-compatible, Anthropic (`Messages API`, `anthropic-version` header, `src/lib/ai/providers/anthropic.ts:2,104-127`). Surface routing: authenticated defaults to Anthropic/Sonnet-5 (`providers.ts:56-67`), Quick Review independently pinnable (`providers.ts:86-90`); only `analyze-anonymous/route.ts` passes `quick_review`.
- **00035 corpus has real content.** Multi-row INSERT of CAMA sections with PLAC sources, effective dates, deal-type applicability (e.g. `ng-cama-s18`, `ng-cama-s140`); Ask renders citations with title/section/URL/jurisdiction (`ask-client.tsx:30,311-314`) and surfaces research state when empty (lines 332+).
- **Migrations 00034/00035/00036 exist and are forward-only.** All present on disk; additive changes (CHECK widen, nullable column, seed INSERTs).
- **Proxy is registered and gates.** `src/proxy.ts:6` exports `proxy` with route matcher (lines 85-88) covering dashboard/audit/ask/deals/clients/risk-intelligence/templates/billing/lawyer/admin with `/login` redirect; `/view` + `/sign` stay public by design (token-gated RPCs).
- **Google OAuth is explicit linking, not merge-by-email.** `src/app/auth/callback/route.ts:55-73` captures pre/post identities, requires provider `email_verified` or confirmed-email match (`isGoogleIdentityVerified`, lines 28-36).
- **Anonymous limit is server-side: 3/hr** (`ANONYMOUS_LIMIT = 3`, `analyze-anonymous/route.ts:13`, enforced pre-AI-spend line 149+).
- **Design system tokens ship.** Mona Sans Variable, `--star: #FAFAF8`, `glass-extreme(-panel)` utilities (`globals.css:32,61,75,178,186`) and used on the landing (`landing-hero.tsx:29`).
- **Risk engine has 8 categories** with score→severity mapping (`src/lib/risk/engine.ts:20-28`, `severityFromScore`).
- **No skipped/disabled tests.** Zero matches for `.skip(`/`xit(`/`xdescribe(` across `src`.

## Partially True Claims

- **"Founder/Partnership international document generation."** Families + assembly + draft action + UI exist, but Tier-2 verticals have single starter summaries (`purchase-terms-sheet`, `lease-terms-summary`, `employment-terms-summary` are one family each), and purchase/lease/employment use generic extraction/risk, not dedicated AI paths. Wired, but thin.
- **"12 vetted templates."** The templates page renders a library (≈12–13 entries by `id:` count in `src/app/templates/page.tsx:20`), but "vetted" is a process claim no code can prove.
- **Lawyer handoff for freelance.** Verified for Founder/Partnership CTA + panel; the freelance review path (`ReviewPanel`, escalation card) exists but the doc's handoff specifics are founder/partnership-scoped.
- **Google linking "verified."** Logic verified in code; the live OAuth round-trip needs a real Google account and was not exercised.

## False / Stale Claims

- **Migration counts.** Doc says "35" / "34" / "33 forward migrations" (`product.md:618`, `architecture.md:44,480`); the repo has **50 files** (`00001`–`00048` + 3 dated drafts). Stale numbers, not missing work.
- **Design tokens.** Doc claims `#F2F0ED`/`#FDFBF9` + extreme-glass as current (`product.md:625`, `architecture.md:348,487`); the live system is star-white `#FAFAF8` with restrained elevation (UX phase superseded it). Code is coherent; docs lag.
- **Test counts.** "81 files / 600 tests" and "6 Vitest files" (`architecture.md:17,310`) vs actual **140 files / 1070 tests**. Stale.
- **Anonymous limiter "in-memory."** `architecture.md:231,354` describes the old Map design; `src/lib/rate-limit-anon.ts` header documents its replacement (Postgres-backed via `00040`, spoof-resistant IP keying, fail-closed). Stale.
- **Open decision #8 "add Anthropic when needed"** (`product.md:601`, `architecture.md:521`). Done: the Anthropic adapter exists with fallback logic. Stale.
- **"Lawyer Escalation: waitlist + admin UI"** (`architecture.md:484`). Superseded by deterministic auto-assignment (admin is now the exception path). Stale framing.
- **Staged "Lease next" roadmap** (`product.md:587`, `architecture.md:448-449`). Founder/Partnership shipped as Tier 1 instead. Stale plan, not a gap.

## Unverified Claims

- **Live provider behavior.** Adapters are code-complete, but no live call was made: whether current keys/models serve Quick Review vs authenticated flows in production needs a real credentialed run.
- **Live webhook + ledger grant.** Unit-tested with fixtures; needs a real Lemon Squeezy test-mode event against staging.
- **Live RLS/trigger enforcement.** Policies and triggers (`trg_final_document_lock` et al.) are code-verified; needs an authenticated session probe (service-role must not substitute).
- **Proxy in production deployment.** Verified in dev (307 observed previously); production middleware execution needs a deployed-URL check.
- **Google OAuth round-trip, anon limiter under real traffic, referral reward end-to-end.** All need live/staging interaction.
- **"No Nigeria leak" at runtime.** Code paths verified; would need jurisdiction-matrix live runs for full confidence.

## New Gaps Not Yet in product.md

- **None structural.** TODO/FIXME/HACK sweep of `src` is clean (zero matches). The previously flagged dead code (`auth-form.tsx`, `hero-section.tsx`) is already deleted. No load-bearing TODOs found.
- **Doc hygiene is now the gap:** the `CURRENTLY OBSERVED` sections in both docs are the stalest artifact in the repo and will mislead the next agent that trusts them over code.
- **Known-open items confirmed still open:** subscription/pricing decisions, Paystack, refund automation, data-retention policy, SMTP/sender config, deployment target, QA-account strategy for authenticated browser tests.

## Test Suite & Dependency Health

- **Tests: 140 files / 1070 passed, 0 failed** (full `npm test` this session). **TypeScript clean. ESLint 0 errors** (48 warnings). No skipped/disabled tests.
- **Dependencies (prod): 1 high + 1 moderate, 0 critical.** High: `@xmldom/xmldom` (transitive via `mammoth`/docx parsing — server-side document ingestion, worth a patch pass). Moderate: `baseline-browser-mapping` (dev-tooling data, negligible prod exploitability). This is improved from the open "several high-severity" note in the docs, but the xmldom item deserves scheduling since it sits on the upload path.

## Recommended Next Steps

1. **Refresh the `CURRENTLY OBSERVED` sections** (or timestamp them as of a verified commit) — right now they are the most misleading artifact for the next phase; cheap, high-leverage, zero behavior risk.
2. **Patch `@xmldom/xmldom`** on a branch with full build+typecheck — the one high-severity item on an attacker-reachable path (uploaded DOCX).
3. **Stand up staging with real credentials** and run the six live proofs (provider call per surface, webhook test event, RLS session probe, OAuth round-trip, anon-limiter soak, referral attribution) — this is the entire UNVERIFIED list and the only thing standing between the current state and production confidence.
4. **Deepen Tier-2 verticals** (purchase/lease/employment dedicated extraction + families) before any new verticals — the wiring exists, the depth doesn't.
5. **Decide referral-5 and refund automation** — the only live-money logic still flagged provisional.
