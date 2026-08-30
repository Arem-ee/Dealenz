ALTER TABLE audits
  ADD COLUMN raw_input TEXT,
  ADD COLUMN source_type TEXT,
  ADD COLUMN structured_data JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN risk_report JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN overall_score INTEGER;

-- Storage bucket for audit file uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('audit-files', 'audit-files', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can view own audit files"
  ON storage.objects FOR SELECT
  USING (auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload own audit files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    auth.uid()::text = (storage.foldername(name))[1]
    AND bucket_id = 'audit-files'
  );

CREATE POLICY "Users can delete own audit files"
  ON storage.objects FOR DELETE
  USING (auth.uid()::text = (storage.foldername(name))[1]);
