-- 00128: single-use Gmail OAuth nonces (replay protection).
CREATE TABLE IF NOT EXISTS gmail_oauth_nonces (
  nonce TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '15 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE gmail_oauth_nonces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own oauth nonces" ON gmail_oauth_nonces;
CREATE POLICY "Users manage own oauth nonces"
  ON gmail_oauth_nonces FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_gmail_oauth_nonces_expiry ON gmail_oauth_nonces(expires_at);
