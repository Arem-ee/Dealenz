# Dealenz Repository Audit — 2026-09-06

## 1. Executive Summary
- **Verified working:** Auth via Supabase SSR `src/proxy.ts:1` + `src/lib/supabase/server.ts:4`, RLS on all tables, `credit_ledger` `00023` advisory lock, 4 verticals `freelance/lease/purchase_sale/employment` + `generic` lightweight `src/lib/verticals/generic/` (7 rules), evidence EXACT only `src/lib/verticals/observe.ts:203`, conversation `src/lib/conversation/request.ts:148` server-owned bounded, `findings-panel` decision-support `src/components/audit/findings-panel.tsx:64`, full-bleed light `SlideshowPanel.tsx:65` with 5 JPGs, `updateAudit` sanitization `src/app/audit/[id]/actions.ts:136`, atomic `increment_usage` `actions.ts:342`
- **Partial:** `product.md:114` workload-based credits: code is flat `1/3/8` `pricing.ts:22` (provisional, Ask only, analysis free 5/day), not density-based; `context/requirements.ts:15` only `dealType` required, jurisdiction never blocks; `00014` + legacy `00002` storage policies coexisted until `00031` cleanup; Security headers `unsafe-inline` remain
- **Unverified:** Production execution of `src/proxy.ts` (build shows `ƒ Proxy` but prod Vercel not probed), true concurrent `pg_advisory_xact_lock` race, live Anthropic `claude-sonnet-5` fallback, Supabase dashboard `CAPTCHA/leaked-password/Rate Limits/Site URL`, remote CI
- **Missing:** `src/lib/deal-types/` (planned `architecture.md:36`), `src/lib/protection/` clause library, `src/lib/lawyer/` workflow, `src/lib/execution/` obligations, founder/partnership verticals, `database.types.ts` (script `package.json:10` broken)
- **Contradictory:** `architecture.md:304` claims 6 test files, actual 54/412; `architecture.md:223` says no paid tier while `credit_ledger` exists; `architecture.md:169` says `deal_type` check `('freelance','generic')` while `00030` is 5 values

## 2. Repository Identity
```
Repository: C:\Users\USER\Documents\DEALENS (Dealenz, not Dealens)
Branch: master
HEAD: 8279a2b916951e30521bfc506057ef79c437f99c  chore: establish lease expansion baseline (+ 3 ahead of origin/master: ed495bc, b68e0c1, ea9db12)
Working tree: 35 M + 32 U  Phases 11-19 (no reset/revert, no deletion)
Package manager: npm (package-lock.json)
Next.js: ^16.3.3 (package.json:15), React 19.2.4, TypeScript ^5, Supabase 2.108.2 / ssr 0.12.0, Vitest 4.1.9
Database: Supabase Postgres, 34 migrations (00001→00031 + 3 draft 20260903*)
CI: .github/workflows/ci.yml typecheck/lint/test/build with ci-dummy env, no deploy job
```

