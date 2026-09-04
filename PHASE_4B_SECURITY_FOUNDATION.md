# Phase 4B — Security Foundation

## 1. Status

```text
COMPLETE WITH WARNINGS
```

All in-scope security work is implemented and verified to the extent possible in this environment. Remaining warnings are bounded, pre-existing, or explicitly deferred with owners. Phase 5 work was not started.

## 2. Baseline

Pre-Phase-4B state, established by inspection before any change:

- Canonical Supabase project verified with 23 of 23 migrations applied (Phase 4A remediation complete).
- Proxy middleware functional in dev with 5 unit tests in `src/proxy.test.ts`.
- No credit system, no payment provider code, no background jobs in `src`.
- Pre-existing failures unrelated to this phase: 7 lint errors in untouched `src/components/landing/hero-section.tsx`, 36 warnings across untouched files, 5 vitest failures in `src/app/audit/[id]/actions.test.ts` caused by incomplete test mocks.
- No `.env` file exists; `.env.local` is canonical local env and is gitignored (`.gitignore:34`).
- The configured NVIDIA model `nvidia/nemotron-3-nano-30b-a3b` returned HTTP 410 (end of life) during live testing, so AI-dependent live paths could not complete. This is environmental, predates this phase, and independently confirms the error-sanitization work below was necessary.

## 3. Proxy

Implementation: `src/proxy.ts` uses the standard Supabase SSR pattern (`createServerClient` with cookie get/set, lines 10-29), fetches session and user (lines 31-51), and enforces the redirect matrix: authenticated users on `/` or auth pages go to `/dashboard` (lines 53-68); unauthenticated users on workspace routes (`/dashboard`, `/audit`, `/deals`, `/clients`, `/risk-intelligence`, `/templates`, `/billing`, excluding `/view`) go to `/login` (lines 70-79). Matcher at lines 84-88 excludes static assets.

Verification (live, dev server port 3002): `GET /` returned 200; `GET /dashboard` unauthenticated returned 307 to `/login`; `GET /login` unauthenticated returned 200. Unit tests: all 5 in `src/proxy.test.ts` pass. Build output lists `Proxy (Middleware)`.

Production verification: NOT VERIFIED. No production deployment is reachable from this environment. Manual procedure: deploy the production build, then from a clean browser session request `/dashboard` (expect 307 to `/login`), request `/login` (expect 200), sign in and request `/dashboard` (expect 200), and confirm the `Proxy (Middleware)` line in the production build output.

No proxy code was changed. The mechanism needed no correction, only proof.

## 4. Authorization

Audited operations and results (each verified as authentication, then authorization and ownership, then validation, then operation):

- `updateAudit` (`src/app/audit/[id]/actions.ts:98-142`): auth plus UUID check, field whitelist (`ALLOWED_FIELDS`, lines 86-94), status whitelist (line 96), ownership filter on write (lines 128-132), RLS as backstop. PASS.
- `attachFileMetadata` (lines 144-206): auth, storage path prefix pinned to `audit-files/${user.id}/${auditId}/` (lines 160-163), audit existence, 10-file cap (lines 176-178), ownership-scoped write. PASS.
- `removeFileMetadata` (lines 208-250): auth, ownership-scoped read and write. PASS.
- `analyzeDeal` (lines 252-552): auth, UUID check, email verification (lines 263-265), audit ownership (lines 271-276), AI consent gate (lines 282-284), usage pre-check (lines 286-297), advisory lock with TTL (lines 299-311), per-file download and extraction isolation with per-file failure logging (lines 332-362), input validation gate (lines 392-408), ownership-scoped persistence. PASS.
- `generateProtectionPackage` (lines 554+): auth, email verification, audit ownership, generic-type refusal, extracted-data precondition, usage pre-check. PASS (by inspection; same patterns as above).
- Share and sign (`createShareToken`, `revokeShareToken`, `getShareStatus`): ownership checks plus token scoping; public access only through the two `SECURITY DEFINER` RPCs. PASS (by inspection against RLS policies verified in Phase 4A).
- Lawyer application (`src/app/lawyer-application/actions.ts`): auth required, duplicate-application guard (lines 25-37), always inserts `verification_status: pending` (line 51). PASS.
- Admin verification (`src/app/admin/lawyers/page.tsx:4-24`, `src/app/api/admin/lawyers/verify/route.ts:4-21`): server-side `user_metadata.is_admin` check with redirect to `/dashboard` and 401 respectively, before any data access. PASS (by inspection; live admin session not available in this environment).
- Consultation requests (`src/app/audit/[id]/consultation-actions.ts`): auth, audit ownership, duplicate active-request guard (lines 24-35), waitlist switch on verified-lawyer count (line 43). PASS.

