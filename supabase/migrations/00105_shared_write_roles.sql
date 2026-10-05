-- 00105: write roles for shared members (phase 1: comment + ask).
--
-- deal_shares gains a scope: viewer (read, the default all existing rows
-- keep), commenter (post zero-AI comments), asker (ask with reader-pays
-- billing), participant (both). Editing, signing, invites, monitoring,
-- plans, and re-sharing stay owner-only — their user_id chains are
-- untouched, so shared writers are excluded by construction.
-- Comments reuse conversation_messages with a shared marker (no new
-- table); the INSERT arm below gates membership + shared-deal + scope,
-- and the parent-deal conjunction keeps non-shared threads failing
-- closed. Owner-delete closes the spam gap: the thread owner may remove
-- reader rows on owned deals, nothing else.

ALTER TABLE deal_shares
  ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'viewer'
  CHECK (scope IN ('viewer', 'commenter', 'asker', 'participant'));

-- Scope check shared by the policies below: the caller sits in a group
-- the deal is shared with at the required scope or broader.
-- participant implies both; there is no narrower combination.
CREATE OR REPLACE FUNCTION deal_share_grants(
  p_deal_id UUID,
  p_user_id UUID,
  p_need TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM deal_shares s
    JOIN permission_group_members gm ON gm.group_id = s.group_id
    WHERE s.deal_id = p_deal_id
      AND gm.user_id = p_user_id
      AND (
        s.scope = 'participant'
        OR s.scope = p_need
      )
  )
$$;

DROP POLICY IF EXISTS "Shared writers comment on shared threads" ON conversation_messages;
CREATE POLICY "Shared writers comment on shared threads"
  ON conversation_messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_messages.conversation_id
        AND c.attached_audit_id IS NOT NULL
        AND (
          deal_share_grants(c.attached_audit_id, auth.uid(), 'commenter')
          OR deal_share_grants(c.attached_audit_id, auth.uid(), 'asker')
        )
    )
  );

DROP POLICY IF EXISTS "Thread owners remove reader rows" ON conversation_messages;
CREATE POLICY "Thread owners remove reader rows"
  ON conversation_messages FOR DELETE
  USING (
    auth.uid() <> user_id
    AND EXISTS (
      SELECT 1 FROM conversations c
      JOIN audits a ON a.id = c.attached_audit_id
      WHERE c.id = conversation_messages.conversation_id
        AND a.user_id = auth.uid()
    )
  );
