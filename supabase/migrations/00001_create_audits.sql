CREATE TABLE audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  title TEXT NOT NULL DEFAULT 'New Audit',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'completed', 'archived')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own audits"
  ON audits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own audits"
  ON audits FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own audits"
  ON audits FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own audits"
  ON audits FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_audits_user_id ON audits(user_id);
CREATE INDEX idx_audits_created_at ON audits(created_at DESC);
