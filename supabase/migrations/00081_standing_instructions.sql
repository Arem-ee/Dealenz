-- 00081: standing instructions (Harvey-Vault-style universal context).
--
-- A standing instruction is a free-text rule the client writes once and
-- Dealenz applies to every deal ("I never accept net-60",
-- "Always flag uncapped liability"). Separate rows (not an array column)
-- so adds and deletes are independent, ordered, and individually auditable.
--
-- Forward-only, additive. Owner-scoped RLS mirrors business_profiles
-- (00011): the authenticated user manages only their own rows, and deletes
-- cascade with the auth user. No service-role bypass, no shared reads.

CREATE TABLE standing_instructions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text TEXT NOT NULL CHECK (char_length(text) BETWEEN 1 AND 300),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX standing_instructions_user_created_idx
  ON standing_instructions (user_id, created_at ASC);

ALTER TABLE standing_instructions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own standing instructions"
  ON standing_instructions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
