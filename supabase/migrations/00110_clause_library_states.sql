-- 00110: clause library + per-deal clause states (Phase B).
--
-- Industry baseline (CLM clause-library practice: Malbek/SpotDraft/
-- ConvergePoint/ooligo): a governed library is user-owned, metadata-tagged
-- (category, deal types), versioned with change notes, deprecatable, and
-- audit-trailed. Per-deal clause tracking is derived where provable and
-- stored only where the user acted (accept / edit / dismiss).
--
-- library_clauses: one row per (key, version). Edits insert a new version
-- and mark the prior row superseded — history is immutable, never rewritten.
-- `key` groups versions: 'std:<template-id>' for snapshots of the
-- code-owned standard library, 'custom:<slug>' for user-authored language.
-- Deprecation retires a line without deleting its history.
--
-- clause_states: the stored overlay on the derived read-model
-- (src/lib/clauses/tracking.ts). One row per user action; deleting the row
-- reverts the clause to its derived state.
--
-- Forward-only, additive. Owner-scoped RLS mirrors standing_instructions
-- (00081): the authenticated user manages only their own rows, deletes
-- cascade with the auth user and the parent deal. No service-role bypass,
-- no shared reads.

CREATE TABLE library_clauses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key TEXT NOT NULL CHECK (char_length(key) BETWEEN 1 AND 160),
  version INT NOT NULL DEFAULT 1 CHECK (version >= 1),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 8000),
  category TEXT NOT NULL DEFAULT 'general' CHECK (char_length(category) BETWEEN 1 AND 40),
  deal_types TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deprecated', 'superseded')),
  change_note TEXT NOT NULL DEFAULT '' CHECK (char_length(change_note) <= 280),
  template_id TEXT NULL CHECK (template_id IS NULL OR char_length(template_id) BETWEEN 1 AND 120),
  template_version INT NULL CHECK (template_version IS NULL OR template_version >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, key, version)
);

CREATE INDEX library_clauses_user_key_idx
  ON library_clauses (user_id, key, version DESC);

ALTER TABLE library_clauses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own library clauses"
  ON library_clauses FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE clause_states (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  audit_id UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  clause_id TEXT NOT NULL CHECK (char_length(clause_id) BETWEEN 1 AND 120),
  status TEXT NOT NULL CHECK (status IN ('accepted', 'edited', 'dismissed')),
  note TEXT NOT NULL DEFAULT '' CHECK (char_length(note) <= 500),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, audit_id, clause_id)
);

CREATE INDEX clause_states_audit_idx
  ON clause_states (user_id, audit_id);

ALTER TABLE clause_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own clause states"
  ON clause_states FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
