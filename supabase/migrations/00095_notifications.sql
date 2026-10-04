-- 00095: notification center.
--
-- The product had toasts (ephemeral) and an audit log (invisible) but
-- nothing telling a user "you have 3 unread". This table is that queue:
-- one row per event worth surfacing, owner-scoped, read = timestamp
-- (never a delete, so the trail keeps what was shown and when).
-- Writers are server-side only (signing lifecycle, expiry cron, and later
-- approvals); the client only reads and marks read. Types mirror the
-- panel: reminder, success, approval, status, signing.

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('reminder', 'success', 'approval', 'status', 'signing')),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  link TEXT CHECK (link IS NULL OR (char_length(link) BETWEEN 2 AND 300 AND link LIKE '/%')),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications (user_id, created_at DESC) WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_user_recent
  ON notifications (user_id, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own notifications" ON notifications;
CREATE POLICY "Users manage own notifications"
  ON notifications FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
