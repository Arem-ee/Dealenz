CREATE TABLE client_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  company TEXT,
  email TEXT,
  industry TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE client_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own clients"
  ON client_profiles FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_client_profiles_user_id ON client_profiles(user_id);

ALTER TABLE audits ADD COLUMN client_id UUID REFERENCES client_profiles(id) ON DELETE SET NULL;
CREATE INDEX idx_audits_client_id ON audits(client_id);