## 3. Architecture Status Matrix
| Capability | Status | Evidence | Files | Runtime path | Tests | Gap |
|---|---|---|---|---|---|---|
| Auth (Supabase) | VERIFIED IMPLEMENTED | `proxy.ts:1` + `lib/supabase/server.ts:4` `createServerClient` cookie `getAll/setAll`, `proxy.ts:43 getUser()` per request | `src/app/login/page.tsx:29`, `src/app/register/page.tsx:29`, `src/app/audit/[id]/page.tsx:13` | Browser `signInWithPassword` → Supabase `bcrypt` → `proxy` `getSession/getUser` → `auth.uid()` | `login/actions.test.ts` | Session refresh `proxy.ts:33` |
| Dashboard/New Audit | VERIFIED IMPLEMENTED | `src/app/dashboard/page.tsx:96`, `src/app/audit/new/page.tsx`, `DealTypeSelector 5` | `src/app/audit/new/actions.ts:7` `ALLOWED_DEAL_TYPES` 5, `seedEnvelopeForDealType` | `createAudit → /audit/[id]` | — | No pagination |
| Document upload | VERIFIED IMPLEMENTED | `attachFileMetadata` `actions.ts:184` prefix + `eq(user_id)` + `MAX_FILES 10` + `text-extract.ts` pdf-parse/mammoth | `src/components/audit/file-upload.tsx`, `supabase/migrations/00014_storage_rls.sql` | `upload → storage audit-files/{uid}/{audit}/ → extractTextFromBuffer → combinedInput` | — | — |
| Text intake | VERIFIED IMPLEMENTED | `PasteInput`, `GuidedForm`, `raw_input` `MAX_COMBINED 100k` `actions.ts:435` | `src/components/audit/paste-input.tsx` | `raw_input + fileTexts → combinedInput` | — | — |
| Extraction | VERIFIED IMPLEMENTED | `lib/ai/extract.ts:93` `extractProjectData` `GENERIC_PROMPT` vs `EXTRACTION_SYSTEM_PROMPT` `104`, `extractAndValidate:114` `confidence≥0.5 +≥2 fields` | `src/lib/ai/prompts.ts`, `src/app/audit/[id]/actions.ts:473` | `callAISurface("authenticated")` `providers.ts:191` | `extract` mocked in `actions.test.ts` | One extractor, not per-vertical |
| Risk analysis | PARTIALLY IMPLEMENTED | `lib/ai/risk-analysis.ts:124 analyzeRisk` AI 8 categories + `generateRiskReport` fallback; `193 analyzeGenericRiskWithVisibleFailure` AI-only | `src/lib/risk/engine.ts` 8 freelance categories | `analyzeRiskForDealType:205` freelance→`analyzeRisk`, non-freelance→`analyzeGenericRisk` | `ai-surfaces.test.ts` fallback | Generic now deterministic 7 rules + bucket override `actions.ts:597` |
| Findings | VERIFIED IMPLEMENTED | `lib/rules/registry.ts:55 evaluateApplicableRules`, `lib/rules/result.ts:55 evaluateRule` `PASS|FAIL|UNKNOWN`, `evidence/collect.ts:99 attachEvidence` | `src/lib/verticals/*/rules.ts` | `actions.ts:592` `evaluateApplicableRules` → `attachEvidence` → `structured_data.deterministicFindings` → `FindingsPanel` | 55 test files | No numeric scores |
| Protection package | PARTIALLY IMPLEMENTED | `lib/generate.ts:229` sequential `proposal→sow→contract→checklist` + template fallback, `actions.ts:724` freelance-gated “Coming soon for this deal type” | `src/components/audit/protection-package.tsx`, `workspace-client.tsx:682` coming-soon card | `generateProtectionPackage` `actions.ts:742` `checkRateLimit 10/day` | `actions.test.ts:284` | Non-freelance blocked, no annotated agreement |
| Proposal/SOW/Contract/Checklist | VERIFIED IMPLEMENTED | `lib/generate.ts` `generateProposal` etc. | `src/lib/generate.ts` | `generateDocuments` `actions.ts:756` | `actions.test.ts:299` | — |
| PDF generation | VERIFIED IMPLEMENTED | `@react-pdf/renderer ^4.5.1` `package.json:15` | `src/components/audit/pdf-documents.tsx` | `generateDocuments → @react-pdf` | — | — |
| Sharing/signing | VERIFIED IMPLEMENTED | `share_tokens` `00013` `SECURITY DEFINER` `get_shared_document/sign_shared_document` | `src/app/view/[token]/page.tsx`, `src/app/audit/[id]/actions.ts:1005 createShareToken` | `createShareToken` `crypto.randomUUID` 30d expiry `1064` | `actions.test.ts:357` | — |
| Ask/conversation | VERIFIED IMPLEMENTED | `lib/conversation/request.ts:148 answerQuestion` + `store.ts:38` `conversations` `00028`, bounded `slice(-6)` `request.ts:140` + `8000` `store.ts:107` | `src/app/ask/page.tsx:7` `?deal=` validated, `src/components/ask/ask-client.tsx:47` | `ask/actions.ts:102` `authorize→reserve→aiCaller→finalize/void` | `phase11/12.test.ts`, `store.test.ts` | — |
| Quick Review | VERIFIED IMPLEMENTED | `src/app/api/analyze-anonymous/route.ts:18` in-memory `Map ip:fp 3/hr`, `quick_review` surface `providers.ts:78` | `src/components/landing/landing-mini-dashboard.tsx` | `analyzeRiskForDealType(...,quick_review)` | — | Not distributed |
| Lawyer workflow | PRESENT BUT NOT WIRED | Schema `00020` `lawyers`/`consultation_requests` + `src/app/audit/[id]/consultation-actions.ts:43` creates `waitlist` | `src/app/admin/lawyers/page.tsx:108` verify/reject `is_admin` | No handoff bundle, no `src/lib/lawyer/` | — | Planned only |
| Credits | VERIFIED IMPLEMENTED | `credit_ledger 00023` advisory lock, `STANDARD_CREDIT_POLICY 1/3/8` `pricing.ts:30` metering vs reserved `policy.ts:41` | `src/app/billing/page.tsx:76` free analysis + Ask credits | `ask/actions.ts:146 ledger RPC wrapper` | `ledger.test.ts` | Analysis free 5/day via `usage_tracking` `00018`, not ledger (intentional RC) |
| Knowledge | PARTIALLY IMPLEMENTED | `knowledge/schema.ts:124` strict, `resolver.ts:51`, `corpus.ts:38` 3 freelance items, `store.ts:91` RLS published | `src/lib/knowledge/*`, `00022` + `00026` seed | `actions.ts:365` best-effort `[]` | `knowledge/store.test.ts` | Lease/purchase/employment empty `GENERIC_KNOWLEDGE_KEYS=[]` |
| Evidence | VERIFIED IMPLEMENTED | `evidence/schema.ts:42` + `observe.ts:192` `exact` only `raw_input+inspectable` + `collect.ts:99` only FAIL + `inspect.ts:93` + `evidence-actions.ts:89` | `src/components/evidence/*`, `src/components/audit/findings-panel.tsx:64` `EXACT/APPROXIMATE/UNAVAILABLE` | `attachEvidence` → `Finding.evidence` → `DocumentViewerModal` | `evidence/inspect.test.ts` | No DB |
| Context resolution | VERIFIED IMPLEMENTED | `context/schema.ts:24` 13 fields, `requirements.ts:15` only `dealType` required for all 5, `gate.ts:25` 3-state, `inference.ts` | `src/components/audit/context-panel.tsx`, `actions.ts:351 gateCheck` | `seedEnvelopeForDealType` + `ensureContextForAnalysis` | `context/gate.test.ts` | Gate always READY after seed |
| Vertical routing | VERIFIED IMPLEMENTED | `verticals/index.ts:61` `verticalForDealType` single, `PACKS 5` | `src/lib/verticals/freelance,lease,purchase_sale,employment,generic` | `actions.ts:570 vertical.registerPack()` + `store.ts` | `verticals/index.test.ts` 5 packs | Founder missing |

