-- Phase: corpus clause index for cross-contract conflict detection.
-- Signed/locked versions are segmented into clauses (markdown H3 sections
-- from assembly output; whole-document fallback otherwise) with a text
-- hash per clause. New material is checked against other deals' clauses:
-- exclusivity overlap, assignment/transfer overlap, liability-cap stacking.
-- Index rows are derived data — deleting the deal cascades them away.

CREATE TABLE corpus_clauses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  audit_id UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  version_id UUID,
  clause_key TEXT NOT NULL,
  title TEXT NOT NULL,
  quote TEXT NOT NULL,
  text_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_corpus_clauses_user ON corpus_clauses(user_id);
CREATE INDEX idx_corpus_clauses_audit ON corpus_clauses(audit_id);
CREATE UNIQUE INDEX uq_corpus_clause_version
  ON corpus_clauses (audit_id, version_id, text_hash)
  WHERE version_id IS NOT NULL;

ALTER TABLE corpus_clauses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own corpus clauses"
  ON corpus_clauses FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
