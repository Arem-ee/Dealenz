-- Phase 1 security hardening: durable abuse rate limiting + share hardening.
--
-- 1. anonymous_rate_limits + check_anonymous_rate_limit(): a shared,
--    restart-safe counter for unauthenticated paths (anonymous Quick Review,
--    auth-failure logging, public share views). The previous in-memory Map
--    reset on deploy, was never shared across instances, and keyed on
--    attacker-controlled headers. Callers now key on a platform-derived IP
--    (see src/lib/rate-limit-anon.ts) and deny when the RPC errors
--    (fail-closed). Table has RLS enabled with no table policies: all
--    access flows through the SECURITY DEFINER function below.
-- 2. get_shared_document: rejects non-UUID tokens before any lookup (cheap
--    probing with garbage can no longer touch tables), and throttles the
--    document_viewed activity write to one per token per 10 minutes so view
--    spam cannot become an unbounded write path. Reads still serve.
-- 3. sign_shared_document: validates token shape, name length, and email
--    shape server-side (the browser calls this RPC directly, so application
--    validation alone is insufficient). Signing remains one-per-token.
--
-- Forward-only; historical migrations untouched. No live application claimed.

CREATE TABLE IF NOT EXISTS anonymous_rate_limits (
  rate_key TEXT PRIMARY KEY,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  count INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE anonymous_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION check_anonymous_rate_limit(
  p_key TEXT,
  p_limit INTEGER,
  p_window_seconds INTEGER DEFAULT 3600
)
RETURNS TABLE(allowed BOOLEAN, current_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
  v_window INTEGER;
BEGIN
  IF p_key IS NULL OR char_length(p_key) = 0 OR char_length(p_key) > 128 THEN
    RETURN QUERY SELECT false, 0;
    RETURN;
  END IF;
  IF p_limit IS NULL OR p_limit < 1 THEN
    RETURN QUERY SELECT false, 0;
    RETURN;
  END IF;
  v_window := GREATEST(COALESCE(p_window_seconds, 3600), 60);

  INSERT INTO anonymous_rate_limits (rate_key, window_start, count, updated_at)
  VALUES (p_key, now(), 1, now())
  ON CONFLICT (rate_key) DO UPDATE SET
    count = CASE
      WHEN anonymous_rate_limits.window_start <= now() - (v_window || ' seconds')::interval THEN 1
      ELSE anonymous_rate_limits.count + 1
    END,
    window_start = CASE
      WHEN anonymous_rate_limits.window_start <= now() - (v_window || ' seconds')::interval THEN now()
      ELSE anonymous_rate_limits.window_start
    END,
    updated_at = now();

  SELECT count INTO v_count FROM anonymous_rate_limits WHERE rate_key = p_key;
  RETURN QUERY SELECT v_count <= p_limit, COALESCE(v_count, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION check_anonymous_rate_limit TO anon, authenticated;

-- get_shared_document: UUID gate + view-write throttle. Otherwise identical
-- to 00013 (same columns, same token/expiry/revoke checks, same grants).
CREATE OR REPLACE FUNCTION get_shared_document(p_token TEXT)
RETURNS TABLE (
  content TEXT,
  audit_id UUID,
  document_type TEXT,
  business_name TEXT,
  signed BOOLEAN,
  signed_by_name TEXT,
  signed_by_email TEXT,
  signed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_share_id UUID;
  v_audit_id UUID;
  v_doc_type TEXT;
  v_user_id UUID;
BEGIN
  IF p_token IS NULL
    OR char_length(p_token) > 64
    OR p_token !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  THEN
    RETURN;
  END IF;

  SELECT id, audit_id, document_type INTO v_share_id, v_audit_id, v_doc_type
  FROM share_tokens
  WHERE token = p_token
    AND revoked_at IS NULL
    AND expires_at > now();

  IF NOT FOUND THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    dv.content,
    dv.audit_id,
    dv.document_type,
    COALESCE(bp.business_name, ''),
    ds.id IS NOT NULL,
    COALESCE(ds.signed_by_name, '')::TEXT,
    COALESCE(ds.signed_by_email, '')::TEXT,
    ds.signed_at
  FROM document_versions dv
  LEFT JOIN audits a ON a.id = dv.audit_id
  LEFT JOIN business_profiles bp ON bp.user_id = a.user_id
  LEFT JOIN LATERAL (
    SELECT id, signed_by_name, signed_by_email, signed_at
    FROM document_signatures
    WHERE share_token_id = v_share_id
    ORDER BY signed_at DESC
    LIMIT 1
  ) ds ON true
  WHERE dv.audit_id = v_audit_id
    AND dv.document_type = v_doc_type
  ORDER BY dv.version_number DESC
  LIMIT 1;

  -- Throttle the write path: at most one document_viewed event per token
  -- per 10 minutes. Views still serve; only the log write is bounded.
  IF NOT EXISTS (
    SELECT 1 FROM activity_events
    WHERE event_type = 'document_viewed'
      AND payload->>'share_token_id' = v_share_id::text
      AND created_at > now() - interval '10 minutes'
  ) THEN
    INSERT INTO activity_events (user_id, audit_id, event_type, payload)
    VALUES (
      (SELECT user_id FROM audits WHERE id = v_audit_id),
      v_audit_id,
      'document_viewed',
      jsonb_build_object('document_type', v_doc_type, 'share_token_id', v_share_id)
    );
  END IF;

  RETURN;
END;
$$;

-- sign_shared_document: server-side input validation. Otherwise identical
-- to 00013 (same token/expiry checks, one-sign-per-token, revoke-on-sign).
CREATE OR REPLACE FUNCTION sign_shared_document(
  p_token TEXT,
  p_name TEXT,
  p_email TEXT,
  p_ip TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_share_id UUID;
  v_audit_id UUID;
  v_doc_type TEXT;
BEGIN
  IF p_token IS NULL
    OR char_length(p_token) > 64
    OR p_token !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    OR p_name IS NULL
    OR char_length(btrim(p_name)) = 0
    OR char_length(p_name) > 120
    OR p_email IS NULL
    OR char_length(p_email) > 254
    OR p_email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  THEN
    RETURN QUERY SELECT false, 'Invalid or expired share link';
    RETURN;
  END IF;

  SELECT id, audit_id, document_type INTO v_share_id, v_audit_id, v_doc_type
  FROM share_tokens
  WHERE token = p_token
    AND revoked_at IS NULL
    AND expires_at > now();

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Invalid or expired share link';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM document_signatures
    WHERE share_token_id = v_share_id
  ) THEN
    RETURN QUERY SELECT false, 'Document has already been signed';
    RETURN;
  END IF;

  INSERT INTO document_signatures (share_token_id, audit_id, document_type, signed_by_name, signed_by_email, ip_address)
  VALUES (v_share_id, v_audit_id, v_doc_type, btrim(p_name), btrim(p_email), p_ip);

  UPDATE share_tokens
  SET revoked_at = now()
  WHERE id = v_share_id;

  INSERT INTO activity_events (user_id, audit_id, event_type, payload)
  VALUES (
    (SELECT user_id FROM audits WHERE id = v_audit_id),
    v_audit_id,
    'document_signed',
    jsonb_build_object(
      'document_type', v_doc_type,
      'share_token_id', v_share_id,
      'signed_by_name', btrim(p_name),
      'signed_by_email', btrim(p_email)
    )
  );

  RETURN QUERY SELECT true, 'Document signed successfully';
END;
$$;