## 4. Runtime Architecture Map
```text
UI (src/app/{page,ask,login,register,audit/[id]/page, dashboard, deals} + src/components/{audit/workspace-client,landing,auth/SlideshowPanel})
↓ Server Component (page.tsx:13 getUser) / Client Component (workspace-client.tsx:100) 
↓ Server Action / Route Handler (src/app/audit/[id]/actions.ts:290 analyzeDeal, 742 generateProtectionPackage, 109 updateAudit, 184 attachFileMetadata / src/app/api/analyze-anonymous/route.ts:45)
↓ Domain: Context (context/schema:24 + gate:25 + requirements:15) → Knowledge (knowledge/store:91 → resolver:51 → applicability:44) → Vertical dispatch (verticals/index:61) → Facts (verticals/*/facts.ts via observe:192) → Rules (rules/registry:55 evaluateApplicableRules, result:55) → Evidence (evidence/collect:99 attachEvidence, schema:42) → Deterministic Findings
↓ AI (providers:78 resolveSurfaceConfig, 191 callAIForSurface, 214 callAI) → Risk (risk-analysis:124 analyzeRisk + 193 analyzeGeneric → bucket override actions:597) → Synthesis (negotiation + conversation request:148) → Constitution (ai/constitution:77) → Usage (ai/usage:26)
↓ Supabase (auth, Postgres RLS, storage audit-files/{uid}/{audit}/, credit_ledger 00023 advisory lock, usage_tracking 00004/00018, conversations 00028, knowledge_items 00022)
↓ Response (RiskReport/GenericRiskReport + deterministicFindings → workspace FindingsPanel / Ask sources)
```

