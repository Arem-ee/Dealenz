# Deferred work — parked by choice, not forgotten

Items below were investigated and deliberately parked. Each entry records
**why** (so nobody re-litigates it blindly) and **what un-parks it** (the
trigger to pick it back up). Engineering-parked items live here; items
waiting on the founder or an external party are under Blocked.

Last reviewed: 2026-09-26.

## Parked (engineering)

### 1. Portfolio aggregate RPC
- **What:** a Postgres function (e.g. `get_portfolio_counts`) computing
  per-audit open-issue counts, resolved counts, risk level/score, and top
  categories server-side, replacing the JS parsing of full
  `structured_data` blobs in `listThreads` (currently hauled twice per
  dashboard load — shell + page).
- **Why parked:** needs a SQL migration (function + RLS) that cannot be
  verified end-to-end in this environment — tests mock Supabase, no live
  DB. Shipping unverifiable database changes violates the repo's evidence
  rule. Payoff also shrank on inspection: App Router renders layout + page
  concurrently, so this saves Supabase bill/DB load, not user latency.
- **Benefit when done:** lower Supabase egress + DB load at scale.
  Invisible to users.
- **Un-park trigger:** usage or Supabase costs bite, or a staging project
  is available to verify the SQL (row-for-row match vs the JS computation)
  before prod. Migration-free wins already shipped instead: shell
  parallel batch, concurrent auth+threads, dropped conversations query
  (`src/app/dashboard/page.tsx`, `src/components/app-shell.tsx`).

### 2. Remaining `select("*")` trims
- **What:** ~56 `select("*")` call sites audited; exactly one trimmed
  (`listMonitoringEvents` → 11 named scalars, all three consumers'
  field sets verified).
- **Why parked:** the rest are single-row reads (where `*` costs nothing)
  or feed untyped `Record` consumers where dropping a column breaks
  something no test covers. Risk without measurable gain.
- **Benefit when done:** near-zero. Listed for completeness.
- **Un-park trigger:** a specific query shows up in slow-query logs —
  trim that one with its consumers verified, same as the monitoring case.

### 3. Cold-start elimination (reserved instances)
- **What:** 1–3s first-hit penalty after idle on `/api/billing/checkout`
  and AI routes.
- **Why parked:** not a code problem — yields only to Vercel reserved
  instances, a paid billing toggle, not a commit.
- **Benefit when done:** real speed on cold hits.
- **Un-park trigger:** checkout/AI volume justifies the spend.

## Blocked (needs founder or external party)

### A. Vercel Production env vars
`PADDLE_API_KEY` (`pdl_live_…`), `PADDLE_WEBHOOK_SECRET`,
`PADDLE_PRICE_STARTER/STANDARD/PRO` (+ `_GBP`/`_EUR` variants to sell
those currencies — otherwise only USD is offered, by design),
`NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` (`live_…`). Missing keys are the 503
path behind "Checkout is not available right now". See
`VERCEL_ENV_TEMPLATE.md`.

### B. Paddle default payment link approval
Paddle → Checkout → Checkout settings → Default payment link, **approved**.
Unapproved = the hosted-checkout fallback URL is dead. Then create
GBP/EUR prices per package if those currencies should sell.

### C. Gmail OAuth verification
Testing-mode test users unblock development now; full verification for
the restricted `gmail.readonly` scope takes weeks (Google). Grants
expire after 7 days until verified.

### D. Supabase migrations
Run `supabase db push` for pending migrations (incl. `00083` credit
purchase status revocations) against the linked project before the
flows that depend on them go live.

## Shipped (was deferred, now done — do not re-park)

- Ask answer streaming (`/api/ask/stream`, token port, progressive UI).
- Deal-thread stage streaming (plan sub-stages + direct-path card).
- Dashboard aggregation + monitoring column trim.
- Full-audit repair batch: reserve replay pending-only, execution requeue arms, sign_as_owner party binding + version advancement, completion trigger, upload replace-on-retry + dedupe + orphan cleanup, package audit lock, invite dedupe + stable keys, refund fail-closed, settlement retry+report, gmail row validation, sign-owner gates, anon ceremony throttles, double-submit guards (composer/confirm/approve/generate), ask resume + retry + input preservation, mobile ask switcher, password-reset landing, RPC + gmail_tokens grants.
