# Custom Analytics Market Research

Date: 2026-10-08. Method: vendor/platform documentation (full text
fetched). Nothing here is built yet; see `deliberation.md`.

## 1. What custom analytics means in practice

### Saved reports (SKU.io; CEF Core; Zuora)
- A report = named definition (fields + filters + grouping + chart) that
  re-runs on demand. Owners edit/delete/change visibility; shares carry
  view/edit permissions; fork creates a personal copy; export runs to
  CSV/Excel/PDF/JSON; schedules push runs out.
- **Drill-down**: aggregated rows expand to underlying detail records with
  the same definition plus drill values — reports answer "why", not just
  "how many".
- **Validation before execution**: formulas checked against a function
  whitelist; SQL preview reviewed; unauthorized table access rejected.

### Builder shapes (CEF Core; AutomationEdge; Jetstack)
- **Visual builder**: pick tables → fields → filters (operator + value) →
  joins from declared relationships → preview → execute. Guards: row caps
  (10k paginated), statement timeouts (30s cancel), mandatory date bounds
  guidance.
- **Parameterized templates**: SQL lives server-side with server-injected
  parameters (tenant id, user id, dates). Users pick parameters, never
  write SQL. Custom SQL exists only behind an explicit power-user gate
  with a declared parameter contract.
- Jetstack's rule of thumb: prefer configured queries until custom SQL is
  genuinely necessary; fixed (non-overridable) parameters for security
  constraints, regular parameters for user-refinable defaults.

## 2. The security doctrine (Embeddable — decisive)

- Self-serve analytics turns every user into a query author; permissions
  in dashboards/queries don't scale — **security must live in the data
  layer, before any query is generated**.
- Consequences, all adopted as requirements: static and self-serve share
  the **exact same code path**; RLS applies **before** user filters;
  users **never control the security context**; users pick from
  **exposed dimensions/measures only** — raw SQL is not a user input.
- Test with preset security contexts (Customer A vs B); log every query
  with its context.

## 3. CLM analytics content (Sirion; Bind research; Icertis)

- Cycle time, adherence rates, **fallback usage**, escalation frequency,
  risk incidents; recurring flags; friction points (which clauses get
  pushed back, which fallbacks counterparties accept); renewal capture.
- Negotiation outcomes feed playbook refinement — the loop our pairing
  D7 deferred here: acceptance-measured re-ranking starts as analytics.

## 4. Dealenz's current position

- Owns: fixed aggregates (`reports/actions`: pipeline, turnaround,
  activity, obligations, spend, signed portfolio) + client-side CSV;
  RLS everywhere; the data to analyze (rounds, dispositions, clause
  states, library usage, ledger, findings).
- Missing: user-composed queries, saved/rerunnable reports, drill-down,
  and the acceptance analytics (fallback rung acceptance, clause
  pushback frequency) that pairing D7 and negotiation D5 banked data for.
