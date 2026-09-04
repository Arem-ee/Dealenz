# Phase 4A Blocker — Supabase Migration Ownership Remediation Analysis

## 1. Current Blocker

Migration `supabase/migrations/00014_storage_rls.sql` fails on its first statement during `supabase db push` to the canonical hosted project:

```text
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;   (00014_storage_rls.sql:1)
ERROR: must be owner of table objects (SQLSTATE 42501)
At statement: 0
```

Remote migration history stands at `00001` through `00013` applied, `00014` through `00020` unapplied (verified via `supabase migration list`). Because `db push` applies files transactionally and in order, `00014` had zero effect and the chain is halted. No history was edited and no repair was run. Phase 4B has not started.

## 2. Actual Live State

### storage.objects RLS state (verified live)

`relrowsecurity` is `true` and `relforcerowsecurity` is `false` on `storage.objects` (linked read-only query against `pg_class` joined to the `storage` schema). RLS is therefore already enabled by the platform. The `ALTER TABLE` statement is unnecessary on hosted Supabase and can never succeed there because the table is platform-owned. This was verified, not assumed.

### Existing policies on storage.objects (verified live)

```text
Users can delete own audit files  (DELETE)
Users can upload own audit files  (INSERT)
Users can view own audit files    (SELECT)
```

All three come from `00002_expand_audits.sql:13-26` (applied). No UPDATE policy exists. No policy from `00014` exists, consistent with its full rollback.

### The four intended policies in 00014 (read from the file)

From `supabase/migrations/00014_storage_rls.sql:3-45`, each wrapped in a `DO` block that swallows only `duplicate_object`:

1. `Users can upload own files to audit-files`, INSERT, `WITH CHECK (bucket_id = 'audit-files' AND auth.uid()::text = (storage.foldername(name))[1])`. Authenticated users only. No anonymous involvement. No service role involvement. Permissive (allows matching inserts).
2. `Users can view own files in audit-files`, SELECT, `USING (bucket_id = 'audit-files' AND auth.uid()::text = (storage.foldername(name))[1])`. Authenticated users only. Permissive.
3. `Users can update own files in audit-files`, UPDATE, `USING (bucket_id = 'audit-files' AND auth.uid()::text = (storage.foldername(name))[1])`. Authenticated users only. Permissive. This is the only UPDATE policy for the bucket anywhere in the history.
4. `Users can delete own files in audit-files`, DELETE, `USING (bucket_id = 'audit-files' AND auth.uid()::text = (storage.foldername(name))[1])`. Authenticated users only. Permissive.

None exists live. All four are still needed for the intended behavior, in particular the UPDATE policy, which has no equivalent anywhere else.

### Important nuance, 00002 versus 00014

The live `00002` policies scope by folder only, with no `bucket_id` filter on SELECT and DELETE (see `00002_expand_audits.sql:13-26`; only the INSERT checks `bucket_id`). The `00014` policies add `bucket_id = 'audit-files'` scoping. Because RLS policies combine permissively, adding the `00014` policies does not weaken anything. It also does not remove the wider `00002` policies. Whether the wider `00002` policies should later be tightened is a separate hardening decision, explicitly out of scope for this remediation, which must be purely additive.

## 3. Migration Dependency Analysis (00014 through 00020)

```text
Migration: 00014_storage_rls.sql
Purpose: Ensure RLS on storage.objects and add four bucket-scoped audit-files policies.
Objects created or changed: storage RLS state (statement 1), four policies on storage.objects.
Dependencies: storage schema, auth schema helpers, audit-files bucket from 00002 (applied).
Security impact: Adds owner-scoped UPDATE capability that is currently missing; otherwise duplicates existing coverage with tighter bucket scoping.
Can it run independently? NO. Statement 1 fails on hosted Supabase regardless of context.
Depends on 00014 succeeding? It IS 00014.
```

```text
Migration: 00015_anonymous_logging.sql
Purpose: Allow anonymous INSERT into system_logs where user_id IS NULL, for auth-failure logging.
Objects created or changed: one INSERT policy on system_logs.
Dependencies: system_logs table from 00005 (applied). No dependency on 00014.
Security impact: Narrow (null-user rows only), but opens an unauthenticated write path. Spam and abuse potential should be noted; application-layer rate limiting already exists for the anonymous endpoint.
Can it run independently? Technically YES. Procedurally NO, db push is strictly sequential and cannot skip 00014.
Depends on 00014 succeeding? NO technically. Blocked only by push ordering.
```

