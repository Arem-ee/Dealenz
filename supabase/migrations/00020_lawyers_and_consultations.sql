CREATE TYPE lawyer_verification_status AS ENUM ('pending', 'verified', 'rejected');
CREATE TYPE consultation_status AS ENUM ('requested', 'matched', 'in_progress', 'completed', 'cancelled', 'waitlist');

CREATE TABLE lawyers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  photo_url TEXT,
  bio TEXT,
  bar_license_number TEXT NOT NULL,
  bar_jurisdiction TEXT NOT NULL,
  specialties TEXT[] NOT NULL DEFAULT '{}',
  years_experience INTEGER NOT NULL DEFAULT 0,
  notable_cases TEXT,
  certifications TEXT[] NOT NULL DEFAULT '{}',
  verification_status lawyer_verification_status NOT NULL DEFAULT 'pending',
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lawyers_verification_status ON lawyers(verification_status);
CREATE INDEX idx_lawyers_user_id ON lawyers(user_id);

ALTER TABLE lawyers ENABLE ROW LEVEL SECURITY;

-- Only verified lawyers can be seen publicly (for future marketplace)
CREATE POLICY "Public can view verified lawyers"
  ON lawyers FOR SELECT
  USING (verification_status = 'verified');

-- Lawyers can view and update their own profile
CREATE POLICY "Lawyers manage own profile"
  ON lawyers FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all lawyers (using a simple admin check via user metadata)
CREATE POLICY "Admins can view all lawyers"
  ON lawyers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_user_meta_data->>'is_admin')::boolean = true
    )
  );

-- Admins can update lawyer verification status
CREATE POLICY "Admins can update lawyer verification"
  ON lawyers FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_user_meta_data->>'is_admin')::boolean = true
    )
  );

CREATE TABLE consultation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lawyer_id UUID REFERENCES lawyers(id) ON DELETE SET NULL,
  status consultation_status NOT NULL DEFAULT 'requested',
  request_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_consultation_requests_audit_id ON consultation_requests(audit_id);
CREATE INDEX idx_consultation_requests_user_id ON consultation_requests(user_id);
CREATE INDEX idx_consultation_requests_lawyer_id ON consultation_requests(lawyer_id);
CREATE INDEX idx_consultation_requests_status ON consultation_requests(status);

ALTER TABLE consultation_requests ENABLE ROW LEVEL SECURITY;

-- Users can create their own consultation requests
CREATE POLICY "Users can create own consultation requests"
  ON consultation_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can view their own consultation requests
CREATE POLICY "Users can view own consultation requests"
  ON consultation_requests FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update their own consultation requests (e.g., cancel)
CREATE POLICY "Users can update own consultation requests"
  ON consultation_requests FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Lawyers can view consultation requests assigned to them
CREATE POLICY "Lawyers can view assigned consultation requests"
  ON consultation_requests FOR SELECT
  USING (
    auth.uid() = lawyer_id
  );

-- Lawyers can update assigned consultation requests
CREATE POLICY "Lawyers can update assigned consultation requests"
  ON consultation_requests FOR UPDATE
  USING (auth.uid() = lawyer_id)
  WITH CHECK (auth.uid() = lawyer_id);

-- Admins can view all consultation requests
CREATE POLICY "Admins can view all consultation requests"
  ON consultation_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_user_meta_data->>'is_admin')::boolean = true
    )
  );

-- Admins can update any consultation request
CREATE POLICY "Admins can update any consultation request"
  ON consultation_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_user_meta_data->>'is_admin')::boolean = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_user_meta_data->>'is_admin')::boolean = true
    )
  );

GRANT EXECUTE ON FUNCTION get_shared_document TO anon;
GRANT EXECUTE ON FUNCTION sign_shared_document TO anon;