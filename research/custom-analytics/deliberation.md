# Custom Analytics Deliberation

Status: PROPOSED. Nothing below changes `product.md` / `architecture.md`
until approved. Approval amends the docs first, then code follows.

## D1. Catalog-based builder, no user SQL

- Options: (a) server-declared metric catalog (dimensions/measures as
  code); users compose filters/grouping from the exposed list;
  (b) freeform SQL box.
- Evidence: visual/parameterized builders are standard (CEF, Zuora,
  AutomationEdge); raw SQL is never a user input (Embeddable); Jetstack
  prefers configured queries until custom SQL is genuinely necessary.
- Recommendation: **(a)**. Metrics ship with fixed safe queries; users
  vary dimensions, filters, and groupings. SQL stays in code review.

## D2. Same code path, RLS-scoped execution

- Options: (a) custom runs execute through the authenticated client so
  table RLS applies identically to static aggregates; (b) service-side
  fan-out with manual scoping.
- Evidence: the decisive doctrine — one code path, RLS before filters,
  users never control security context (Embeddable); Dealenz RLS doctrine.
- Recommendation: **(a)**. No service-role analytics reads, ever.

## D3. Guardrails in the runner

- Options: (a) row caps (500), per-metric bounded queries, no unbounded
  time ranges without a date filter; (b) unconstrained.
- Evidence: CEF caps (10k paginated, 30s cancel) and date-filter guidance.
- Recommendation: **(a)**, Dealenz-scaled: 500-row cap, fixed metric
  queries only (bounded by construction), CSV export reuses `toCsv`.

## D4. Saved reports, owner-scoped

- Options: (a) `saved_reports` (owner, name, metric, params, created) —
  rerunnable, deletable, CSV-exportable; sharing deferred;
  (b) with team sharing day one.
- Evidence: ownership + view/edit shares + fork + export are standard
  (SKU, CEF); sharing adds recipient machinery Dealenz doesn't need yet.
- Recommendation: **(a)**. Team sharing follows the Team-tab pattern
  later, not here.

## D5. Acceptance analytics ship as first-class metrics (pairing D7)

- Options: (a) fallback-rung acceptance rate, clause pushback frequency,
  and escalation rate as catalog metrics over rounds/dispositions/states;
  (b) generic builder only.
- Evidence: the deferred D7 loop; Icertis clause-history → pushback
  analysis; Sirion fallback-usage tracking.
- Recommendation: **(a)**. The banked concession data finally pays out:
  which rung closes, which clause gets pushed, where ladders exhaust.

## D6. Deferred

- Schedules/digests, PDF/Excel export (CSV exists), natural-language
  query ("ask your data" — Ask already covers Q&A; analytics answers
  counts, not prose), cross-org benchmarking.

## Doc amendments on approval

1. `product.md` Reports: fixed aggregates + composed metrics from an
   exposed catalog, saved/rerunnable, CSV; acceptance analytics included.
2. `architecture.md` Observability/Data: metric catalog as code, RLS-scoped
   runner, caps; `saved_reports` table.