```text
Migration: 00016_add_reviewed_to_document_versions.sql
Purpose: Add reviewed column plus index plus owner-scoped UPDATE policy on document_versions.
Objects created or changed: one column, one index, one policy.
Dependencies: document_versions table from 00012 (applied). No dependency on 00014.
Security impact: Owner-scoped only. Without it, application paths that update document rows (mark-as-reviewed) fail closed.
Can it run independently? Technically YES. Procedurally NO, same ordering reason.
Depends on 00014 succeeding? NO technically. Blocked only by push ordering.
```

```text
Migration: 00017_user_id_document_versions_backfill.sql
Purpose: Backfill NULL user_id values from parent audits, enforce NOT NULL, idempotently ensure the SELECT policy.
Objects created or changed: data fix plus constraint plus conditional policy ensure.
Dependencies: document_versions and audits (applied). No dependency on 00014. Safe on a fresh project (backfill matches zero rows).
Security impact: Tightens ownership (NOT NULL user_id). Positive.
Can it run independently? Technically YES. Procedurally NO, same ordering reason.
Depends on 00014 succeeding? NO technically. Blocked only by push ordering.
```

```text
Migration: 00018_fix_rate_limit.sql
Purpose: Rewrite increment_usage to check-first-then-increment, plus three system_logs indexes.
Objects created or changed: one function (CREATE OR REPLACE), three indexes.
Dependencies: usage_tracking and increment_usage from 00004 (applied). No dependency on 00014.
Security impact: Positive. The live function is the pre-fix version that increments unconditionally, consuming quota on every call including failures. Idempotent and safe to apply (CREATE OR REPLACE, IF NOT EXISTS indexes).
Can it run independently? Technically YES. Procedurally NO, same ordering reason.
Depends on 00014 succeeding? NO technically. Blocked only by push ordering.
```

```text
Migration: 00019_add_deal_type.sql
Purpose: Add deal_type column with freelance and generic check constraint plus index.
Objects created or changed: one column, one check constraint, one index.
Dependencies: audits table (applied). No dependency on 00014.
Security impact: None beyond schema. Application deal-type-aware flows depend on this column existing.
Can it run independently? Technically YES. Procedurally NO, same ordering reason.
Depends on 00014 succeeding? NO technically. Blocked only by push ordering.
```

```text
Migration: 00020_lawyers_and_consultations.sql
Purpose: Lawyer and consultation schema with RLS, plus anon grants for the existing share and sign functions.
Objects created or changed: two enums, two tables, four indexes, eleven policies, two GRANTs.
Dependencies: audits and auth.users (applied), get_shared_document and sign_shared_document from 00013 (verified present and SECURITY DEFINER via live query). No dependency on 00014.
Security impact: Mixed. The verified-only public select policy is the critical safety gate and is correct. The admin policies follow the existing user_metadata pattern. DEFECT FOUND (see below): the lawyer assigned-request policies compare auth.uid() to lawyer_id, but lawyer_id references lawyers(id), a generated row UUID, not the lawyer user UUID in lawyers.user_id. Those two policies can never match and are effectively dead. This must be corrected by a follow-up forward-only migration, not by editing 00020.
Can it run independently? Technically YES. Procedurally NO, same ordering reason.
Depends on 00014 succeeding? NO technically. Blocked only by push ordering.
```

Summary: no migration from `00015` to `00020` depends on any object created by `00014`. The entire blockage is procedural (strictly sequential push) plus the single un-runnable statement at `00014:1`.

## 4. Option A Analysis

Treat the ownership-blocked statement as platform-satisfied and carry the intended policy semantics forward in a new migration, without touching history.

What it requires, exactly:

