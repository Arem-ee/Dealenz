CREATE TYPE conversation_message_type AS ENUM ('message', 'consultation_turn', 'inline_confirmation');

ALTER TABLE conversation_messages
  ADD COLUMN message_type conversation_message_type NOT NULL DEFAULT 'message';

ALTER TABLE conversation_messages
  ADD CONSTRAINT conversation_messages_message_type_known
  CHECK (message_type IN ('message', 'consultation_turn', 'inline_confirmation'));

CREATE INDEX idx_conversation_messages_message_type ON conversation_messages(message_type);
