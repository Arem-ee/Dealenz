-- 00119: commenter grant scope (gaps D3).
--
-- Cumulative ladder reader < commenter < uploader: commenters read and
-- post on the external channel only (channel forced server-side in
-- post_guest_comment); uploaders keep upload rights and may also comment.
-- Readers stay read-only. Existing grants keep their scopes; nothing is
-- re-graded by this change.
--
-- Forward-only, additive. No RLS changes (grant rows stay owner-managed;
-- comment writes flow through the token RPC).

ALTER TABLE guest_grants
  DROP CONSTRAINT guest_grants_scope_check;

ALTER TABLE guest_grants
  ADD CONSTRAINT guest_grants_scope_check
    CHECK (scope IN ('reader', 'commenter', 'uploader'));
