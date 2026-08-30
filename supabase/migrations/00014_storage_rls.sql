ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "Users can upload own files to audit-files"
    ON storage.objects FOR INSERT
    WITH CHECK (
      bucket_id = 'audit-files'
      AND auth.uid()::text = (storage.foldername(name))[1]
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Users can view own files in audit-files"
    ON storage.objects FOR SELECT
    USING (
      bucket_id = 'audit-files'
      AND auth.uid()::text = (storage.foldername(name))[1]
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Users can update own files in audit-files"
    ON storage.objects FOR UPDATE
    USING (
      bucket_id = 'audit-files'
      AND auth.uid()::text = (storage.foldername(name))[1]
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Users can delete own files in audit-files"
    ON storage.objects FOR DELETE
    USING (
      bucket_id = 'audit-files'
      AND auth.uid()::text = (storage.foldername(name))[1]
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
