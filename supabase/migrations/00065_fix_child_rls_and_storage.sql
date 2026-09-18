-- Hostile audit remediation: child-row IDOR (#1, #15) and storage path (#15)
-- Tighten child tables that previously checked only user_id = auth.uid()
-- to also prove parent ownership. Forward-only, idempotent.

-- 1. conversation_messages: must belong to caller's conversation
DROP POLICY IF EXISTS "Users can manage own conversation messages" ON conversation_messages;
CREATE POLICY "Users can manage own conversation messages"
  ON conversation_messages FOR ALL
  USING (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid())
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid())
  );

-- 2. document_versions: must belong to caller's audit (deal)
DROP POLICY IF EXISTS "Users can manage own document versions" ON document_versions;
-- earlier 00012 had separate SELECT/INSERT/UPDATE policies, 00064 re-asserted UPDATE; consolidate to single FOR ALL
DROP POLICY IF EXISTS "Users read own document versions" ON document_versions;
DROP POLICY IF EXISTS "Users insert own document versions" ON document_versions;
DROP POLICY IF EXISTS "Users update own document versions" ON document_versions;
CREATE POLICY "Users can manage own document versions"
  ON document_versions FOR ALL
  USING (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM audits a WHERE a.id = audit_id AND a.user_id = auth.uid())
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM audits a WHERE a.id = audit_id AND a.user_id = auth.uid())
  );

-- 3. checklist_items
DROP POLICY IF EXISTS "Users manage own checklist items" ON checklist_items;
CREATE POLICY "Users manage own checklist items"
  ON checklist_items FOR ALL
  USING (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM audits a WHERE a.id = audit_id AND a.user_id = auth.uid())
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM audits a WHERE a.id = audit_id AND a.user_id = auth.uid())
  );

-- 4. monitoring_events
DROP POLICY IF EXISTS "Users manage own monitoring events" ON monitoring_events;
CREATE POLICY "Users manage own monitoring events"
  ON monitoring_events FOR ALL
  USING (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM audits a WHERE a.id = audit_id AND a.user_id = auth.uid())
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM audits a WHERE a.id = audit_id AND a.user_id = auth.uid())
  );

-- Also tighten assigned-lawyer read to require user_id equality (fixes #2 pollution)
DROP POLICY IF EXISTS "Assigned lawyers read monitoring events" ON monitoring_events;
CREATE POLICY "Assigned lawyers read monitoring events"
  ON monitoring_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM consultation_requests cr
      JOIN lawyers l ON l.id = cr.lawyer_id
      WHERE cr.audit_id = monitoring_events.audit_id
        AND cr.user_id = monitoring_events.user_id
        AND l.user_id = auth.uid()
        AND cr.status IN ('matched','accepted','in_progress','changes_requested','client_review')
    )
  );

-- 5. monitoring_alerts: ensure alert's audit belongs to caller
DROP POLICY IF EXISTS "Users manage own monitoring alerts" ON monitoring_alerts;
CREATE POLICY "Users manage own monitoring alerts"
  ON monitoring_alerts FOR ALL
  USING (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM audits a WHERE a.id = audit_id AND a.user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM monitoring_events e WHERE e.id = monitoring_event_id AND e.audit_id = audit_id)
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM audits a WHERE a.id = audit_id AND a.user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM monitoring_events e WHERE e.id = monitoring_event_id AND e.audit_id = audit_id)
  );

-- 6. activity_events
DROP POLICY IF EXISTS "Users manage own activity events" ON activity_events;
-- original was "Users can manage own activity events" ?
DROP POLICY IF EXISTS "Users can manage own activity events" ON activity_events;
CREATE POLICY "Users can manage own activity events"
  ON activity_events FOR ALL
  USING (
    auth.uid() = user_id
    AND (audit_id IS NULL OR EXISTS (SELECT 1 FROM audits a WHERE a.id = audit_id AND a.user_id = auth.uid()))
  )
  WITH CHECK (
    auth.uid() = user_id
    AND (audit_id IS NULL OR EXISTS (SELECT 1 FROM audits a WHERE a.id = audit_id AND a.user_id = auth.uid()))
  );

-- 7. Storage audit-files: enforce second segment audit ownership
-- Prior policy checked bucket_id='audit-files' AND foldername[1]=auth.uid()::text
-- Add audit ownership check for foldername[2]
DO $$
BEGIN
  -- Drop and recreate with tighter check if exists
  DROP POLICY IF EXISTS "Users can upload own files to audit-files" ON storage.objects;
  DROP POLICY IF EXISTS "Users can view own files in audit-files" ON storage.objects;
  DROP POLICY IF EXISTS "Users can update own files in audit-files" ON storage.objects;
  DROP POLICY IF EXISTS "Users can delete own files in audit-files" ON storage.objects;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can upload own files to audit-files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'audit-files'
    AND auth.uid()::text = (storage.foldername(name))[1]
    AND EXISTS (SELECT 1 FROM audits a WHERE a.id::text = (storage.foldername(name))[2] AND a.user_id = auth.uid())
  );

CREATE POLICY "Users can view own files in audit-files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'audit-files'
    AND auth.uid()::text = (storage.foldername(name))[1]
    AND EXISTS (SELECT 1 FROM audits a WHERE a.id::text = (storage.foldername(name))[2] AND a.user_id = auth.uid())
  );

CREATE POLICY "Users can update own files in audit-files"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'audit-files'
    AND auth.uid()::text = (storage.foldername(name))[1]
    AND EXISTS (SELECT 1 FROM audits a WHERE a.id::text = (storage.foldername(name))[2] AND a.user_id = auth.uid())
  );

CREATE POLICY "Users can delete own files in audit-files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'audit-files'
    AND auth.uid()::text = (storage.foldername(name))[1]
    AND EXISTS (SELECT 1 FROM audits a WHERE a.id::text = (storage.foldername(name))[2] AND a.user_id = auth.uid())
  );
