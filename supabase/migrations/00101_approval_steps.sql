-- 00101: sequential approval steps (the market standard).
--
-- A request carries ordered legs; exactly one is live at a time. Approve
-- advances, reject ends the whole request. The parent row stays the
-- cursor: its approver_user_id / approver_group_id always mirror the
-- CURRENT step, so every existing gate keeps working untouched — RLS
-- arms, queue reads, delegation_covers_request, the execution seal, and
-- notifications all read the parent and need no changes. Step rows are
-- the history (who decided what, when, with which comment).
-- Per-leg routing reuses the named-XOR-group shape; legs beyond the
-- first may route anywhere (including back to the requester's org —
-- self-decide stays blocked at decide-time for every leg).

CREATE TABLE IF NOT EXISTS approval_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
  step_no INTEGER NOT NULL CHECK (step_no >= 0),
  approver_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  approver_group_id UUID REFERENCES permission_groups(id) ON DELETE SET NULL,
  verdict TEXT NOT NULL DEFAULT 'pending' CHECK (verdict IN ('pending', 'approved', 'rejected', 'skipped')),
  comment TEXT CHECK (comment IS NULL OR char_length(comment) <= 1000),
  decided_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (approver_user_id IS NOT NULL AND approver_group_id IS NULL)
    OR (approver_user_id IS NULL AND approver_group_id IS NOT NULL)
  ),
  UNIQUE (request_id, step_no)
);

CREATE INDEX IF NOT EXISTS idx_approval_steps_request
  ON approval_steps (request_id, step_no);

ALTER TABLE approval_steps ENABLE ROW LEVEL SECURITY;

-- Visibility mirrors the parent queue: parties, routed-group members,
-- and live covers see every leg of requests they can see.
DROP POLICY IF EXISTS "Step parties read steps" ON approval_steps;
CREATE POLICY "Step parties read steps"
  ON approval_steps FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM approval_requests r
      WHERE r.id = approval_steps.request_id
        AND (
          auth.uid() = r.user_id
          OR auth.uid() = r.approver_user_id
          OR (
            r.approver_group_id IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM permission_group_members gm
              WHERE gm.group_id = r.approver_group_id AND gm.user_id = auth.uid()
            )
          )
          OR delegation_covers_request(auth.uid(), r)
        )
    )
  );

-- Legs are written at filing time by the requester, through the server
-- action (service-validated). No client updates: verdicts land via the
-- decide path's service writes.
DROP POLICY IF EXISTS "Requesters file steps" ON approval_steps;
CREATE POLICY "Requesters file steps"
  ON approval_steps FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM approval_requests r
      WHERE r.id = approval_steps.request_id
        AND r.user_id = auth.uid()
        AND r.verdict = 'pending'
    )
  );
