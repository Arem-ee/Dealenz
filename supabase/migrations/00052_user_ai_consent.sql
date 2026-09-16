CREATE TABLE user_ai_consents (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  has_consented_to_ai_analysis BOOLEAN NOT NULL DEFAULT false,
  consented_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_ai_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own consent"
  ON user_ai_consents FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_user_ai_consents_user_id ON user_ai_consents(user_id);
