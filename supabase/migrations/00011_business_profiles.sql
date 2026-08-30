CREATE TABLE business_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name TEXT,
  legal_entity TEXT,
  address TEXT,
  city TEXT,
  country TEXT,
  email TEXT,
  phone TEXT,
  website TEXT,
  default_currency TEXT NOT NULL DEFAULT 'USD',
  default_payment_terms TEXT,
  standard_rate NUMERIC(10,2),
  rate_unit TEXT DEFAULT 'hour' CHECK (rate_unit IN ('hour', 'day', 'project')),
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE business_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own business profile"
  ON business_profiles FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