1. Verify and record that RLS is enabled on `storage.objects` (done, section 2).
2. Create a new forward-only migration (next number in sequence) containing the four storage policies copied verbatim from `00014_storage_rls.sql:3-45`, with a header comment citing `00014`, the `SQLSTATE 42501` evidence, and the reason the `ALTER TABLE` is not repeated. Optionally include a read-only guard block that asserts RLS is enabled and raises a clear error otherwise, so the migration fails loudly on any platform where the assumption does not hold.
3. Record `00014` in remote history as applied via the Supabase repair mechanism, with the justification that statement 1 is satisfied by the platform (verified live) and statements 2 through 5 are carried by the new migration. The repair record must reference this analysis.
4. Run `db push`, which then applies `00015` through the new migration in order.

How history remains reproducible: the repository still contains the unmodified `00014` file, so the file history is intact. The remote history gains one repair entry plus one additive migration, both documented. A reviewer can reconstruct exactly what happened and why.

Limitation that must be stated plainly: on any future fresh hosted project, unmodified `00014` will fail again at `db push`, and the same repair step must be repeated there per a documented bootstrap runbook. Option A does not make fresh-project setup fully automatic while `00014` remains unedited, and editing it is forbidden. The new migration file itself is fully portable and works everywhere.

## 5. Option B Analysis

Apply the four storage policies through an out-of-band Supabase-supported mechanism, then repair history so repository state and remote history agree.

What it requires, exactly:

1. Execute the four `CREATE POLICY` statements from `00014:3-45` through a privileged channel (dashboard SQL editor or equivalent), after confirming the executing role is permitted to create policies on `storage.objects`. Whether the dashboard role can do this was not verified in this phase and must be tested before relying on it.
2. Verify the four policies exist with the intended definitions (compare `pg_policies` output against the migration text).
3. Repair remote history to mark `00014` applied, with justification recorded.
4. Run `db push` for `00015` through `00020`.

Safety assessment: the policies themselves are safe to apply independently (permissive, owner-scoped, bucket-scoped; they only add to existing coverage). The risk is procedural, not semantic: policy SQL executed outside version control is unreviewed by the normal code path, untested by CI, and must be manually replicated on every future project. It also creates a window in which the database and the repository disagree, closed only by the subsequent repair.

Fresh-project reproducibility: worse than Option A. Every future project needs the same manual SQL plus the same repair, with no versioned artifact carrying the policy definitions. Hidden drift risk is high: a typo or skipped statement in the manual step would diverge silently from the repository.

Dashboard SQL is therefore not recommended merely for convenience. It is the fallback only if a new migration file cannot be used for some reason.

## 6. Comparison Matrix

| Criterion | Option A (new migration carries policies) | Option B (out-of-band SQL plus repair) |
|---|---|---|
| Preserves historical migrations | Yes, `00014` untouched | Yes, `00014` untouched |
| Forward-only | Yes, new migration file | Partial, manual SQL sits outside the migration chain |
| Reproducible fresh project | Partial, repair step must be repeated per project with runbook | Partial and weaker, manual SQL plus repair must both be repeated |
| Remote migration history accuracy | Accurate after repair, with justification recorded | Accurate after repair, with justification recorded |
| Security risk | Low, policy SQL reviewed in version control | Medium, unreviewed manual execution window |
| Operational complexity | One repair plus one normal push | Manual SQL plus verification plus repair plus push |
| Future migration safety | Normal, chain continues from the new file | Normal after repair, but no artifact records the manual step |
| Supabase compatibility | Full, uses only supported migration and repair operations | Depends on an unverified assumption about dashboard role privileges |
| Drift risk | Low, single source of truth remains the repository | High, database can diverge from repository silently |
| Recommended? | Yes | No, fallback only |

## 7. Recommended Remediation

Option A. The policy definitions belong in version control where they can be reviewed, linted, tested, and re-applied. The single repair action is explicit, justified by live evidence in section 2, and recorded. Option B achieves the same end state with strictly worse auditability and reproducibility.

Two companion items belong in the same remediation window:

1. A follow-up forward-only migration correcting the dead lawyer assigned-request policies in `00020` (`consultation-actions` compare `auth.uid()` to `lawyer_id`, which references `lawyers(id)` rather than the lawyer user id in `lawyers.user_id`). These policies can never match as written. Correct them to join through the `lawyers` row ownership (for example by matching the request lawyer row to the calling user), without touching `00020`.
2. No change to the wider `00002` storage policies during remediation. Tightening them is a separate hardening decision with behavior-change implications, not a bootstrap fix.

