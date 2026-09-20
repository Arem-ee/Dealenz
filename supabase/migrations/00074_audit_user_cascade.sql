-- Account-deletion repair: audits blocked auth.users deletes.
--
-- audits.user_id was the only user foreign key without an ON DELETE action,
-- so deleting any user that ever created a deal failed with a generic
-- database error — including users with no other rows left. Every other
-- user-owned table cascades or nulls (see 00004–00063), and product.md
-- documents cascade-everywhere as the data-lifecycle rule, so this aligns
-- the one outlier instead of inventing a new policy. Deleting a user now
-- removes their audits (and, through existing cascades, everything under
-- them). No RLS, policy, or column change.
--
-- Forward-only. Safe re-run.
ALTER TABLE public.audits DROP CONSTRAINT IF EXISTS audits_user_id_fkey;
ALTER TABLE public.audits
  ADD CONSTRAINT audits_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
