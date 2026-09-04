# Phase 4A Remediation, Execution Plan (Draft, Awaiting Human Approval)

## Executive Status

```text
DRAFT, AWAITING HUMAN APPROVAL
```

Nothing in this plan has been executed. No repair was run, no migration was pushed, no policy was created, no history was modified, no application code was changed.

## Current Blocker

`supabase/migrations/00014_storage_rls.sql:1`:

```sql
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
```

fails on the hosted canonical project with `must be owner of table objects (SQLSTATE 42501)` at statement 0. Remote history stands at `00001` through `00013` applied, `00014` through `00020` unapplied. The failure is a platform ownership constraint, not a defect in migration intent.

## Proposed Migration Files

1. `supabase/migrations/20260903000001_storage_rls_remediation.sql`
   Purpose: carry the four `audit-files` storage policies verbatim from `00014_storage_rls.sql:3-45` (upload, view, update, delete), preceded by a read-only guard that fails loudly if `storage.objects` RLS is ever not enabled. Never alters RLS state. Timestamps sort after `00020` lexicographically, so push order is deterministic.
2. `supabase/migrations/20260903000002_lawyer_policy_remediation.sql`
   Purpose: correct the two dead lawyer assigned-request policies from `00020` via `ALTER POLICY` (no DROP), preserving names, table, operations, and roles while fixing the `USING` and `WITH CHECK` expressions to match through `lawyers.user_id`. Must run after `00020`; filename ordering enforces this.

Both files carry a `DRAFT, NOT EXECUTED` header and must not be applied without the approvals in the final section.

## Exact SQL Summary

### Storage remediation file, statement by statement

1. Guard `DO` block: single `SELECT` against `pg_class` joined to `pg_namespace` checking `relrowsecurity` on `storage.objects`. Read-only. Raises a descriptive exception when RLS is absent, which rolls back the file with no partial effects.
2. Four policy blocks, each a `DO` block containing one `CREATE POLICY` with `EXCEPTION WHEN duplicate_object THEN NULL`, copied verbatim from `00014`:
   - Upload INSERT with bucket plus folder-ownership check.
   - View SELECT with bucket plus folder-ownership check.
   - Update USING with bucket plus folder-ownership check. This is the only UPDATE policy for the bucket in the entire history.
   - Delete USING with bucket plus folder-ownership check.
3. No `ALTER TABLE`, no `DROP POLICY`, no `GRANT`, no other object touched.

Unavoidable differences from `00014`: the file omits the `ALTER TABLE` line (the entire point) and adds the guard block plus provenance header. Policy SQL itself is byte-identical apart from surrounding whitespace. The duplicate guards are retained from the source so reruns are safe; the migration system additionally guarantees single execution via version tracking.

A note on `CREATE POLICY IF NOT EXISTS`: PostgreSQL has no such syntax, so it was correctly not used. The `DO` plus exception-handler pattern from the source file is the appropriate mechanism and was preserved.

### Lawyer remediation file, statement by statement

1. `ALTER POLICY "Lawyers can view assigned consultation requests"`: replaces `USING (auth.uid() = lawyer_id)` with an `EXISTS` subquery matching `lawyers.id = consultation_requests.lawyer_id AND lawyers.user_id = auth.uid()`.
2. `ALTER POLICY "Lawyers can update assigned consultation requests"`: same replacement for both `USING` and `WITH CHECK`.
3. No other policy touched. In particular the verified-only public select, the owner policies, and all admin policies from `00020` are unchanged.

Why `ALTER POLICY` rather than drop plus create: it changes only the predicate expressions, preserves policy identity, cannot delete the wrong object, and re-applying identical definitions succeeds, so the file is idempotent. If `00020` has not applied, both statements fail loudly naming the missing policy, which is the desired behavior, not silent misconfiguration.

## Full Repair Command (Unexecuted)

```text
npx supabase migration repair --linked --status applied 00014
```

Verified against the installed CLI (`supabase migration repair --help`, CLI 2.109.1): usage is `supabase migration repair [flags] <version...>`, `--status` accepts `applied` or `reverted`, `--linked` targets the linked project, and the version identifier `00014` matches the format shown by `supabase migration list` (`local: 00014`).

- Targets: the linked canonical project only. Confirm the link first with `supabase migration list` and confirm it shows the new project before running repair.
- Changes: exactly one row in the remote migration history table, marking version `00014` applied. No schema object is created, altered, or dropped by this command.
- Does not change: any table, policy, function, file, or application code.
- Safe only after: both draft migrations exist, have been reviewed, and are present in `supabase/migrations`, because the repair asserts that `00014` intent is satisfied by the platform (RLS verified live) plus the carried policies (applied by the normal push immediately after repair).

## Exact Execution Order (Proposed, Not Executed)

```text
Step 1: Approve this plan, both draft SQL files, the repair command,
        the ordering below, all residual items, and the retired-project
        data decision (default: clean init, no data moved).
Step 2: Confirm CLI link targets the canonical project
        (migration list shows the new project; 00001-00013 applied).
Step 3: Run the repair command from Step 1 of this section.
Step 4: Run db push. Expected: 00015, 00016, 00017, 00018, 00019, 00020,
        20260903000001, 20260903000002 apply with zero errors.
Step 5: Run the verification battery from the next section.
Step 6: If any step fails, stop. Diagnose against a copy of the error.
        Fix forward with a new migration. Never edit 00001-00020 and
        never repair backward except as an explicitly approved recovery.
```

Ordering rationale: repair must precede push because push cannot skip `00014`; the replacement files must exist and be reviewed before the repair so the window in which history claims `00014`-applied without its policies is closed by the immediately following push; the lawyer correction must sort after `00020` because `ALTER POLICY` requires the policies to exist.

