# Contract Search Market Research

Date: 2026-10-08. Method: vendor documentation + Postgres search literature
(full text fetched). Nothing here is built yet; see `deliberation.md`.

## 1. What the CLM market does

### Two surfaces, not one (Evisort/Workday — clearest articulation)
- **Search**: exhaustive. Boolean operators, metadata filters for any
  contract data field, clause presence/absence, saved/shared/exportable
  searches, complete match counts. For exhaustive answers, use Search.
- **Ask AI**: representative. Natural-language questions scoped to all
  documents / current document / current results, answers cite up to 25
  sources with links. Gives examples, never the exhaustive list.
- Both enforce the same permission boundary: Ask follows folder-level
  access controls; you see only documents you may view.

### Repository search depth (LinkSquares Analyze)
- Name search (exact-ish) separated from **content search** over OCR text:
  inexact (whole words, any order), exact, and partial (≤30 chars) modes.
- **Proximity search**: a term within X words of an anchor term.
- Advanced filters on every extracted data point (type, dates, parties,
  global terms), pinnable, clonable.
- AI extraction (120+ data points per agreement) feeds both filters and
  search — extraction quality IS search quality.

### Agentic direction (LinkSquares LinkAI)
- Natural-language search across the whole library plus agents that
  auto-analyze newly ingested documents (metadata, summary) so nothing
  arrives unsearchable. Ingest-time extraction, not query-time heroics.

## 2. How Postgres search actually works (tech literature)

### Lexical: tsvector/GIN + pg_trgm (built-ins, zero new infra)
- Stored **generated tsvector column** + GIN index (preferred over
  expression indexes and over lossy GiST). `websearch_to_tsquery` for
  user-friendly syntax; `ts_rank_cd` for cover-density (proximity-aware)
  ranking.
- `pg_trgm` for typos, partial matches, and name search (similarity
  threshold + trigram GIN/GiST indexes).
- Hard limits that matter: native ranking is NOT BM25 (no corpus IDF, no
  top-k early termination — every match gets scored). At 10M rows this is
  479× slower than BM25 extensions; at Dealenz scale (hundreds–thousands
  of deals) it is a non-issue. Chunk before ~16K tokens per tsvector.

### Semantic: pgvector HNSW (built-in extension, external embeddings)
- Vectors come from embedding models (nothing generates them in-DB);
  HNSW index with cosine ops; `halfvec` halves the footprint.
- Keep vectors in a **narrow side table** (updates to business fields must
  never touch the graph); tune `ef_search`/`iterative_scan`; use `SET
  LOCAL` under PgBouncer transaction pooling.
- Trade-off is fixed: vectors find meaning ("physician" → doctor papers)
  but blur exact terms (PG-15.4 vs PG-14.2 collapse). Lexical gives
  precision on codes, clause numbers, party names.

### Hybrid: RRF fusion (the standard recipe)
- Run lexical top-40/60 and semantic top-40/60, fuse with Reciprocal Rank
  Fusion (k=60): `1/(60+rank)` summed per document. Scale-independent,
  weight-tunable. Full-outer-join semantics — inner join silently
  restricts to documents found by BOTH retrievers and discards exactly
  what hybrid exists to find. `RANK()`, not `ROW_NUMBER()`.

### RLS × search (the security literature, unanimous)
- RLS is a **post-filter** from the index's perspective: the HNSW/FTS scan
  finds candidates, then hiding kicks in — selective tenants hit a recall
  cliff (empty results despite relevant rows).
- Mitigations in order: raise `ef_search` + iterative scans; keep explicit
  tenant predicates as defense-in-depth (never the boundary); `FORCE ROW
  LEVEL SECURITY`; canary tests (identical embeddings across tenants must
  never cross; missing context denies everything); never `BYPASSRLS` on
  the app role; partial per-tenant indexes only at whale scale.
- The core invariant, quoted: the safest query is the one the database
  refuses to make unsafe. Dealenz's doctrine already says this (RLS as
  data-layer guarantee, architecture.md) — search must inherit it, not
  reimplement it.

## 3. Dealenz's current position

- Ask exists per-deal (workspace composer, grounded, finding-checked) —
  the representative-answers surface. The exhaustive surface does not:
  top-bar search covers the thread list only; Home has no text search by
  design; contract *content* is unsearchable.
- Content to index already exists: `audits.raw_input`, version contents,
  extracted findings/evidence, clause corpus (`corpus_clauses`).
- Constraints that decide the design: single product-wide search lives in
  the top bar (product.md); tabs filter with chips, never a second search
  box; RLS per `auth.uid()` + membership is the boundary; monolith, no
  new infra; findings stay rule-determined (search retrieves, never
  judges — same split as Ask).
