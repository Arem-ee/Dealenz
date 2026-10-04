-- 00096: approval decision queue (phase 1: named approvers).
--
-- work_approvals (00056) seals SELF-approval and stays untouched. This
-- table is the TEAM queue: a requester asks a named approver (Owner/Admin
-- of a shared org) to decide a plan, the verdict + comment freeze here,
-- and execution accepts a live approved verdict through the same
-- version/hash seal the self-flow uses. approver_group_id is carried
-- nullable so groups slot in later with zero rework (phase 2).
-- One live request per subject: a plan cannot be shopped to two
-- approvers at once.

CREATE TABLE IF NOT EXISTS approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  approver_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  approver_group_id UUID,
  subject_type TEXT NOT NULL CHECK (subject_type = 'plan'),
  subject_id UUID NOT NULL,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  detail TEXT NOT NULL CHECK (char_length(detail) BETWEEN 1 AND 1000),
  verdict TEXT NOT NULL DEFAULT 'pending' CHECK (verdict IN ('pending', 'approved', 'rejected')),
  comment TEXT CHECK (comment IS NULL OR char_length(comment) <= 1000),
  plan_version INTEGER,
  approved_payload_hash TEXT,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (approver_user_id <> user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_approval_request_live_subject
  ON approval_requests (subject_id) WHERE verdict = 'pending';

CREATE INDEX IF NOT EXISTS idx_approval_requests_approver
  ON approval_requests (approver_user_id, verdict, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_approval_requests_requester
  ON approval_requests (user_id, created_at DESC);

ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;

-- Requester and approver read each other's rows on shared requests.
DROP POLICY IF EXISTS "Approval parties read shared requests" ON approval_requests;
CREATE POLICY "Approval parties read shared requests"
  ON approval_requests FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() = approver_user_id);

-- Only the requester files, and never to themselves (CHECK re-verifies).
DROP POLICY IF EXISTS "Requesters file approval requests" ON approval_requests;
CREATE POLICY "Requesters file approval requests"
  ON approval_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id AND auth.uid() <> approver_user_id);

-- Only the designated approver decides, and only once: the USING clause
-- pins the row to pending, so a decided verdict is immutable.
DROP POLICY IF EXISTS "Approvers decide pending requests" ON approval_requests;
CREATE POLICY "Approvers decide pending requests"
  ON approval_requests FOR UPDATE
  USING (auth.uid() = approver_user_id AND verdict = 'pending')
  WITH CHECK (auth.uid() = approver_user_id);
