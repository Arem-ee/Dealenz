-- Shareable finding reports (acquisition loop input).
--
-- Extends the existing share-token system with a 'report' kind: a user can
-- publish their deal's risk findings behind an unguessable tokenized link
-- (/report/[token]) for 30 days, revocable at any time. Unlike document
-- shares, reports carry no signing power: the reader RPC is read-only and
-- never touches document_signatures or share revocation.
--
-- What the link exposes is exactly what the owner chose to publish: the
-- deal type, the headline risk rating, and the FAIL findings
-- (severity/summary/guidance/pushback/evidence quotes). The share UI
-- states this plainly before creating the link.
--
-- Forward-only. Safe re-run (OR REPLACE + IF EXISTS guards).
ALTER TABLE share_tokens DROP CONSTRAINT IF EXISTS share_tokens_document_type_check;
ALTER TABLE share_tokens
  ADD CONSTRAINT share_tokens_document_type_check
  CHECK (document_type IN ('proposal', 'sow', 'contract', 'checklist', 'report'));

CREATE OR REPLACE FUNCTION get_shared_report(p_token TEXT)
RETURNS TABLE (
  audit_id UUID,
  deal_type TEXT,
  risk_level TEXT,
  overall_score INTEGER,
  findings JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_audit_id UUID;
BEGIN
  SELECT st.audit_id INTO v_audit_id
  FROM share_tokens st
  WHERE st.token = p_token
    AND st.document_type = 'report'
    AND st.revoked_at IS NULL
    AND st.expires_at > now();

  IF NOT FOUND THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    a.id,
    COALESCE(a.deal_type, 'unknown'),
    COALESCE((a.risk_report ->> 'riskLevel'), 'Unknown'),
    COALESCE((a.risk_report ->> 'overallScore')::INTEGER, NULL),
    COALESCE(a.structured_data -> 'deterministicFindings', '[]'::JSONB)
  FROM audits a
  WHERE a.id = v_audit_id;

  INSERT INTO activity_events (user_id, audit_id, event_type, payload)
  VALUES (
    (SELECT user_id FROM audits WHERE id = v_audit_id),
    v_audit_id,
    'report_viewed',
    jsonb_build_object('share_token', left(p_token, 8))
  );

  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION get_shared_report TO anon;