## 5. Deal-Type Matrix
| Capability | Freelance | Lease | Purchase/Sale | Employment | Generic | Founder |
| ---------- | --------- | ----- | ------------- | ---------- | ------- | ------- |
| Intake | FULL | FULL | FULL | FULL | FULL | MISSING |
| Extraction | FULL (EXTRACTION_SYSTEM_PROMPT) | FULL (GENERIC_PROMPT) | FULL (GENERIC) | FULL (GENERIC) | FULL (GENERIC) | MISSING |
| Risk | FULL (AI 8 cats + fallback `engine.ts`) | PARTIAL (AI GenericRiskReport 193, scores bucket-overridden actions:597 for generic only, lease still AI scores) | PARTIAL (same) | PARTIAL (same) | RULES-ONLY (7 generic rules + bucket 80/50/20 `generic/rules.ts` + `bucketForGenericFindings`) | MISSING |
| Rules | FULL 9 `freelance/rules.ts:19` | FULL 9 `lease/rules.ts:18` | FULL 8 `purchase_sale/rules.ts:17` | FULL 8 `employment/rules.ts:17` | FULL 7 `generic/rules.ts:13` | MISSING |
| Knowledge | PARTIAL 3 items `corpus.ts:38` | RULES-ONLY `LEASE_KEYS=[]` | RULES-ONLY `PURCHASE_SALE_KEYS=[]` | RULES-ONLY `EMPLOYMENT_KEYS=[]` | RULES-ONLY `GENERIC_KEYS=[]` | MISSING |
| Ask | FULL | FULL | FULL | FULL | FULL | MISSING |
| Protection | FULL (4 docs) | MISSING (coming-soon card `workspace-client:682`) | MISSING | MISSING | MISSING | MISSING |
| Persistence | FULL `deal_type` 00030 check | FULL 00027 | FULL 00029 | FULL 00030 | FULL 00030 | MISSING |

## 6. Database / Migration Audit
| Migration | Purpose | Tables/Functions | Status | Notes |
| --------- | ------- | ---------------- | ------ | ----- |
| 00001_create_audits | audits + RLS | audits | OK | Forward |
| 00002_expand_audits | add raw_input etc. + storage bucket + 3 policies without bucket_id | audits, storage.objects | OK (legacy policies now dropped by 00031) | Duplicate with 00014 |
| 00003_update_statuses | status check | audits | OK | |
| 00004_usage_tracking | usage_tracking + increment_usage (increment first) | usage_tracking, increment_usage() | OK (rewritten by 00018) | |
| 00005_system_logs | system_logs | system_logs | OK | |
| 00006_production_lock | ai_consent | audits | OK | |
| 00007_grants | grants | — | OK | |
| 00008_client_profiles | client_profiles | client_profiles | OK | |
| 00009_activity_events | activity_events | activity_events | OK | |
| 00010_checklist_items | checklist_items | checklist_items | OK | |
| 00011_business_profiles | business_profiles | business_profiles | OK | |
| 00012_document_versions | document_versions | document_versions (SELECT/INSERT only) | OK (UPDATE added 00031) | |
| 00013_share_and_sign | share_tokens, document_signatures, get_shared_document, sign_shared_document (SECURITY DEFINER anon) | share_tokens | OK | |
| 00014_storage_rls | storage.objects bucket-scoped 4 policies | storage.objects | OK | Duplicate Object guard |
| 00015_anonymous_logging | anon insert system_logs | system_logs | OK | |
| 00016_add_reviewed | reviewed col | document_versions | OK | |
| 00017_user_id_backfill | backfill user_id | document_versions | OK | |
| 00018_fix_rate_limit | rewrite increment_usage check-first | increment_usage() | OK | Forward |
| 00019_add_deal_type | deal_type check freelance/generic + index | audits | OK | Superseded by 00030 |
| 00020_lawyers_and_consultations | lawyers, consultation_requests | lawyers | OK | |
| 00021_audit_context_envelope | context_envelope JSONB + version | audits | OK | |
| 00022_knowledge_items | knowledge_items | knowledge_items | OK | |
| 00023_credit_ledger | credit_ledger + reserve/finalize/void/grant + advisory lock UNIQUE user_id+key | credit_ledger | OK | Forward |
| 00024_grant_anon_published_knowledge_read | anon SELECT published | knowledge_items | OK | |
| 00025_knowledge_admin_jwt_check | requireAdmin is_admin | — | OK | |
| 00026_freelance_knowledge_seed | 3 freelance items | knowledge_items | OK | |
| 00027_allow_lease | CHECK add lease | audits | OK | Forward |
| 00028_conversations | conversations + conversation_messages | conversations | OK | |
| 00029_allow_purchase_sale | CHECK add purchase_sale | audits | OK | |
| 00030_allow_employment | CHECK add employment | audits | OK | |
| 00031_harden_rls_and_storage | UPDATE RLS document_versions + DROP 3 legacy storage policies | document_versions, storage.objects | OK | Forward-only |
| 20260903* (3) | storage_rls, lawyer_policy, increment_usage_null_guard — DRAFT, NOT EXECUTED | — | DRAFT | Not applied, human approval required |

