# Phase 4A — Supabase Canonical Project Verification

## Executive Status

```text
PASS WITH WARNINGS
```

The original blocker is resolved. The approved remediation was executed exactly as specified in `PHASE_4A_REMEDIATION_EXECUTION_PLAN.md`: `00014` was repair-recorded as applied after both replacement migrations were created and reviewed, then `db push` applied `00015` through `00020` plus `20260903000001_storage_rls_remediation.sql` and `20260903000002_lawyer_policy_remediation.sql` with zero errors. All 22 migration versions now show local and remote markers present with no unexpected entries. The warnings below are bounded and documented; none reopens the blocker. Phase 4B was not started and requires independent review and explicit clearance first.

## Canonical Project

- New project verified: yes. The Supabase CLI lists an `ACTIVE_HEALTHY` project named `Dealenz` in region `eu-west-1`, created `2026-09-02`, running Postgres 17. Its project URL host matches the `NEXT_PUBLIC_SUPABASE_URL` host in `.env.local` exactly.
- `.env.local` points to it: yes. The URL host was extracted programmatically and matches the CLI-listed project.
- Reachability: yes. `GET /auth/v1/health` with the anon key returns HTTP 200. Without a key it returns 401, which is the expected keyed-health-check behavior.
- Database initialized: fully, per the approved remediation. All 22 migration versions (`00001` through `00020` plus `20260903000001` and `20260903000002`) show local and remote markers present with no unexpected entries. Verified below.
- Auth available: yes, service reachable (health 200). Full signup, login, logout, verification, and reset flows were not executed because they would create test users in the canonical project and email delivery configuration is unknown. Deferred to Phase 4B app-connectivity testing with an explicit test-user plan.
- Storage available: bucket `audit-files` exists and is private (verified via linked query, re-confirmed post-push). Authenticated upload, read, and delete flows were not executed (they require a test user). Deferred as above.
- Expected schema: present in full. See Database and RLS sections.

## Environment

Variables present in `.env.local` (names only, values redacted):