Wrong-user access is denied at two layers everywhere above: ownership filters in queries plus RLS policies verified live in Phase 4A. No operation trusts client-supplied user IDs, roles, or ownership fields.

## 5. usage_tracking

Finding from Phase 4A confirmed: the `00018` rewrite has no null-session early return, so a sessionless call reaches the insert with a null `user_id` and raises on the `NOT NULL` constraint instead of returning graceful default-deny. All application callers invoke the RPC only after user validation (`src/lib/rate-limit.ts` is called from authenticated Server Actions; the anonymous Quick Review uses a separate in-memory map), so no current flow is affected.

Decision: implement the smallest safe fix, a forward-only migration adding only the null guard. Created `supabase/migrations/20260903000003_increment_usage_null_guard.sql`, which reproduces the `00018` body verbatim plus an early `RETURN QUERY SELECT false, 0` when `auth.uid()` is null. `SECURITY DEFINER`, `search_path`, signature, and check-first semantics are unchanged. Applied to the canonical project via `db push` with zero errors. Live function definition read back confirms the guard present, `SECURITY DEFINER` intact, and check-first logic intact.

Direct writes remain impossible for clients: `usage_tracking` exposes only a SELECT-own RLS policy, so all increments flow through the RPC. Server-controlled model preserved.

## 6. system_logs

Audit result: all writes carry operational metadata only (phase, status, durations, scores, filenames, short reason strings). No raw contracts, extracted full text, secrets, tokens, or PII flow into `system_logs` in any current code path. Provider error bodies go to server `console.error` only, never to the database.

Access control: SELECT restricted to service role, INSERT restricted to own `user_id` plus the anonymous null-user policy from `00015`. System logs are not exposed to normal users anywhere in the UI. No change was needed and none was made.

Residual, recorded not fixed: proxy middleware log writes fail closed (`Middleware logging failed: permission denied for table system_logs` observed in dev log) because the middleware logger inserts without a `user_id` while the table policies require one. Auth routing itself is unaffected. Recommended follow-up: attach the user id when a session exists, or route middleware diagnostics to server logs only. Deferred as hardening, not a launch blocker.

## 7. AI Errors

Sanitization implemented where the exposure was real:

- Anonymous route (`src/app/api/analyze-anonymous/route.ts:162-165`): the catch-all previously returned raw `err.message` to unauthenticated callers. It now returns a fixed generic message via `toAnonymousError` (`src/lib/safe-error.ts`), which logs only the error class server-side. Verified live: a provider outage (HTTP 410, model end of life) produced `{"error":"Analysis failed. Please try again with more detail about your deal."}` with status 500 and zero provider internals in the response, while the server log retained the provider status for operators.
- Authenticated paths (`analyzeDeal`, `generateProtectionPackage`): provider errors surface as generic strings (`Gemini request failed, HTTP NNN`, `returned an empty response`) to the audit owner for their own analysis. Detailed payloads stay in server logs as metadata (model name, prompt lengths, provider error body snippet). Left unchanged by design; the exposure is bounded to the data owner and contains no keys, headers, payloads, or stack traces.
- Provider modules (`gemini.ts:48-56`, `openai-compatible.ts:57-65`, `generate.ts:243-290`): thrown errors are generic strings; request bodies and keys never enter thrown messages. No change needed.

## 8. Secrets

Secret-hygiene audit (values never printed; pattern scan over `src`, `scripts`, tests, fixtures, docs):

- Zero hardcoded credentials found: no API keys, tokens, JWTs, AWS keys, or provider secrets in source, tests, fixtures, or docs.
- No `service_role` or `SERVICE_ROLE` references anywhere in `src`.
- Supabase access split verified: all 13 `.tsx` files importing `lib/supabase/server` are server components under `src/app`, and none of the 5 `"use client"` files under `src/app` import it. Browser code receives only `NEXT_PUBLIC_*` values through `createBrowserClient` (`src/lib/supabase/client.ts:3-8`).
- No secrets are returned from server actions or API routes. No secret enters logs (verified in the logging audit above).
- `.env.local` remains gitignored and was not modified.