Forward-only OK, no duplicate responsibility (00002 legacy kept then cleaned 00031), RLS not weakened, `00023` locking/idempotency intact, `00030` CHECK matches TS unions `extract.ts:51` etc.

## 7. Security Audit
- **Auth:** `proxy.ts:1` present, build shows `ƒ Proxy`, redirects `unauth→/login` `70` and `auth→/dashboard` `53`, every protected `page.tsx:13` + `actions.ts:122` `getUser()` + `isValidUUID` + `email_confirmed_at:287`, no second auth system, no `localStorage` token, no URL token.
- **RLS:** Every table `ENABLE RLS` (migrations list above), policies `auth.uid()=user_id` on `audits, usage_tracking, system_logs, client_profiles, activity_events, checklist_items, business_profiles, document_versions, knowledge_items, credit_ledger, conversations` — none `USING(true)`. **No table without RLS.**
- **RPCs:** Cited `get_shared_document, sign_shared_document` still `SECURITY DEFINER` `00013:17` with `anon` grants. New `reserve_credits etc.` `00023` also `SECURITY DEFINER` with `pg_advisory_xact_lock` `00023:109` and `auth.uid()` check — each `HIGH` but tightly scoped, no broad public write.
- ** AI markdown sanitization:** Previously `architecture.md:239` unconfirmed — **RESOLVED** `src/lib/markdown.ts:46` custom parser uses `createElement` no `dangerouslySetInnerHTML` (`grep dangerouslySetInnerHTML` 0), so injected HTML neutralized without library — `UNVERIFIED — requires live stored XSS test` for generated docs.
- **Findings:** Generic AI-authority fix: deterministic `generic/` 7 rules `generic/rules.ts:13` + `bucketForGenericFindings:1` (80/50/20) now authoritative, AI scores overridden `actions.ts:597`, AI still summary. Lease/employment still run AI generic scoring **under their vertical rules** — **flagged in GENERIC_MODE_FIX.md as next audit check**, not fixed.

## 8. AI Architecture Audit
- **Providers:** `src/lib/ai/providers/gemini.ts`, `openai-compatible.ts`, `anthropic.ts:1` genuine `POST /v1/messages` `x-api-key` + `anthropic-version`, `providers.ts:51` `getActiveProviderName()` defaults `openai_compatible` when `AI_BASE_URL` contains `api.nvidia.com` (`.env.local` does), not Gemini as doc says.
- **Models/routing:** `resolveSurfaceConfig:78` `authenticated → anthropic sonnet5/opus5` (env `AUTH_AI_MODEL` default `claude-sonnet-5`, fallback `claude-opus-5`) vs `quick_review → legacy getActiveProviderName()`; fallback retryable `timeout,network,rate_limit,provider,malformed_response` `errors.ts:20`, non-retryable `auth,config,invalid_request` `providers.ts:136`.
- **Risk authority:** `analyzeRisk:124` AI 8 cats + fallback `generateRiskReport` `134` (freelance still AI-scores, deterministic as fallback/parallel); `analyzeGenericRiskWithVisibleFailure:193` AI-only but now overridden for `generic` via bucket `actions.ts:597`; **Violation for generic now fixed**, but lease/employment still AI-scored (flagged).
- **JSON handling:** `extractJson:15` strip fences + slice `{…}` + coerce defaults, `parseRiskResponse:110` try/catch throw `malformed JSON`.
- **Usage:** Adapters return `usage` (`Anthropic usage`, `Gemini usageMetadata`, `OpenAI usage`) threaded `SurfaceCallMeta usage` `providers.ts:39`, never zeroed.

