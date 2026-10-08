-- 00109: notification preferences (phase 1: two real toggles).
--
-- Only categories with gated writers exist: approval_requests and
-- deadline_digests. Transactional notices (signatures sealed, billing
-- states, plan changes) always send — that is the honest standard, and
-- no toggle pretends otherwise. Absent row ⟺ everything on. Writers
-- pass a category; the store checks prefs and skips quietly when off.
-- Prefs read failures fail OPEN (send) — never lose a notice to a
-- prefs-table hiccup.

CREATE TABLE IF NOT EXISTS notification_prefs (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  approval_requests BOOLEAN NOT NULL DEFAULT true,
  deadline_digests BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE notification_prefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own notification prefs" ON notification_prefs;
CREATE POLICY "Users manage own notification prefs"
  ON notification_prefs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