## 9. CSP

Change made in `next.config.ts:11`: removed `https://generativelanguage.googleapis.com` from `connect-src` (verified safe: `callAI` is imported only by server-only modules `generate.ts`, `risk-analysis.ts`, `negotiation.ts`, `extract.ts`, so browsers never call AI endpoints), and added `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`.

Deliberately preserved with documented reasons: `script-src 'unsafe-inline'` is required by Next.js inline bootstrap scripts without nonce plumbing; `unsafe-eval` covers dev and unverified client-side PDF paths; removing either risked breaking the app for purely cosmetic gain. Nonce-based CSP remains a documented future hardening item.

Verified live: response headers on `/` show the full new policy string with all additions present.

## 10. Quick Review

Dedicated anonymous-path review of `src/app/api/analyze-anonymous/route.ts`:

- Input: prompt text plus PDF, DOCX, TXT uploads; MIME allowlist plus 10MB per-file checks in `src/lib/text-extract.ts:4-34`; malformed content fails safely per file and is skipped.
- New hardening in this phase: 10-file cap per request (lines 88-93, mirroring `MAX_FILES_PER_AUDIT`) and 100k-character combined-input cap (lines 128-130, mirroring `MAX_COMBINED_INPUT_LENGTH` in the authenticated flow). Previously both were unbounded on the anonymous path.
- Abuse prevention: in-memory 3-per-hour IP plus fingerprint limit (lines 40-50 check, 132-138 increment). Known limitation documented: the map resets on restart and does not span instances; a future commerce phase should move anonymous quotas server-side.
- Authorization: anonymous callers reach no authenticated data (probed: audits, lawyers, consultations all deny). No audit rows, history, profiles, logs, or RPCs beyond the analysis itself are reachable.
- Errors: validation failures return explicit safe strings (400/429); AI failures now return the generic message (500). Verified live for the 400 paths and the 500 path.
- Scope: Quick Review returns analysis only; no documents, sharing, history, lawyer access, or execution. Conversion path is the register CTA. Unchanged and correct.

## 11. File Uploads and Storage

- Client validation (extension allowlist, 10MB) plus server validation (MIME allowlist, size, non-empty) in `src/lib/text-extract.ts`; parser failures are caught per file and skipped, never fatal.
- Storage path pinned to `audit-files/${user.id}/${auditId}/` at metadata attach time (`actions.ts:160-163`); download path derives from stored metadata; storage RLS folder-scoping plus the four bucket-scoped policies (three from `00002`, UPDATE from the remediation file) enforce ownership at the database layer.
- `audit-files` bucket verified private post-push. No public exposure.
- Residual noted, not changed: MIME trust is by client-supplied type with safe parser failure; magic-byte sniffing is a possible future hardening with low marginal value given parsers fail safely.

## 12. RPC Security

| Function | Purpose | Caller | Auth | Tables touched | Anonymous? | Arbitrary IDs? | search_path | Status |
|---|---|---|---|---|---|---|---|---|
| `increment_usage` | Check-first quota gate | Server Actions via `checkRateLimit` | Session required for allow; null session now default-deny | `usage_tracking` | Callable but always denied | No user-ID parameter exists | `public`, fixed | PASS |
| `get_shared_document` | Public share-link document fetch | Anonymous share viewers | None by design | `document_versions`, `audits`, `business_profiles`, `document_signatures` | Yes, by token only | Token is unguessable UUID; invalid tokens return empty | Verified `SECURITY DEFINER` | PASS |
| `sign_shared_document` | Public e-sign intake | Anonymous signers | None by design | `share_tokens`, `document_signatures`, `activity_events` | Yes, by token only | Name and email self-asserted (inherent to e-sign); duplicate signing rejected; token revoked after signing | Verified `SECURITY DEFINER` | PASS |

No new `SECURITY DEFINER` functions were added. No existing RPC was weakened.

## 13. Database and RLS

Post-execution state verified live: 12 tables with RLS on; policy inventory matches the applied migration set plus the two remediation files exactly (7 storage policies including UPDATE; 7 consultation policies including corrected assigned-request predicates; 4 lawyer policies; document-version UPDATE; system-logs anonymous insert). No missing RLS, no overly broad policies introduced. The retained wider `00002` storage policies were deliberately left in place per the approved plan; tightening them is recorded hardening, not silent change.