## 9. Context / Knowledge / Rules / Evidence Audit
- **Context:** `context/schema.ts:24` `ContextEnvelope` 13 fields `unknown|inferred|user_confirmed` `161`, `requirements.ts:15` only `dealType` required for all 5 → gate `gate.ts:25` `READY`/`NEEDS_CONFIRMATION`/`MISSING` always READY after seed, `context-panel.tsx` exists but not blocking — **present but not consumed** beyond `gateCheck` + `resolveKnowledge`.
- **Knowledge:** `knowledge/schema.ts:124` strict validation, `store.ts:91` admin-gated `requireAdmin:29`, `resolver.ts:51` pure cap 50, `corpus.ts:38` 3 items (17 U.S.C. §204, UK Late Payment Act, FSB deposits) — **PARTIALLY IMPLEMENTED** (lease/purchase/employment empty `[]`, correctly product_policy).
- **Rules:** `rules/schema.ts:222` pure, `evaluator.ts:164` no LLM/network/wall-clock, `registry.ts:22` versioned `Map ruleKey@vVersion`, `result.ts:55` `PASS|FAIL|UNKNOWN` + `attachEvidence`, `detectFindingConflicts:148` — **VERIFIED**, 35 rules total (9+9+8+8+7 + 6 builtin).
- **Evidence:** `evidence/schema.ts:42` deterministic `djb2` id, `observe.ts:192` `exact` only `raw_input+inspectable` (range bounds), `collect.ts:99` only FAIL, `inspect.ts:93` `EXACT` only if `normalize(slice)==normalize(quote)`, `evidence-actions.ts:89` ownership `sourceId===auditId` — **no fabrication**.
- **Bypasses:** No direct `facts`→`AI` without `evaluator`; `analyzeDeal` does `context→knowledge→risk→rules→evidence` (`actions.ts:351-595`), but `risk` still before `rules` (could be reordered, not bypass). No `UNKNOWN→FAIL` (evaluator `164` tri-state, findings-panel `findings-panel.tsx:64` distinct).

