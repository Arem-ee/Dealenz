-- Phase 10: conversation persistence.
--
-- Two append-mostly tables: conversations own messages. Both enforce
-- ownership via RLS (auth.uid() = user_id). No public writes, no
-- service-role, no cross-tenant leakage. attached_audit_id is nullable and
-- re-validated server-side on every turn; the FK is SET NULL on audit
-- deletion so history survives but loses its attachment.

CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  attached_audit_id UUID REFERENCES audits(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_conversations_user_updated ON conversations(user_id, updated_at DESC);
CREATE INDEX idx_conversations_user_created ON conversations(user_id, created_at DESC);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own conversations"
  ON conversations FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 8000),
  operation TEXT CHECK (operation IS NULL OR char_length(operation) BETWEEN 1 AND 40),
  intent TEXT CHECK (intent IS NULL OR char_length(intent) BETWEEN 1 AND 40),
  objective TEXT CHECK (objective IS NULL OR char_length(objective) BETWEEN 1 AND 40),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_conversation_messages_conversation ON conversation_messages(conversation_id, created_at);
CREATE INDEX idx_conversation_messages_user ON conversation_messages(user_id);

ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own conversation messages"
  ON conversation_messages FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
