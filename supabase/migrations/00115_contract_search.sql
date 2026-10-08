-- 00115: lexical contract search (D1–D6).
--
-- Stored generated tsvector columns + GIN (preferred over expression
-- indexes and lossy GiST), trigram indexes for typo-tolerant name search,
-- one RLS-scoped RPC. SECURITY INVOKER: the caller's table policies
-- (owner + shared readers) are the boundary — the function adds no access
-- of its own. Ranking is ts_rank_cd (cover-density, proximity-aware);
-- snippets come from ts_headline (exact quotes where provable).
-- Version content is indexed on its first 20000 chars (tsvector's ~1MB
-- ceiling is never approached; long drafts match on their head).
-- pgvector + RRF hybrid stays a documented later phase, not this table.
--
-- Forward-only, additive. No RLS changes, no grants beyond the RPC.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE audits
  ADD COLUMN content_tsv tsvector
    GENERATED ALWAYS AS (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(raw_input, ''))) STORED;

CREATE INDEX audits_content_tsv_idx ON audits USING gin (content_tsv);
CREATE INDEX audits_title_trgm_idx ON audits USING gin (title gin_trgm_ops);

ALTER TABLE document_versions
  ADD COLUMN content_tsv tsvector
    GENERATED ALWAYS AS (to_tsvector('english', left(coalesce(content, ''), 20000))) STORED;

CREATE INDEX document_versions_content_tsv_idx ON document_versions USING gin (content_tsv);

ALTER TABLE corpus_clauses
  ADD COLUMN quote_tsv tsvector
    GENERATED ALWAYS AS (to_tsvector('english', coalesce(quote, ''))) STORED;

CREATE INDEX corpus_clauses_quote_tsv_idx ON corpus_clauses USING gin (quote_tsv);

-- Exhaustive deal search: title sim + deal content + version content +
-- indexed clauses, fused by rank. Every leg reads through the caller's
-- RLS (owner rows + shared rows); the function filters nothing itself.
CREATE OR REPLACE FUNCTION search_deals(p_query TEXT, p_deal_types TEXT[] DEFAULT NULL, p_limit INT DEFAULT 20)
RETURNS TABLE (
  deal_id UUID,
  title TEXT,
  deal_type TEXT,
  kind TEXT,
  snippet TEXT,
  rank REAL
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH q AS (
    SELECT websearch_to_tsquery('english', p_query) AS tsq
  ),
  title_hits AS (
    SELECT a.id, a.title, a.deal_type, 'title'::TEXT AS kind,
      NULL::TEXT AS snippet,
      similarity(a.title, p_query)::REAL AS rank
    FROM audits a
    WHERE a.title % p_query
      AND (p_deal_types IS NULL OR a.deal_type = ANY (p_deal_types))
    ORDER BY rank DESC
    LIMIT p_limit
  ),
  content_hits AS (
    SELECT a.id, a.title, a.deal_type, 'content'::TEXT AS kind,
      ts_headline('english', left(coalesce(a.raw_input, ''), 20000), (SELECT tsq FROM q), 'MaxWords=20, MinWords=8') AS snippet,
      ts_rank_cd(a.content_tsv, (SELECT tsq FROM q)) AS rank
    FROM audits a
    WHERE a.content_tsv @@ (SELECT tsq FROM q)
      AND (p_deal_types IS NULL OR a.deal_type = ANY (p_deal_types))
    ORDER BY rank DESC
    LIMIT p_limit
  ),
  -- Joins (never scalar subqueries): an invisible deal must emit NO row,
  -- not a row with nulled columns. Both sides carry the caller's RLS.
  version_hits AS (
    SELECT DISTINCT ON (v.audit_id) v.audit_id AS id,
      a.title AS title,
      a.deal_type AS deal_type,
      'content'::TEXT AS kind,
      ts_headline('english', left(coalesce(v.content, ''), 20000), (SELECT tsq FROM q), 'MaxWords=20, MinWords=8') AS snippet,
      ts_rank_cd(v.content_tsv, (SELECT tsq FROM q)) AS rank
    FROM document_versions v
    JOIN audits a ON a.id = v.audit_id
    WHERE v.content_tsv @@ (SELECT tsq FROM q)
      AND (p_deal_types IS NULL OR a.deal_type = ANY (p_deal_types))
    ORDER BY v.audit_id, rank DESC
  ),
  clause_hits AS (
    SELECT DISTINCT ON (c.audit_id) c.audit_id AS id,
      a.title AS title,
      a.deal_type AS deal_type,
      'clause'::TEXT AS kind,
      ts_headline('english', c.quote, (SELECT tsq FROM q), 'MaxWords=20, MinWords=8') AS snippet,
      ts_rank_cd(c.quote_tsv, (SELECT tsq FROM q)) AS rank
    FROM corpus_clauses c
    JOIN audits a ON a.id = c.audit_id
    WHERE c.quote_tsv @@ (SELECT tsq FROM q)
      AND (p_deal_types IS NULL OR a.deal_type = ANY (p_deal_types))
    ORDER BY c.audit_id, rank DESC
  ),
  type_filtered AS (
    SELECT h.* FROM (
      SELECT * FROM title_hits
      UNION ALL SELECT * FROM content_hits
      UNION ALL SELECT * FROM version_hits
      UNION ALL SELECT * FROM clause_hits
    ) h
    WHERE p_deal_types IS NULL OR h.deal_type = ANY (p_deal_types)
  )
  SELECT * FROM type_filtered
  ORDER BY rank DESC
  LIMIT p_limit;
$$;
