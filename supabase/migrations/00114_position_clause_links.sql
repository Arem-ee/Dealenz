-- 00114: position ↔ clause-language links (pairing D1–D5).
--
-- A position (standing_instructions) links to exact library language
-- instead of duplicating wording: the preferred slot is required and
-- reused verbatim; fallback rungs carry when/why conditions, best first;
-- walk-away stays the floor. One link may flag escalation (route the
-- exhausted ladder to the Approvals queue) and one preferred link per
-- position may carry the silence instruction (suggest this language when
-- the clause is missing). Deleting a position or a library line drops its
-- links; deleting a link never touches either side.
--
-- Forward-only, additive. Owner-scoped RLS mirrors standing_instructions
-- (00081). No service-role bypass, no shared reads.

CREATE TABLE position_clause_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  position_id UUID NOT NULL REFERENCES standing_instructions(id) ON DELETE CASCADE,
  library_key TEXT NOT NULL CHECK (char_length(library_key) BETWEEN 1 AND 160),
  variant TEXT NOT NULL CHECK (variant IN ('preferred', 'fallback', 'walkaway')),
  rung INT NOT NULL DEFAULT 0 CHECK (rung >= 0 AND rung <= 20),
  condition_text TEXT NOT NULL DEFAULT '' CHECK (char_length(condition_text) <= 500),
  escalate BOOLEAN NOT NULL DEFAULT false,
  insert_on_missing BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, position_id, library_key, variant)
);

CREATE INDEX position_clause_links_position_idx
  ON position_clause_links (user_id, position_id, rung ASC);

ALTER TABLE position_clause_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own position clause links"
  ON position_clause_links FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