## 14. Production Verification

```text
NOT VERIFIED
```

No production deployment is reachable from this environment. Exact manual procedure: deploy the production build; from a clean session, `GET /` must return 200 with the CSP header set from section 9; `GET /dashboard` must return 307 to `/login`; `GET /login` must return 200; after signing in as a test user, `GET /dashboard` must return 200 and the freelance create-through-analysis flow must complete; confirm the `Proxy (Middleware)` line in the production build output. Use a dedicated test account and non-sensitive test content only. No destructive tests.

## 15. Tests

Exact commands and results:

```text
npm run build       PASS (18 routes, Proxy (Middleware) detected, exit 0)
npx tsc --noEmit    PASS (exit 0)
npm run lint        FAILS on pre-existing issues only (see below)
npx vitest run      18 passed, 5 failed, all 5 pre-existing mock gaps (see below)
```

- Lint: 7 errors, all in untouched `src/components/landing/hero-section.tsx` (unescaped entities); 36 warnings across untouched files. Changed files introduce zero new lint findings (the one warning in the touched route file, unused `safeParseJSON`, predates this phase).
- Vitest: new `src/lib/safe-error.test.ts` 4 of 4 pass; `src/proxy.test.ts` 5 of 5 pass; `src/app/login/actions.test.ts` 2 of 2 pass. The 5 failures in `src/app/audit/[id]/actions.test.ts` are pre-existing mock-chain gaps (`supabase.from(...).select(...).eq is not a function`), identical before and after this phase, in a file this phase did not touch.

## 16. Files Changed

```text
src/lib/safe-error.ts                                          NEW (error sanitizer)
src/lib/safe-error.test.ts                                     NEW (4 tests)
src/app/api/analyze-anonymous/route.ts                         MODIFIED (sanitized catch, file-count and input caps, unused import removed)
next.config.ts                                                 MODIFIED (CSP tightening only)
supabase/migrations/20260903000003_increment_usage_null_guard.sql  NEW (forward-only, applied to canonical project)
PHASE_4B_SECURITY_FOUNDATION.md                                NEW (this report)
```

## 17. New Migrations

One: `20260903000003_increment_usage_null_guard.sql`. Adds only an explicit null-session early return (`false, 0`) to `increment_usage`, preserving `SECURITY DEFINER`, `search_path`, signature, and check-first semantics verbatim from `00018`. Applied to the canonical project with zero errors; live function definition read back confirms the guard present. Historical migrations untouched.

## 18. Known Warnings

PRE-EXISTING (not caused by, and out of scope for, this phase):
- Lint: 7 errors in `hero-section.tsx`, 36 warnings across untouched files.
- Vitest: 5 failures in `actions.test.ts` from incomplete test mocks.
- In-memory anonymous rate-limit map resets on restart and does not span instances.
- No production deployment available for probing.
- Configured NVIDIA model returned HTTP 410 (end of life) during testing; AI provider key/model refresh is an operations matter, not a code matter.

PHASE-4B (introduced deliberately, all reviewed above):
- None that weaken security. The CSP additions and the null-guard migration are strictly additive or narrowing.

DEFERRED (documented, with owners):
- Proxy production-build probes to deployment owner.
- Authenticated user-flow and storage object-flow tests against canonical to Phase 4B app-connectivity follow-up with a test-user plan.
- Null-session RPC behavioral re-probe from a healthy network path.
- Nonce-based CSP, magic-byte upload sniffing, `00002` policy tightening, middleware log-write fix, data retention policy to hardening backlog.

## 19. Later-Phase Findings

Documented, not implemented: Knowledge layer, context engine, generalized deal-type registry, new deal types, generalized risk engine and generic AI-risk replacement, clause library, generalized protection, lawyer workspace, credit ledger, billing, payment provider, execution layer, notifications, background jobs. AI authority posture unchanged: no new AI scoring, thresholds, or legal determinations were added; the generic AI-only contradiction remains a known later-phase problem as previously recorded.

## 20. Phase 5 Readiness

The repository is ready for Phase 5 Domain and Foundation Generalization, contingent on independent review accepting the deferred items above. The security foundation holds: canonical backend verified with complete migration history, routing enforced and tested, authorization defense in depth intact, anonymous boundary hardened and probed, logging free of deal content, errors sanitized, secrets server-side, storage private with intended policies, RPCs bounded, freelance flow untouched with build green and typecheck green.