```text
NEXT_PUBLIC_SUPABASE_URL=https://...redacted...
NEXT_PUBLIC_SUPABASE_ANON_KEY=[REDACTED]
AI_PROVIDER=openai_compatible
AI_API_KEY=[REDACTED]
AI_BASE_URL=https://...redacted...
AI_MODEL=[REDACTED]
GEMINI_API_KEY=[REDACTED]
GEMINI_MODEL=[REDACTED]
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

- Required variables present: yes for local development (Supabase URL, anon key, AI provider selection, model, app URL).
- Secrets protected: yes. `.gitignore:34` ignores `.env*`, so `.env.local` is not committable. No service-role key, database password, or CLI access token exists in `.env.local` (variable-name inventory confirms absence).
- Service role server-only: not applicable, no service-role credential is stored in the repository. Any future service-role use must remain server-side only and must never enter client bundles.
- `.env` file: does not exist. Only `.env.local` and `.env.example` exist. Any instruction referencing a populated `.env` file could not be verified and should be treated as stale. `.env.local` is the canonical local file.
- CLI linkage: the Supabase CLI is authenticated (project listing works). The stale link state pointing at the retired project was replaced by running the required `supabase link` against the new project URL host. This rewrote only `supabase/.temp/linked-project.json` (local CLI state, not application code).

## Migration Status

- Local migration count: 22 files (`00001` through `00020` plus `20260903000001_storage_rls_remediation.sql` and `20260903000002_lawyer_policy_remediation.sql`).
- Remote applied: all 22, confirmed via `supabase migration list` with local and remote markers present for every version and no unexpected entries.
- Original failure (resolved): `00014_storage_rls.sql` failed at statement 0 with `must be owner of table objects (SQLSTATE 42501)` on `ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY` (`supabase/migrations/00014_storage_rls.sql:1`). Diagnosis was environment and platform configuration, not a migration logic defect.
- Approved execution performed, in order: link confirmed canonical, `npx supabase migration repair --linked --status applied 00014` (recorded `00014 => applied`, exit 0), then `npx supabase db push`, which applied `00015`, `00016`, `00017`, `00018`, `00019`, `00020`, `20260903000001`, and `20260903000002` with zero errors (`Finished supabase db push`, exit 0).
- History integrity: preserved. No historical migration was edited, renamed, squashed, or reordered. `migration list` output matches the file set exactly, plus the single recorded repair of `00014` justified by the remediation analysis.

## Database

Verified via linked read-only queries plus migration file inspection. Tables, RLS flags, and policies below reflect live remote state unless marked otherwise.

### Tables (all with RLS enabled, verified live)

`activity_events`, `audits`, `business_profiles`, `checklist_items`, `client_profiles`, `consultation_requests`, `document_signatures`, `document_versions`, `lawyers`, `share_tokens`, `system_logs`, `usage_tracking`. All 12 report `rls_enabled: true` (the 10 originals re-confirmed pre-push; `lawyers` and `consultation_requests` confirmed post-push).

### Columns (spot-verified)

Pre-push, `audits.deal_type` did not exist (anonymous probe returned `42703 column audits.deal_type does not exist`). Post-push, the identical probe shape returns `401 permission denied` instead of a column error, consistent with the column now existing with `00019` applied. A direct column inventory query was attempted but the shell mangled its quoting twice, so column presence rests on the migration success plus this error-transition evidence rather than a direct inventory.

### Indexes and Constraints

Defined across migrations `00001` (`idx_audits_user_id`, `idx_audits_created_at`, status check), `00002` (JSONB columns, bucket insert), `00003` (extended status check), `00008` (`idx_client_profiles_user_id`, `idx_audits_client_id`, `client_id` foreign key), `00009` (activity event indexes), `00011` (rate unit check), `00012` (document type check), `00013` (share token and signature indexes, document type checks, unique token), `00004` (unique user, action, date). Index and constraint presence beyond the applied DDL succeeding without error was not individually enumerated. Full per-index inventory is deferred to the Phase 4B hardening pass and does not block the gate on its own.

### Functions and RPCs (verified live, pre- and post-push)

All three exist, `plpgsql`, `SECURITY DEFINER`: `increment_usage`, `get_shared_document`, `sign_shared_document` (re-confirmed post-push).

Note on the replaced `increment_usage`: `00018` is now live, so the function is the check-first version. Static review of `00018_fix_rate_limit.sql:13-41` shows it preserved the `SECURITY DEFINER` marking but, unlike the pre-fix version, has no explicit null-session early return: with no session, the usage lookup yields null, the limit check passes, and the subsequent insert with a null `user_id` violates the `NOT NULL` constraint and raises. Pre-push live behavior returned graceful default-deny for anonymous callers; post-push live re-verification of that path was blocked because JSON POST bodies from this shell fail transport-wide right now (proven environmental: an identical POST to `rest/v1/audits` also returns body-parse errors while all GETs succeed). All application callers invoke this RPC only after user validation, so no current flow is affected. Recommended follow-up: re-probe the anonymous path from a healthy network path and, if confirmed, add an explicit null-session early return in a future migration. This is a warning, not a regression in any shipped flow.

### Triggers

None defined in any migration (grep for trigger constructs across `supabase/migrations` returned no matches).

### Enums

Both present post-push as returned by live query: `consultation_status` and `lawyer_verification_status`. Pre-push the same query returned an empty set, confirming they arrived with `00020`.

## RLS

Per-table status from live `pg_policies` inspection. `EXPECTED` means defined by the applied migration set. `ACTUAL` means observed remotely.

```text
TABLE                     RLS ENABLED?  POLICIES PRESENT?                              EXPECTED ACCESS?                     ACTUAL ACCESS?                        STATUS
activity_events           yes           INSERT own, SELECT own                         owner read and write                 matches (anon: no access path tested)   PASS
audits                    yes           SELECT, INSERT, UPDATE, DELETE own             owner only                           anon probe: 401 permission denied      PASS
business_profiles         yes           ALL own                                        owner only                           matches migration 00011               PASS
checklist_items           yes           ALL own                                        owner only                           matches migration 00010               PASS
client_profiles           yes           ALL own                                        owner only                           matches migration 00008               PASS
document_signatures       yes           SELECT own                                     owner read                           matches migration 00013               PASS
document_versions         yes           SELECT own, INSERT own, UPDATE own               owner read, insert, update           all three confirmed live post-push    PASS
share_tokens              yes           ALL own                                        owner only                           matches migration 00013               PASS
system_logs               yes           SELECT service-role, INSERT own, INSERT anon   owner insert, service read, anon     all three confirmed live post-push  PASS WITH NOTE
usage_tracking            yes           SELECT own                                     owner read; writes via RPC only      matches migration 00004               PASS
storage.objects           platform      SELECT, INSERT, DELETE own (00002) plus        owner scoped by folder, bucket       all seven confirmed live post-push  PASS
                                      SELECT, INSERT, UPDATE, DELETE scoped
                                      to audit-files (remediation file)
