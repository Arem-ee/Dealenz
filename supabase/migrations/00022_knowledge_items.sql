-- Phase 5C: Knowledge Foundation storage.
--
-- Decision: a single versioned knowledge_items table, not a items/versions
-- pair. Rationale: the only version-scoped access pattern is "history for one
-- item key, newest first" (served by the (item_key, version) unique index),
-- and resolution reads current published rows (served by the partial published
-- index). A second table would add join complexity with no query benefit at
-- this scale. History is append-only: versions are never updated except for
-- status bookkeeping (superseded/withdrawn), never rewritten.
--
-- RLS: published rows are world-readable (anon + authenticated) so resolution
-- and future client-facing citations work without a session. Drafts and all
-- other statuses are admin-visible only (same is_admin user-metadata
-- convention as the lawyers table). There are deliberately NO public
-- INSERT/UPDATE/DELETE policies: writes happen through admin-gated
-- server-side ingestion only (see src/lib/knowledge/store.ts).

CREATE TABLE knowledge_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_key TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version >= 1),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  kind TEXT NOT NULL CHECK (kind IN ('statute', 'regulation', 'case_law', 'official_guidance', 'contractual_standard', 'industry_standard', 'market_practice', 'internal_policy')),
  authority TEXT NOT NULL CHECK (authority IN ('authoritative', 'official_guidance', 'secondary', 'industry_practice', 'market_practice')),
  jurisdiction_scope TEXT NOT NULL CHECK (jurisdiction_scope IN ('global', 'country', 'state_province', 'territory', 'custom')),
  jurisdiction_code TEXT CHECK (jurisdiction_code IS NULL OR char_length(jurisdiction_code) BETWEEN 1 AND 120),
  source_name TEXT NOT NULL CHECK (char_length(source_name) BETWEEN 1 AND 120),
  source_reference TEXT NOT NULL CHECK (char_length(source_reference) BETWEEN 1 AND 120),
  source_authority TEXT NOT NULL CHECK (char_length(source_authority) BETWEEN 1 AND 120),
  retrieved_at TIMESTAMPTZ NOT NULL,
  publisher TEXT CHECK (publisher IS NULL OR char_length(publisher) BETWEEN 1 AND 200),
  original_uri TEXT CHECK (original_uri IS NULL OR char_length(original_uri) BETWEEN 1 AND 200),
  checksum TEXT CHECK (checksum IS NULL OR char_length(checksum) BETWEEN 1 AND 200),
  effective_from DATE NOT NULL,
  effective_to DATE CHECK (effective_to IS NULL OR effective_to >= effective_from),
  status TEXT NOT NULL CHECK (status IN ('draft', 'verified', 'published', 'superseded', 'withdrawn')),
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 20000),
  applicability JSONB NOT NULL DEFAULT '{}'::jsonb,
  superseded_by_version INTEGER CHECK (superseded_by_version IS NULL OR superseded_by_version >= 1),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT knowledge_items_version_lineage UNIQUE (item_key, version),
  CONSTRAINT knowledge_items_global_no_code CHECK (
    jurisdiction_scope <> 'global' OR jurisdiction_code IS NULL
  ),
  CONSTRAINT knowledge_items_scoped_needs_code CHECK (
    jurisdiction_scope = 'global' OR jurisdiction_code IS NOT NULL
  ),
  CONSTRAINT knowledge_items_supersede_link CHECK (
    (status = 'superseded' AND superseded_by_version IS NOT NULL)
    OR (status <> 'superseded' AND superseded_by_version IS NULL)
  )
);

CREATE INDEX idx_knowledge_items_key ON knowledge_items(item_key);
CREATE INDEX idx_knowledge_items_published ON knowledge_items(updated_at DESC) WHERE status = 'published';
CREATE INDEX idx_knowledge_items_status ON knowledge_items(status);

ALTER TABLE knowledge_items ENABLE ROW LEVEL SECURITY;

-- Published knowledge is readable by everyone, including anonymous resolution.
CREATE POLICY "Published knowledge is publicly readable"
  ON knowledge_items FOR SELECT
  USING (status = 'published');

-- Non-published knowledge is visible to admins only.
CREATE POLICY "Admins can read all knowledge"
  ON knowledge_items FOR SELECT
  USING (
    status = 'published'
    OR EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_user_meta_data->>'is_admin')::boolean = true
    )
  );

-- Writes are admin-only. No public INSERT/UPDATE/DELETE policies exist by design.
CREATE POLICY "Admins can insert knowledge"
  ON knowledge_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_user_meta_data->>'is_admin')::boolean = true
    )
  );

CREATE POLICY "Admins can update knowledge"
  ON knowledge_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_user_meta_data->>'is_admin')::boolean = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_user_meta_data->>'is_admin')::boolean = true
    )
  );