## 10. Conversation / Credits Audit
- **Ask lifecycle:** `question → operation (classify.ts:15) → intent → context (loadContext parseContextEnvelope) → facts (derive via dispatcher) → knowledge (resolve) → rules (evaluate) → synthesis (generateNegotiationPoints) → constitution (constitution.ts:77) → usage (ai/usage:26) → credit (policy.ts:41 authorize→reserve→finalize/void with advisory lock `00023:109` + idempotency `user_id+key`) → response → `addMessage` `store.ts:88` 8000 cap, `touchConversation` → `listMessages` bounded `store.test.ts:93` 20.
- **Greeting:** `request.ts:162` fast-path `DETERMINISTIC_GREETING` no AI, no ledger, `ask-client.tsx:37` estimate 0 — **VERIFIED**.
- **History:** Caller history revalidated `ask/actions.ts:160` `listMessages(20)→slice(-12)` → `request.ts:140` `slice(-6)` `1000`, not client-supplied.
- **Credits:** `pricing.ts:30` flat `1/3/8` per `outputBudget` (brief 1024 etc.), not token-derived, `creditsForUsage` flat, `authorize→reserve→compute→finalize` intact, `void` on failure `policy.ts:105`, replay idempotent `ledger.ts:76`, `greeting 0`, `needs_document` `request.ts:178` no charge, `provider failure` `void` `request.ts:363`.
- **Billing vs reality:** `analyzeDeal` free 5/day `usage_tracking` `actions.ts:342` atomic `increment_usage` (check-first 00018) + `generateProtectionPackage` 10/day `742`, **not** `credit_ledger` — Ask is `1/3/8` on ledger. `architecture.md:155` now correctly documents free core vs mietered Ask (was contradictory).

## 11. Protection / Lawyer / Execution Audit
- **Protection:** `generate.ts:229` sequential `proposal→sow→contract→checklist` via `callAISurface` + template fallback, persists `document_versions` + `checklist_items`, `PDF @react-pdf` `pdf-documents.tsx`, `share_tokens` 30d `crypto.randomUUID` `actions.ts:1047`. **Freelance FULL**, **Lease/Purchase/Employment/Generic MISSING** (intentionally) — `actions.ts:724` blocks non-freelance with error, `workspace-client.tsx:682` shows coming-soon card for `isGeneric` (now includes generic with rules but protection still freelance-only).
- **Lawyer:** Schema `00020` `lawyers`/`consultation_requests` + `src/app/audit/[id]/consultation-actions.ts:43` creates `requested→waitlist`, `src/app/admin/lawyers/page.tsx:108` verify, **no** `src/lib/lawyer/` handoff bundle, no matching, no feedback — **schema-only**.
- **Execution:** No `src/lib/execution/` (architecture says planned), no obligations/deadlines/monitoring tables beyond `checklist_items` + `activity_events` timeline `workspace-client.tsx:182` — **planned, not implemented** (correct).

## 12. Testing / CI Audit
| Test suites | Tests | Passed | Failed | Skipped | Typecheck | Lint | Build | CI |
|---|---|---|---|---|---|---|---|
| 55 | 425 | 425 | 0 | 0 | 0 errors (`npx tsc --noEmit` `TSC:0`) | 0 errors, 44 warnings (`enriched unused` + `any` in hardening tests) | ✓ Compiled `ƒ Proxy` | `ci.yml` typecheck/lint/test/build with `ci-dummy` env, **no deployment job** — **CONFIRMED** `architecture.md:282` “no deployment job yet” not drift |

Doc “6 test files” (`architecture.md:304`) **CONTRADICTED** — 54 files, but docs already updated to `00030` in same section (stale line).

## 13. Documentation Drift
| Documentation claim | Actual | Drift | Severity |
|---|---|---|---|
| `architecture.md:36` `src/lib/deal-types/` planned | `src/lib/verticals/` exists, `deal-types` missing | **CONTRADICTED** — rename | LOW |
| `architecture.md:52`/`product.md:603` “19 migrations” | 34 files `00001→00031` + 3 draft `20260903*` | **CONTRADICTED** — update | LOW |
| `architecture.md:16` “Gemini today” | Default `openai_compatible` `providers.ts:51` + 3 adapters | **CONTRADICTED** — update | LOW |
| `architecture.md:282` “no CI/CD pipeline” | `.github/workflows/ci.yml` exists typecheck/lint/test/build | **CONTRADICTED** — doc stale line `304` still says 6 tests | LOW |
| `architecture.md:169` `deal_type check ('freelance','generic')` | `00030` 5 values, `architecture.md:438` already updated to 5 | **PARTIALLY CONTRADICTED** — that section still old | LOW |
| `src/lib/deal-types` planned vs `verticals` actual | Verticals are the `deal-types` realization | **CONTRADICTED** — docs need rename | LOW |

## 14. Technical Debt
- **P0 — blocks safe progress:** None.
- **P1 — should resolve before next major feature:** `updateAudit` sanitization already done (`actions.ts:136` deletes 5 keys) but `checkRateLimit` import now used correctly `actions.ts:338` (was duplicated direct RPC, now single abstraction + `.gitignore` `supabase/.temp/` added) — **fully resolved**; `removeFileMetadata` prefix + `eq(user_id)` `actions.ts:253`, `markDocumentReviewed` `eq(user_id)` + `00031` UPDATE RLS, legacy storage policies dropped `00031` — **resolved**.
- **P2 — important but can wait:** State sprawl `workspace-client.tsx:100` 12+ useState, pagination `limit(30)`, search `ILIKE`, no background jobs `generate.ts:229` synchronous, `unsafe-inline` CSP `next.config.ts:11` required for Next.js, no `Strict-Transport-Security` — all still true.
- **P3 — later optimization:** Founder/partnership verticals, richer corpus, OCR/editor, marketplace, payments, background jobs, passkeys/WebAuthn, pagination — intentionally deferred.

## 15. Missing Product Capabilities
- **Required for current product (RC):** None — freelance E2E (`intake→extraction→risk+deterministic findings with evidence→P/E package PDF→share/sign`) + generic floor (7 rules + bucket `80/50/20` `generic/rules.ts:1` + `bucketForGenericFindings` + `actions.ts:597` override, AI summary kept) + lease/purchase/employment deterministic 8-9 rules (AI-scored risk report still, flagged as next audit) + Ask `1/3/8` + Quick Review `3/hr` (in-memory) is **complete loop** `User submits deal → Dealenz identifies concrete issues → why they matter → evidence → Ask follow-up` — genuine outcome achievable.
- **Next implementation phase:** Founder deal type + knowledge corpus expansion + lawyer handoff bundle (product.md staged).
- **Future product:** Execution/monitoring, relationship intelligence, marketplace, payments, OCR/editor — not currently necessary.
- **Not currently necessary:** `database.types.ts` generation, HSTS nonce-CSP.

## 16. Recommended Next Implementation Sequence
1. **Founder vertical + knowledge corpus** (why next: completes `product.md:639` staged, unlocks deal-type coverage; depends on vertical pattern proven 4×; must not disturb single dispatcher/evaluator; acceptance: `founder/rules.ts` 8+ scoped product_policy + `founder/facts.ts` + `founder/knowledge.ts` empty, dispatcher 6 keys, `00032` CHECK, tests isolate founder vs generic, `npm test` + `tsc` clean).
2. **Knowledge corpus (1 verified item per lease/purchase/employment)** (why: makes those verticals honestly authoritative; depends on `knowledge/store.ts` admin gating; acceptance: `corpus.ts` + `00033` seed with provenance, `applicability` includes dealTypes, `resolveKnowledge` returns 1 per vertical).
3. **Distributed anonymous limiter** (why: `route.ts:18` `Map` not distributed; depends on Upstash Redis `KV_REST_API_URL`; acceptance: `src/lib/rate-limit.ts` Redis + fallback Map, `npm test` mocked, prod env `KV_REST_API_URL` documented).
4. **HSTS/Permissions-Policy + CSP nonce** (why: `next.config.ts:11` `unsafe-inline`) — P2, after founder.

## 17. STOP-SHIP Issues
- **None** — no P0, no A-class blocker. Generic AI-authority now deterministic (7 rules `generic/rules.ts:13` + bucket `80/50/20` `bucketForGenericFindings` + `actions.ts:597` override, AI summary kept). Lease/employment AI scoring still under vertical rules flagged in `GENERIC_MODE_FIX.md` as next audit — **C post-RC**, not stop-ship for current RC.

## 18. Audit Confidence
```
Repository understanding confidence: 88%

