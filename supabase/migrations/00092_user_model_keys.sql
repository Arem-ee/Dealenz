-- Phase: user model keys (BYOK). Workspace/personal provider keys for
-- per-message model choice. Secrets are AES-256-GCM envelopes (see
-- src/lib/models/crypto.ts); the database never sees plaintext and the
-- API never returns secret material — list queries must exclude
-- secret_enc explicitly. Revocation is a timestamp, never a delete, so
-- the audit trail keeps who held what and when.

CREATE TABLE user_model_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('anthropic', 'openai_compatible', 'gemini')),
  label TEXT NOT NULL CHECK (char_length(label) BETWEEN 1 AND 80),
  secret_enc TEXT NOT NULL,
  models TEXT[] NOT NULL DEFAULT '{}'::text[],
  base_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  last_error TEXT
);

CREATE INDEX idx_user_model_keys_user ON user_model_keys(user_id);

ALTER TABLE user_model_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own model keys"
  ON user_model_keys FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