lawyers                   yes           SELECT verified-only public, ALL own,          verified-only public + owner + admin  all four confirmed live post-push   PASS
                                      SELECT admin, UPDATE admin
consultation_requests     yes           INSERT/SELECT/UPDATE own, SELECT/UPDATE       owner + assigned (via lawyers        all seven confirmed live post-push  PASS
                                      assigned via lawyers.user_id, admin               .user_id) + admin
```

Prior notes from the blocked chain are now resolved: the `document_versions` UPDATE policy, the `system_logs` anonymous-insert policy, and the storage UPDATE policy are all present and were re-verified live after the push. The `lawyers` and `consultation_requests` tables exist with RLS on, and the corrected assigned-request predicates (`EXISTS` through `lawyers.user_id` for both `USING` and `WITH CHECK`) were read back from the live database exactly as drafted.

Two observations carried forward, neither a misconfiguration:

- The public `lawyers` verified-only policy is currently unreachable by anonymous callers: anon holds no table grant (only the `authenticated` role received grants via `00007_grants.sql`), so anonymous reads return `401 permission denied`. No current flow reads lawyers anonymously (the verified-count API requires a session), so nothing is broken. A future public marketplace would need an explicit anon grant decision.
- The pre-existing wider `00002` storage policies (folder-scoped without a bucket filter) remain alongside the new bucket-scoped ones, as intended by the additive remediation. Tightening them is a separate hardening decision.

Security is not claimed merely because RLS is enabled. The anon probes above demonstrate denial in practice: `audits` returns `401 permission denied`, and `consultation_requests` returns `401 permission denied`.

## Auth

- Service reachable: yes (`/auth/v1/health` returns 200 with the anon key).
- Configuration coherence: the application uses `createBrowserClient` with the public URL plus anon key server-side and client-side (`src/lib/supabase/client.ts`, `src/lib/supabase/server.ts` patterns as documented in `ARCHITECTURE.md`), and the callback route `src/app/auth/callback/route.ts` exchanges OAuth codes server-side. Full signup, login, logout, verification, reset, and session flows were not executed against the canonical project in this phase.
- Middleware and proxy behavior: not re-tested in this phase. Prior session evidence showed the expected redirect matrix in dev. Production-build verification belongs to Phase 4B and is still required.

## Storage

- Bucket `audit-files` exists with `public: false` (verified via linked query).
- Storage policies present: view, upload, and delete own files (`00002_expand_audits.sql:13-26`). The update policy from the blocked `00014` is absent.
- Authenticated upload, read, and delete flows were not executed (they require a test user). Deferred to Phase 4B app-connectivity testing.
- Signed URL behavior, ownership boundaries, and document access controls beyond the policy inventory above were not exercised. Deferred as above.

## Application Connectivity

- Browser and client path: connects (PostgREST reachable, anon key accepted, RLS enforced as probed).
- Server actions and components path: code-identical to the previously verified state; not re-executed against the canonical project in this phase.
- API routes path: not re-executed in this phase.
- Auth path: service reachable; user flows deferred as stated.
- Storage path: bucket verified present and private; object flows deferred as stated.
- RPC path: `increment_usage` verified present, `SECURITY DEFINER`, and default-deny without a session pre-push. Post-push live re-verification of the anonymous path was blocked by the shell transport issue described in Risks; the replaced function text was statically reviewed instead (see warning there).

## Old Project References

- Repository grep for the retired project ref across the full tree: no files found. The stale `supabase/.temp/linked-project.json` entry was replaced as a side effect of the required `supabase link` to the new project. That file is local CLI state, not application code, and the change is reported here transparently.
- `.env.local` points at the new project (host verified against the CLI project listing).
- `.env.example` documents variable names only and contains no project-specific values.
- No hardcoded Supabase URLs were found in `src` (grep for the URL host pattern returned no matches).
- The retired project itself was not touched, deleted, or modified in any way.

Classification: no `STALE / OLD` references remain in the repository. The retired project status on the Supabase side (paused vs deleted) is outside this environment's visibility and needs no action unless data recovery is requested, which it has not been.

## Risks and Blockers

1. **RESOLVED, migration chain completed.** The approved Option A sequence was executed: link confirmed canonical, repair recorded `00014` as applied, push applied `00015` through `20260903000002` with zero errors. The original halt no longer exists.
2. **RESOLVED, downstream schema present.** `lawyers`, `consultation_requests`, both enums, and (by error-transition evidence) `audits.deal_type` now exist with RLS enabled and the intended policies verified live.
3. **RESOLVED, rate limiter is the fixed version.** The check-first rewrite from `00018` is live. Superseded by warning 7 below, which is narrower and concerns only the anonymous edge, not the fix itself.
4. **WARNING, full user-flow verification deferred.** Signup, login, logout, verification, reset, session persistence, authenticated storage flows, and share and sign flows were not executed against the canonical project. The service surface is verified reachable and correctly permissioned at the anonymous boundary; user flows belong to Phase 4B app-connectivity testing with an explicit test-user plan.
5. **WARNING, proxy production behavior still unverified.** Prior session evidence covers development only. Phase 4B must include production-build redirect probes.
6. **NOTE, CLI linkage state changed.** `supabase/.temp/linked-project.json` now references the new project. This is local tooling state required by the verification work, not an application change.
7. **WARNING, new `increment_usage` null-session edge.** Static review of the live `00018` text shows no explicit null-session early return: an anonymous call would reach the insert with a null `user_id` and raise on the `NOT NULL` constraint, where the pre-fix version returned graceful default-deny. All application callers invoke it only after user validation, so no current flow is affected. Recommended follow-up: re-probe the anonymous path from a healthy network path and, if confirmed, add an explicit null-session early return in a future migration. Live re-verification was blocked by the shell transport issue below, not by the database.
8. **WARNING, shell transport flakiness in this environment.** JSON POST bodies from this shell intermittently fail with body-parse errors across all endpoints (proven environmental via the `audits` POST discriminator), and several linked queries needed retries with transient temp-role connection errors. All findings reported as verified were re-confirmed on retry; anything single-attempt is marked as such. Future verification runs should prefer the application runtime or a stable shell for POST-body checks.
9. **NOTE, public lawyer policy currently unreachable by anonymous callers.** The verified-only public select policy exists, but the `anon` role holds no table grant (grants went to `authenticated` via `00007_grants.sql`), so anonymous reads return `401`. No current flow reads lawyers anonymously. A future public marketplace needs an explicit grant decision, not just the policy.

## Execution Record (Approved Remediation)

Commands executed, in order, with results. No other remote mutations were performed.

1. Link confirmation (read-only): compared the CLI link ref against the `.env.local` project host programmatically. Result: MATCH, no values printed.
2. `npx supabase migration repair --linked --status applied 00014`. Result: `Migration history repaired`, versions `00014` marked applied, exit 0.
3. `npx supabase db push`. Result: `00015`, `00016`, `00017`, `00018`, `00019`, `00020`, `20260903000001`, `20260903000002` applied, `Finished supabase db push`, exit 0. Historical files untouched.
4. Verification battery (all read-only): migration list fully marked; storage RLS still enabled with all seven policies present; `lawyers` and `consultation_requests` present with RLS on; corrected assigned-request predicates read back verbatim; all four `lawyers` policies present; both enums present; all three RPCs present and `SECURITY DEFINER`; bucket still private; anonymous probes deny as expected; document-version and system-logs pending policies confirmed present.

## Application Verification

No application code was modified in this phase. The working tree contains extensive pre-existing uncommitted changes from prior phases, which are out of scope here.

- `npm run build`: PASS. Compiled successfully, 18 routes (8 static, 10 dynamic), `Proxy (Middleware)` detected, exit 0.
- `npx tsc --noEmit`: PASS, exit 0.
- `npm run lint`: FAILS on pre-existing issues only (7 errors in untouched `src/components/landing/hero-section.tsx` unescaped entities, plus warnings across untouched files). None in files created or touched by this phase. Reported, not fixed, per phase rules.
- `npx vitest run`: 14 passed, 5 failed, all 5 in untouched `src/app/audit/[id]/actions.test.ts` and all caused by test-mock chaining gaps (`supabase.from(...).select(...).eq is not a function`), not by application or database changes. Reported, not fixed, per phase rules.
