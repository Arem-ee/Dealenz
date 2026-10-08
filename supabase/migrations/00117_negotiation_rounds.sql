-- 00117: negotiation rounds + clause dispositions + dual comments (D1–D7).
--
-- Rounds are the workflow over the immutable version lineage: each round
-- proposes per-clause dispositions against the paired ladders, keeps
-- multi-round context (what round 1 decided still binds round 3), and logs
-- the concession history analytics will later re-rank on. Versions stay
-- append-only; rounds decide, never rewrite.
--
-- Proposer is owner or a guest grant — never anonymous (product doctrine).
-- Comments run two channels: internal strategy (owner eyes only) and
-- external (counterparty-visible). Guest principals are structurally
-- excluded from the internal channel at read time, not just hidden in UI.
--
-- Forward-only, additive. Owner-scoped RLS throughout. No service-role
-- bypass, no shared reads (guest reads flow through token RPCs).

CREATE TABLE negotiation_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  audit_id UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  round_no INT NOT NULL CHECK (round_no >= 1),
  base_version_id UUID REFERENCES document_versions(id) ON DELETE SET NULL,
  proposer_kind TEXT NOT NULL CHECK (proposer_kind IN ('owner', 'guest')),
  grant_id UUID REFERENCES guest_grants(id) ON DELETE SET NULL,
  stance TEXT NOT NULL DEFAULT 'balanced' CHECK (stance IN ('light', 'balanced', 'firm')),
  status TEXT NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed', 'accepted', 'countered', 'withdrawn')),
  agreed_version_id UUID REFERENCES document_versions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ NULL,
  UNIQUE (user_id, audit_id, round_no)
);

CREATE INDEX negotiation_rounds_audit_idx ON negotiation_rounds (user_id, audit_id, round_no DESC);

ALTER TABLE negotiation_rounds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage own negotiation rounds"
  ON negotiation_rounds FOR ALL
  USING (public.rls_audit_owner(audit_id::text))
  WITH CHECK (public.rls_audit_owner(audit_id::text));

-- Per-clause dispositions: the concession log. outcome mirrors the
-- four-outcome table (accept / fallback rung / escalate / route); rung and
-- reasoning travel with it so round 3 remembers round 1.
CREATE TABLE round_clause_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  round_id UUID NOT NULL REFERENCES negotiation_rounds(id) ON DELETE CASCADE,
  clause_id TEXT NOT NULL CHECK (char_length(clause_id) BETWEEN 1 AND 120),
  outcome TEXT NOT NULL CHECK (outcome IN ('accept', 'fallback', 'escalate', 'route')),
  rung INT NULL CHECK (rung IS NULL OR (rung >= 0 AND rung <= 20)),
  variant TEXT NULL CHECK (variant IS NULL OR variant IN ('preferred', 'fallback', 'walkaway')),
  reasoning TEXT NOT NULL DEFAULT '' CHECK (char_length(reasoning) <= 1000),
  counter_text TEXT NOT NULL DEFAULT '' CHECK (char_length(counter_text) <= 8000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (round_id, clause_id)
);

CREATE INDEX round_clause_positions_round_idx ON round_clause_positions (round_id);

ALTER TABLE round_clause_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage own round clause positions"
  ON round_clause_positions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Dual-channel comments. Internal strategy is owner-only; external is the
-- counterparty-visible channel (guests read it through token RPCs, never
-- this table). Owner posts on both channels in v1.
CREATE TABLE negotiation_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  audit_id UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  round_id UUID REFERENCES negotiation_rounds(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('internal', 'external')),
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX negotiation_comments_audit_idx ON negotiation_comments (user_id, audit_id, created_at DESC);

ALTER TABLE negotiation_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage own negotiation comments"
  ON negotiation_comments FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Guest portal reads the external channel only. Internal comments can
-- never leak through this path: the channel predicate is in SQL, and the
-- grant check fails closed first.
CREATE OR REPLACE FUNCTION get_guest_negotiation(p_token TEXT)
RETURNS TABLE (
  round_no INT,
  stance TEXT,
  status TEXT,
  clause_id TEXT,
  outcome TEXT,
  rung INT,
  variant TEXT,
  reasoning TEXT,
  counter_text TEXT,
  comment_body TEXT,
  comment_created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH live_grant AS (
    SELECT g.deal_id
    FROM guest_grants g
    WHERE g.token = p_token
      AND g.revoked_at IS NULL
      AND (g.expires_at IS NULL OR g.expires_at > now())
  )
  SELECT r.round_no, r.stance, r.status,
    p.clause_id, p.outcome, p.rung, p.variant, p.reasoning, p.counter_text,
    NULL::TEXT, NULL::TIMESTAMPTZ
  FROM live_grant gr
  JOIN negotiation_rounds r ON r.audit_id = gr.deal_id
  LEFT JOIN round_clause_positions p ON p.round_id = r.id
  UNION ALL
  SELECT NULL::INT, NULL::TEXT, NULL::TEXT,
    NULL::TEXT, NULL::TEXT, NULL::INT, NULL::TEXT, NULL::TEXT, NULL::TEXT,
    c.body, c.created_at
  FROM live_grant gr
  JOIN negotiation_comments c ON c.audit_id = gr.deal_id AND c.channel = 'external'
  ORDER BY 1 NULLS LAST;
END;
$$;

GRANT EXECUTE ON FUNCTION get_guest_negotiation(TEXT) TO anon, authenticated;
