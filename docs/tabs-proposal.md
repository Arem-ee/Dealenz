# Six-tab research proposal (round 2)

Researched 2026-09-29. Baseline: working tree with the whole-program changes in place.
External sources: CLM dashboards (Legistify / SpotDraft / BindLegal / ClearContract),
Superhuman triage, PandaDoc / Google versioning guides, DocuSign signing and expiry docs,
RenewOps / Oblispace obligation tracking, prompt-library UX (PrompTessor / meinGPT / ExtendLM).

## Cross-cutting defects

1. **Last silent cap: Home shows 30 deals with no count line.** `listThreads` returns
   `threads.slice(0, 30)` (`src/lib/chat/actions.ts:417`). Every other tab has "showing N"
   lines; Home has queue counts but nothing saying the table is truncated. A 31st deal
   vanishes silently.
2. **Portfolio numbers aren't drill-downs.** Dashboard research is unanimous (Legistify,
   Jodoo, BindLegal): any KPI that can't click through to its records is wallpaper. Open
   Issues / Avg Risk / Resolved are static text; only the bubbles link anywhere.
3. **Terminal states with no action.** Tracker is fully read-only: obligations can't be
   completed or dismissed from Tracker or the monitoring workspace (no status-update action
   exists; `MonitoringWorkspace` only creates/sends). A fulfilled obligation sits "Overdue"
   forever. Same family: signer `expired` pill can never fire (nothing in the codebase sets
   that status), and declined rows show no date or reason.
4. **Ceremonies never expire.** DocuSign's pattern is a 120-day default expiry with a 6-day
   "Expiring" warning. Dealenz has neither, so a dead "waiting 400d" row looks identical to
   an active one, and Resend has no nudge ladder behind it.
5. **Rules are global-only and edit-hostile.** No inline edit (delete + retype), no
   per-deal-type scoping (a freelance rate rule fires on a lease), no "save as rule" from
   chat (the meinGPT pattern). Prompt-library consensus is edit / favorite / scope; we have
   none of the three.
6. **Hard constraint: inbox triage can never sync to Gmail.** OAuth scope is
   `gmail.send + gmail.readonly` (`src/lib/gmail/tokens.ts:38`). Done / Snooze are
   Dealenz-local permanently unless scope expands and forces re-consent. Product decision,
   not an engineering task.
7. **Versions have no visible "why".** `change_summary` is stored in redraft provenance
   (`src/lib/signing/store.ts:119`) but surfaced nowhere. Version-control consensus (Google
   named versions, CatchDiff changelogs): every version needs a rationale, or history is
   just timestamps.

## Per-tab top actions

- **Deal analysis** — "showing 30 most recent" count line; strip numbers drill into table
  filters; Upcoming rows framed as decisions (Renewal / Notice / Payment labels already
  exist in Tracker; Home shows title + date only).
- **Inbox** — keyboard triage (J / E / S + `?` overlay; Superhuman pattern, feasible
  web-first); bulk "Get me to zero" (Done is localStorage, so undo is free); timed snooze
  return and Gmail sync stay parked behind the scope decision.
- **Drafts** — status chips (search exists, chips are cheap); surface `change_summary` per
  version; restore-any-version-as-new-draft (same `create_redraft_version` primitive);
  version compare is the expensive one.
- **Signing** — verify whether `decline_as_invitee` stores a reason, then show decline
  date / reason on Done rows; reassign = revoke (`revoke_signer_invite` exists) + invite in
  one button; expiry + pre-expiry warning (needs columns + cron).
- **Tracker** — complete / dismiss obligation buttons (no migration:
  `monitoring_events.status` already supports `completed` / `dismissed`, Tracker filters
  `active`); link each obligation to its evidence clause (ObliSpace pattern; `evidence`
  JSONB already on the event); notice-date-first display when a renewal has a notice event.
- **Library** — inline edit; per-deal-type scoping; "save as rule" from chat; fired-rule
  attribution needs logging (parked). Folders / tags unnecessary (cap is 20 rules).

## Sequence

- **Batch 1** (read-path + tiny mutations, near-zero risk): Home cap count line; strip
  drill-downs; drafts status chips; tracker complete / dismiss; library inline edit;
  signing counterparty reassign (revoke + invite, migration-free). NOTE: decline
  date / reason moved to Batch 2: verified `decline_as_invitee`
  (`supabase/migrations/00044_review_collaboration_signing.sql:555`) stores neither a
  reason nor a timestamp, and `document_signers` has no such columns, so surfacing them
  needs a small migration.
- **Batch 2**: keyboard triage + bulk zero; drafts change-summaries + restore + compare;
  signing reassign + expiry / warnings; tracker evidence links + notice-first; library
  scoping + save-as-rule.
- **Parked**: Gmail modify-scope re-consent; timed snooze backend; auto-renew / opt-out
  columns; fired-rule logging; named checkpoints; copy-only recipients.

## Build status

- **Batch 1 (built, verified green):** Home cap line; strip drill-downs; drafts status
  chips; tracker complete / dismiss + cleared section; library inline edit; signing
  counterparty reassign.
- **Batch 2 (built, green except one external failure):** inbox keyboard triage
  (j/k/Enter/e/s/?) + bulk zero with undo; drafts `change_summary` lines + restore +
  version compare (`src/lib/diff/lines.ts`); signing invitation expiry (optional 1-120
  days at invite, warnings, `trg_reject_expired_signing` guard, daily
  `/api/cron/signing-expiry` pass); tracker evidence quotes with source links +
  notice-date-first display; library per-deal-type rule scopes
  (`standing_instructions.deal_types`, migration 00089) wired through the Ask pipeline
  + save-as-rule on assistant messages.
- **Deploy prerequisite:** apply migrations before deploying: `npm run db:migrate`
  (00089 scope column, 00090 expiry column + trigger). New code degrades gracefully
  without them (expiry/scopes omitted or read as absent) except scoped rule writes,
  which fail honestly until 00089 lands.
- **Observation, not mine:** the working tree also contains an unrelated uncommitted
  landing rewrite (`src/app/page.tsx`, `src/components/landing/`,
  `src/components/logo.tsx`, `public/favicon.svg`) that dropped the "Illustrated
  example" + freelance-scope honesty markers guarded by `browser-qa.test.ts`. That
  test now fails; the landing author should restore the labels or the team should
  consciously update the test. Left untouched.
