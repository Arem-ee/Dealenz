CREATE TABLE checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  detail TEXT,
  category TEXT NOT NULL DEFAULT 'General',
  status TEXT NOT NULL DEFAULT 'in_scope'
    CHECK (status IN ('in_scope', 'out_of_scope', 'change_order', 'completed')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own checklist items"
  ON checklist_items FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_checklist_items_audit_id ON checklist_items(audit_id);
CREATE INDEX idx_checklist_items_user_id ON checklist_items(user_id);