## 8. Exact Proposed Sequence (DO NOT EXECUTE)

```text
Step 1: Confirm this analysis and obtain explicit approval to proceed.
Step 2: Create the new forward-only migration file carrying the four
        storage policies verbatim from 00014_storage_rls.sql:3-45, with
        a header citing 00014, the SQLSTATE 42501 evidence, and the
        platform-satisfies-ALTER rationale. Include a read-only guard
        that fails loudly if storage.objects RLS is ever not enabled.
Step 3: Create the follow-up forward-only migration correcting the dead
        lawyer assigned-request policies from 00020 (auth.uid() must be
        matched through lawyers.user_id, not compared to lawyers.id).
Step 4: Run migration repair to record 00014 as applied, citing this
        analysis and the live RLS verification in section 2.
Step 5: Run db push and confirm 00015 through the two new migrations
        apply with zero errors.
Step 6: Re-run the verification battery: migration list shows all files
        applied; pg_policies shows the four storage policies plus the
        corrected lawyer policies; lawyers and consultation_requests
        exist with RLS enabled; deal_type exists on audits; storage
        bucket audit-files remains private; anonymous probes still deny
        appropriately.
Step 7: Record the bootstrap runbook note: every future fresh hosted
        project needs the Step 4 repair for unmodified 00014 before push.
```

## 9. Migration History State

Current remote history (verified via migration list):

```text
00001 through 00013 applied
00014 through 00020 unapplied
```

Proposed final state after the approved sequence:

```text
00001 through 00013 applied (unchanged)
00014 recorded applied via repair, justified by verified platform RLS
        plus policy carriage in the new migration
00015 through 00020 applied via normal push
00021 (new, storage policies carried forward) applied
00022 (new, lawyer assigned-policy correction) applied
```

Historical files `00001` through `00020` remain byte-identical throughout.

## 10. Fresh-Project Reproducibility

Not completely preserved, and this limitation is stated plainly. Because `00014` is frozen with an un-runnable statement on hosted Supabase, every future fresh hosted project will fail `db push` at `00014` exactly as observed here, and will need the documented repair step before continuing. Option A keeps everything else reproducible: the policy content lives in a versioned file, the repair is a single recorded administrative action, and the runbook step is identical every time. Option B would additionally require manual SQL per project and is therefore worse on this criterion.

A fully automatic fresh-project push would require editing `00014`, which is forbidden. If that constraint is ever revisited by explicit decision, the correct edit would be guarding the `ALTER TABLE` behind an ownership or RLS-state check, but that decision is out of scope for this analysis.

## 11. Risks

1. Repair misuse: marking `00014` applied without the carrying migration would silently drop the UPDATE policy and bucket scoping. Mitigation is the enforced pairing in the Step 2 through Step 4 sequence plus the section 6 verification battery.
2. Wider `00002` policies remain: the remediation is intentionally additive, so folder-scoped-but-bucket-unscoped view and delete policies persist. No weakening occurs, but the residual width should enter the hardening backlog, not this remediation.
3. Dead lawyer policies ship live with `00020`: mitigated by the Step 3 correction migration in the same window, before any lawyer matching depends on those policies.
4. Anonymous logging policy in `00015` opens null-user inserts into `system_logs`: narrow by construction, but spam potential exists. Application-layer rate limiting on the anonymous endpoint already bounds it. Note for the hardening backlog, not a blocker.
5. Pre-fix rate limiter goes live with `00018`: this is strictly better than the current state (no limiter fix at all on the canonical project) and matches the intended semantics. No additional risk beyond normal push verification.
6. Tooling trust: the repair operation itself must be run by an authorized human with the justification recorded. An unjustified repair is indistinguishable in tooling from a justified one, which is why this analysis exists as the standing justification record.

## 12. Human Approval Required

Before any remediation is executed, approve explicitly:

1. Option A over Option B, including the repair of `00014` as described.
2. The exact contents of the two new migration files (policy carrier plus lawyer policy correction) after they are drafted and before they are applied.
3. The repair command, its justification text referencing this analysis, and who performs it.
4. Acceptance of the residual items: wider `00002` policies retained for now, anonymous logging spam note, and the per-fresh-project repair runbook step.
5. Confirmation that no data migration from the retired project is required (default remains clean canonical init).