## Expected Migration History

Before (verified live):

```text
00001 through 00013 applied
00014 through 00020 unapplied
```

After (proposed):

```text
00001 through 00013 applied (unchanged)
00014 recorded applied via repair, justified by verified platform RLS
        plus policy carriage in 20260903000001
00015 through 00020 applied via normal push
20260903000001_storage_rls_remediation applied
20260903000002_lawyer_policy_remediation applied
```

Historical files `00001` through `00020` remain byte-identical throughout.

## Verification Plan (Read-Only Unless Noted)

Run after execution, in order. All database checks are read-only selects.

1. Migration history: `supabase migration list` shows every file from `00001` through `20260903000002` with remote markers present and zero pending.
2. Storage RLS: `relrowsecurity` true on `storage.objects` (already verified pre-execution; re-confirm unchanged).
3. Storage policies: `pg_policies` for `storage.objects` shows exactly the three `00002` policies plus the four carried policies with the exact names from `00014` (upload, view, update, delete with `audit-files` in the name). Confirm the UPDATE policy exists; it is the proof the remediation landed.
4. `audit-files` bucket still private (`select id, public from storage.buckets`).
5. Lawyers: `lawyers` and `consultation_requests` tables exist with RLS enabled; both enums exist; policies match `00020` plus the two corrected predicates (compare `pg_policies` output against the migration texts).
6. Audits: `deal_type` column exists with the freelance and generic check.
7. Security probes as anonymous: `audits` still denies (401 permission denied); `lawyers` returns only verified rows (insert one verified test row only if the lawyer test plan explicitly allows it, otherwise verify the policy text plus an empty result); `consultation_requests` denies anonymous.
8. RPCs: `increment_usage`, `get_shared_document`, `sign_shared_document` present and `SECURITY DEFINER`; anonymous call to `increment_usage` still returns default-deny.
9. Application sanity: `npx tsc --noEmit` and `npm run build` pass (no application changes occurred, so this is a cheap consistency gate, not a product test).

## Rollback and Compensation Plan

Migrations apply transactionally per file: a failing file rolls back that file only, leaving earlier files applied. There is no partial-file state to clean up.

- If the storage remediation file fails: diagnose the exact statement. The likely causes are a missing bucket (then the `audit-files` insert from `00002` must be investigated, since this plan assumes it) or a duplicate policy name collision (then inspect which identically named policy already exists and where it came from before proceeding). Fix forward with a new migration. Never edit the draft file after it has applied anywhere; supersede it instead.
- If the lawyer correction fails: the likely cause is `00020` not applied (ordering violated). Confirm history, then proceed in order.
- If the repair was run in error before approval: `migration repair --linked --status reverted 00014` restores the pending state. This command is documented here as an escape hatch only and must itself be approved before use.
- Under no circumstance: edit `00001` through `00020`, drop and recreate policies outside a reviewed migration, or mark versions applied without the corresponding database state verified.

## Reproducibility

A future fresh hosted project will fail `db push` at unmodified `00014` exactly as observed here, because the platform ownership constraint is environmental, not data-dependent. The reproducible bootstrap is therefore: push through `00013`, run the documented repair for `00014`, push the remainder including the two remediation files. The policy content itself is fully portable (it lives in versioned files), and the repair justification in this plan applies identically to every fresh project. What cannot be eliminated without editing `00014`, which is forbidden, is the per-project repair step. This limitation is stated plainly so no future operator mistakes the repair for a one-time event.

## Security Impact

- No RLS weakened anywhere. Every added policy is permissive-owner-scoped, matching the existing model.
- Anonymous posture unchanged: the storage policies all require `auth.uid()` folder ownership; the anonymous logging and lawyer paths are untouched by the storage file.
- The lawyer correction strictly implements the access the original file evidently intended (policy names say assigned requests). Before correction those policies deny everyone including assigned lawyers; after correction exactly the assigned lawyer gains access. No other principal gains anything.
- The wider `00002` storage policies (folder-scoped without bucket filter on view and delete) are retained unchanged by this remediation. See residual items.
- No secrets are introduced, moved, or printed by any step. The repair and push commands take no credential arguments in the forms given.

## Residual Risks

1. Per-project repair debt: every fresh hosted project repeats the `00014` failure plus repair cycle until and unless the history-edit constraint is revisited by explicit decision.
2. Retained wide `00002` policies: view and delete on `storage.objects` remain folder-scoped without a bucket filter. Additive remediation does not narrow them.
3. Anonymous logging spam surface from `00015`: null-user inserts bounded only by application-layer anonymous rate limiting.
4. Pre-fix rate limiter goes live with `00018`: strictly better than the current canonical state but still consumes quota on failure paths per the fixed check-first logic; confirm behavior under the new function after push.
5. Repair misuse: an unjustified repair is tooling-identical to a justified one. This plan plus its approvals is the standing justification record; keep it with the repository.

## Human Approvals Required

1. Approval of the storage remediation SQL exactly as drafted in `20260903000001_storage_rls_remediation.sql`.
2. Approval of the lawyer policy correction SQL exactly as drafted in `20260903000002_lawyer_policy_remediation.sql`.
3. Approval of the repair command `npx supabase migration repair --linked --status applied 00014`, its justification text referencing this plan, and who performs it.
4. Approval of the execution ordering in the Exact Execution Order section.
5. Acceptance of all residual items: retained `00002` policies, anonymous logging spam note, per-fresh-project repair runbook, and no retired-project data migration.
6. Confirmation that no data migration from the retired project is required (default stands: clean canonical init).
