-- 00125: Dutch search stemming (i18n follow-up).
--
-- Same proven pattern as 00123: stored dutch tsvector columns with GIN
-- beside English/French/German (Dutch compounds stem via Snowball), RPC
-- gains the dutch branch with English fallback matching preserved.
--
-- Forward-only, additive. No RLS changes, no grants beyond the RPC.

ALTER TABLE audits
  ADD COLUMN content_tsv_nl tsvector
    GENERATED ALWAYS AS (to_tsvector('dutch', coalesce(title, '') || ' ' || coalesce(raw_input, ''))) STORED;

CREATE INDEX audits_content_tsv_nl_idx ON audits USING gin (content_tsv_nl);

ALTER TABLE document_versions
  ADD COLUMN content_tsv_nl tsvector
    GENERATED ALWAYS AS (to_tsvector('dutch', left(coalesce(content, ''), 20000))) STORED;

CREATE INDEX document_versions_content_tsv_nl_idx ON document_versions USING gin (content_tsv_nl);

ALTER TABLE corpus_clauses
  ADD COLUMN quote_tsv_nl tsvector
    GENERATED ALWAYS AS (to_tsvector('dutch', coalesce(quote, ''))) STORED;

CREATE INDEX corpus_clauses_quote_tsv_nl_idx ON corpus_clauses USING gin (quote_tsv_nl);

-- New 4-arg signature: drop the 3-arg version so no stale overload
-- lingers beside it (callers pass p_language explicitly).
DROP FUNCTION IF EXISTS search_deals(TEXT, TEXT[], INT);

CREATE OR REPLACE FUNCTION search_deals(
  p_query TEXT,
  p_deal_types TEXT[] DEFAULT NULL,
  p_limit INT DEFAULT 20,
  p_language TEXT DEFAULT 'english'
)
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
    SELECT
      websearch_to_tsquery(
        CASE WHEN p_language = 'french' THEN 'french'::regconfig
             WHEN p_language = 'german' THEN 'german'::regconfig
             WHEN p_language = 'dutch' THEN 'dutch'::regconfig
             ELSE 'english'::regconfig END,
        p_query
      ) AS tsq_main,
      websearch_to_tsquery('english', p_query) AS tsq_en,
      CASE WHEN p_language IN ('french', 'german', 'dutch') THEN p_language ELSE 'english' END AS cfg
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
      ts_headline('english', left(coalesce(a.raw_input, ''), 20000), (SELECT tsq_main FROM q), 'MaxWords=20, MinWords=8') AS snippet,
      GREATEST(
        CASE WHEN (SELECT cfg FROM q) = 'french' THEN ts_rank_cd(a.content_tsv_fr, (SELECT tsq_main FROM q)) ELSE 0 END,
        CASE WHEN (SELECT cfg FROM q) = 'german' THEN ts_rank_cd(a.content_tsv_de, (SELECT tsq_main FROM q)) ELSE 0 END,
        CASE WHEN (SELECT cfg FROM q) = 'dutch' THEN ts_rank_cd(a.content_tsv_nl, (SELECT tsq_main FROM q)) ELSE 0 END,
        ts_rank_cd(a.content_tsv, (SELECT tsq_en FROM q))
      ) AS rank
    FROM audits a
    WHERE (
      ((SELECT cfg FROM q) = 'french' AND a.content_tsv_fr @@ (SELECT tsq_main FROM q))
      OR ((SELECT cfg FROM q) = 'german' AND a.content_tsv_de @@ (SELECT tsq_main FROM q))
      OR ((SELECT cfg FROM q) = 'dutch' AND a.content_tsv_nl @@ (SELECT tsq_main FROM q))
      OR (a.content_tsv @@ (SELECT tsq_en FROM q))
    )
      AND (p_deal_types IS NULL OR a.deal_type = ANY (p_deal_types))
    ORDER BY rank DESC
    LIMIT p_limit
  ),
  version_hits AS (
    SELECT DISTINCT ON (v.audit_id) v.audit_id AS id,
      a.title AS title,
      a.deal_type AS deal_type,
      'content'::TEXT AS kind,
      ts_headline('english', left(coalesce(v.content, ''), 20000), (SELECT tsq_main FROM q), 'MaxWords=20, MinWords=8') AS snippet,
      GREATEST(
        CASE WHEN (SELECT cfg FROM q) = 'french' THEN ts_rank_cd(v.content_tsv_fr, (SELECT tsq_main FROM q)) ELSE 0 END,
        CASE WHEN (SELECT cfg FROM q) = 'german' THEN ts_rank_cd(v.content_tsv_de, (SELECT tsq_main FROM q)) ELSE 0 END,
        CASE WHEN (SELECT cfg FROM q) = 'dutch' THEN ts_rank_cd(v.content_tsv_nl, (SELECT tsq_main FROM q)) ELSE 0 END,
        ts_rank_cd(v.content_tsv, (SELECT tsq_en FROM q))
      ) AS rank
    FROM document_versions v
    JOIN audits a ON a.id = v.audit_id
    WHERE (
      ((SELECT cfg FROM q) = 'french' AND v.content_tsv_fr @@ (SELECT tsq_main FROM q))
      OR ((SELECT cfg FROM q) = 'german' AND v.content_tsv_de @@ (SELECT tsq_main FROM q))
      OR ((SELECT cfg FROM q) = 'dutch' AND v.content_tsv_nl @@ (SELECT tsq_main FROM q))
      OR (v.content_tsv @@ (SELECT tsq_en FROM q))
    )
      AND (p_deal_types IS NULL OR a.deal_type = ANY (p_deal_types))
    ORDER BY v.audit_id, rank DESC
  ),
  clause_hits AS (
    SELECT DISTINCT ON (c.audit_id) c.audit_id AS id,
      a.title AS title,
      a.deal_type AS deal_type,
      'clause'::TEXT AS kind,
      ts_headline('english', c.quote, (SELECT tsq_main FROM q), 'MaxWords=20, MinWords=8') AS snippet,
      GREATEST(
        CASE WHEN (SELECT cfg FROM q) = 'french' THEN ts_rank_cd(c.quote_tsv_fr, (SELECT tsq_main FROM q)) ELSE 0 END,
        CASE WHEN (SELECT cfg FROM q) = 'german' THEN ts_rank_cd(c.quote_tsv_de, (SELECT tsq_main FROM q)) ELSE 0 END,
        CASE WHEN (SELECT cfg FROM q) = 'dutch' THEN ts_rank_cd(c.quote_tsv_nl, (SELECT tsq_main FROM q)) ELSE 0 END,
        ts_rank_cd(c.quote_tsv, (SELECT tsq_en FROM q))
      ) AS rank
    FROM corpus_clauses c
    JOIN audits a ON a.id = c.audit_id
    WHERE (
      ((SELECT cfg FROM q) = 'french' AND c.quote_tsv_fr @@ (SELECT tsq_main FROM q))
      OR ((SELECT cfg FROM q) = 'german' AND c.quote_tsv_de @@ (SELECT tsq_main FROM q))
      OR ((SELECT cfg FROM q) = 'dutch' AND c.quote_tsv_nl @@ (SELECT tsq_main FROM q))
      OR (c.quote_tsv @@ (SELECT tsq_en FROM q))
    )
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

-- Explicit execute grants (project convention: never rely on the PUBLIC
-- default — one hardening migration revoking it must not brick search).
GRANT EXECUTE ON FUNCTION search_deals(TEXT, TEXT[], INT, TEXT) TO anon, authenticated;