Verified:
- Structure, migrations (34 files, forward-only, RLS per table via migration text, SECURITY DEFINER 4+2, storage policies bucket-scoped after 00031)
- 4+generic verticals dispatch, facts nullable+evidence, rules scoped product_policy, isolation via 425 tests
- AI 3 adapters, resolveSurfaceConfig authenticated→anthropic vs quick_review→legacy, fallback 5 retryable `errors.ts:20`
- Credits: ledger advisory lock + UNIQUE, Ask 1/3/8 flat, analysis free 5/day atomic `increment_usage` 00018 check-first
- Evidence EXACT only raw_input+inspectable `observe.ts:203`, collect only FAIL, inspect verifies `normalize(slice)==normalize(quote)`
- Conversation 7 ops `operations.ts:13` (plan), bounded 12×1000 history, server-owned findings/credits

Unverified:
- Production execution of proxy (build shows ƒ Proxy, not Vercel)
- True concurrent advisory-lock race (logic verified 00023:109, not observed live)
- Live Supabase RLS actually blocks query (static migration text, not live probe)
- Live Anthropic fallback `claude-sonnet-5→opus-5` (no ANTHROPIC_API_KEY)
- Stored XSS via generated docs (markdown.ts custom parser, no live payload test)

Blocked by:
- No live Supabase credentials (`supabase gen types` fails, `.env.local` placeholder)
- No ANTHROPIC_API_KEY in environment
- No Upstash Redis env (`KV_REST_API_URL`)
- Remote CI not executed (local `ci-dummy` env only)
```

