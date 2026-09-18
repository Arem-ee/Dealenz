-- Phase 2: Protection, Documents, Spreadsheet Batch, Gmail (transient, not CRM)
-- Extends document_versions with provenance/versioning fields, adds gmail_tokens for OAuth
-- No CRM tables, no lead stages, no service_role, RLS on everything.

-- 1. Extend document_versions for durable versioning (immutable versions, content hash, provenance, status, WorkProduct ref)
ALTER TABLE document_versions
  ADD COLUMN IF NOT EXISTS parent_version_id UUID REFERENCES document_versions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS content_hash TEXT CHECK (content_hash IS NULL OR char_length(content_hash) BETWEEN 10 AND 128),
  ADD COLUMN IF NOT EXISTS provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ready_to_send', 'sent', 'locked', 'superseded')),
  ADD COLUMN IF NOT EXISTS work_product_id UUID REFERENCES work_products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_document_versions_parent ON document_versions(parent_version_id);
CREATE INDEX IF NOT EXISTS idx_document_versions_work_product ON document_versions(work_product_id);
CREATE INDEX IF NOT EXISTS idx_document_versions_status ON document_versions(status);

-- Allow new document types for protection batch (proposal, protection clause, negotiation doc, etc.)
-- Keep existing CHECK but widen via drop/add
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'document_versions_document_type_check' AND conrelid = 'public.document_versions'::regclass) THEN
    ALTER TABLE public.document_versions DROP CONSTRAINT document_versions_document_type_check;
  END IF;
END $$;

ALTER TABLE public.document_versions
  ADD CONSTRAINT document_versions_document_type_check
  CHECK (document_type IN ('proposal', 'sow', 'contract', 'checklist', 'protection_clause', 'negotiation_doc', 'clarification_request', 'protection_summary', 'proposal_batch'));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'document_versions_generation_method_check' AND conrelid = 'public.document_versions'::regclass) THEN
    ALTER TABLE public.document_versions DROP CONSTRAINT document_versions_generation_method_check;
  END IF;
END $$;

ALTER TABLE public.document_versions
  ADD CONSTRAINT document_versions_generation_method_check
  CHECK (generation_method IN ('ai', 'template', 'assembled'));

-- 2. Gmail tokens — server-side only, never browser, RLS protected, no service_role
CREATE TABLE IF NOT EXISTS gmail_tokens (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly',
  token_type TEXT NOT NULL DEFAULT 'Bearer',
  expiry_date TIMESTAMPTZ NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE gmail_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own gmail tokens" ON gmail_tokens;
CREATE POLICY "Users can manage own gmail tokens"
  ON gmail_tokens FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_gmail_tokens_user ON gmail_tokens(user_id);

-- 3. Idempotency helpers already in 00057 (conversation_messages executionId, work_products plan+execution)
-- No new CRM tables: spreadsheet is transient input stored as JSONB in work_plan_steps.input_ref
-- Batch rows are not a permanent table; row identity is stable server-derived (plan_id + plan_version + row_index + content_hash)
