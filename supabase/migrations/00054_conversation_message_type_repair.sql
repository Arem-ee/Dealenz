-- Phase 21A reconciliation (forward-only, non-destructive).
--
-- Live production carries an out-of-band constraint on
-- public.conversation_messages:
--
--   conversation_messages_message_type_check
--   CHECK (message_type = ANY (ARRAY['text'::text, 'confirmation'::text]))
--
-- The application canonically writes only 'message' | 'consultation_turn' |
-- 'inline_confirmation' (MessageType in src/lib/conversation/store.ts), and
-- migration 00050 defines exactly that intended set. The rogue constraint
-- rejects every application write, so no conversation message can persist.
--
-- Repair: abort if any existing row holds a non-canonical value; otherwise
-- drop ONLY the rogue constraint (and its helper index), then enforce the
-- intended known-value constraint. The column stays TEXT (no rewrite, no
-- data movement); only the default is aligned to the application default.
-- 00050 itself is untouched, per forward-only policy.

-- 0. Safety gate: refuse to proceed if existing data falls outside the
-- intended canonical set. (Aborting rolls the file back.)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.conversation_messages
    WHERE message_type NOT IN ('message', 'consultation_turn', 'inline_confirmation')
  ) THEN
    RAISE EXCEPTION 'conversation_messages holds non-canonical message_type values; aborting repair';
  END IF;
END $$;

-- 1. Remove the rogue out-of-band constraint (no-op when already repaired).
ALTER TABLE public.conversation_messages
  DROP CONSTRAINT IF EXISTS conversation_messages_message_type_check;

-- 2. Enforce the intended canonical set, using 00050's constraint name so
-- the schema converges with the repository.
ALTER TABLE public.conversation_messages
  DROP CONSTRAINT IF EXISTS conversation_messages_message_type_known;

ALTER TABLE public.conversation_messages
  ADD CONSTRAINT conversation_messages_message_type_known
  CHECK (message_type IN ('message', 'consultation_turn', 'inline_confirmation'));

-- 3. Align the column default with the application default ('message').
ALTER TABLE public.conversation_messages
  ALTER COLUMN message_type SET DEFAULT 'message';

-- 4. Replace the rogue helper index with 00050's intended index name.
DROP INDEX IF EXISTS public.idx_conversation_messages_type;

CREATE INDEX IF NOT EXISTS idx_conversation_messages_message_type
  ON public.conversation_messages (message_type);
