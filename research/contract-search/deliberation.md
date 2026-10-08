# Contract Search Deliberation

Status: PROPOSED. Nothing below changes `product.md` / `architecture.md`
until approved. Approval amends the docs first, then code follows.

## D1. Lexical first, semantic later

- Options: (a) tsvector/GIN + pg_trgm now, pgvector when behavior demands
  it; (b) full hybrid with embeddings day one.
- Evidence: lexical covers exact terms, codes, party names, clause numbers
  — the precision half — with zero new infra; semantic needs an embedding
  provider, per-chunk cost, and backfill. "Users' search behavior should
  dictate the approach" (methods comparison); native-FTS limits only bite
  at millions of rows.
- Recommendation: **(a)**. Stored generated tsvector columns
  (`audits`, `document_versions`) + GIN, trigram indexes on titles/names,
  `websearch_to_tsquery` + `ts_rank_cd`. pgvector stays a documented
  second phase with the RRF recipe banked here.

## D2. Scope = RLS, nothing else

- Options: (a) search through the authenticated client so owner + shared
  policies apply automatically; (b) service-side fan-out with manual
  membership checks.
- Evidence: unanimous security literature — RLS as post-filter is the
  boundary; app predicates are defense-in-depth. Dealenz doctrine agrees.
- Recommendation: **(a)**. No new identity plumbing; canary regression
  tests (cross-user leakage, anonymous denial) ship with the feature.

## D3. One surface: the top-bar pill

- Options: (a) extend the top-bar pill to content results (deals +
  versions + clauses) with its existing inline dropdown; (b) a search page.
- Evidence: product.md assigns the single product-wide search to the top
  bar; tabs filter with chips. Evisort/LinkSquares separate name vs
  content modes — the pill can rank both (titles trigram-boosted, content
  ranked).
- Recommendation: **(a)**. No second search box anywhere, per doctrine.

## D4. Filters ride chips, results stay exhaustive

- Options: (a) type/stage/risk chips constrain search, results list every
  match with snippet + deal link (the Search half of Evisort's split);
  (b) AI-ranked top-N only.
- Evidence: Search's job is exhaustiveness with complete counts; Ask
  already does representative answers. Conflating them breaks both.
- Recommendation: **(a)**. Snippets quote the matched text with the
  finding/evidence treatment (EXACT offsets where provable, never
  invented).

## D5. Clause-aware search

- Options: (a) v1 includes a clause filter (deals containing clause X via
  `corpus_clauses`); (b) defer.
- Evidence: clause presence/absence search is standard (Evisort,
  LinkSquares); the corpus table already exists and is clause-indexed.
- Recommendation: **(a)** — cheap join, high value. Proximity search
  defers (needs position-aware indexes buyers rarely use first).

## D6. No external engine

- Options: (a) Postgres-native (tsvector + trigram, pgvector later);
  (b) Elasticsearch/Algolia sidecar.
- Evidence: monolith doctrine (no separate backend); scale doesn't justify
  a sidecar; ParadeDB-style BM25 is unneeded below millions of rows.
- Recommendation: **(a)**. Saved/shared searches defer to custom
  analytics (same surface, later).

## Doc amendments on approval

1. `product.md` Home/search: top-bar pill searches titles, content, and
   clauses; chips constrain; results exhaustive with snippets.
2. `architecture.md` Data Model/Observability: `content_tsv` generated
   columns + GIN/trigram indexes; RLS-scoped search RPCs; canary tests.
