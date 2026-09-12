-- 00047 Lawyer trust layer: suspension, verification record, credential
-- integrity, and a controlled correction path.
--
-- Gaps closed (see inspection):
--   1. No way to pause a verified lawyer: rejection was terminal and
--      semantically wrong for misconduct/expiry/disputes. Adds 'suspended':
--      reversible, admin-only, and (like every non-verified state) excluded
--      from professional access, which gates on verification_status =
--      'verified' everywhere (requireVerifiedLawyer, auto_assign_review).
--   2. No verification record: adds source/regulator/license-status/
--      reference/notes columns. Vocabulary is documented, not CHECK-locked:
--      verification_source: 'official_register' | 'admin_review' | NULL
--      (self-attestation, uploads, LinkedIn, firm sites are NEVER sources —
--      supporting identity evidence only).
--      license_status: 'active' | 'expired' | 'suspended' | 'unknown' | NULL.
--   3. Verified lawyers could rewrite bar_license_number/bar_jurisdiction
--      with no re-review (owner UPDATE policy allows own-row writes).
--      Changing either credential on a verified row now forces the row back
--      to 'pending' with verification cleared (system downgrade, not a
--      privilege change). Specialties/bio/firm text stay freely editable.
--   4. Rejection was a dead end despite the UI promising reapplication:
--      owners may move their own row rejected -> pending (correction only,
--      rate-limited at the API layer, admin still decides).
--
-- State model (enforced by the verify API + this trigger):
--   pending -> verified | rejected      (admin verify/reject)
--   verified -> suspended               (admin suspend)
--   suspended -> pending | verified     (admin reinstate / re-verify)
--   rejected -> pending                 (owner correction ONLY)
-- verified_at means: last verification event. No crawler exists; staleness
-- is handled by manual re-check and suspension, never by silent expiry.
--
-- Implementation notes:
--   - The status column moves from the 3-value enum to TEXT + CHECK because
--     ALTER TYPE ... ADD VALUE cannot run inside a migration transaction.
--     Data is preserved via USING cast; the default is recast. The old enum
--     type is left in place (harmless, history-preserving).
--   - Forward-only, safely re-runnable (IF NOT EXISTS / OR REPLACE).
--   - Status domain note: 'suspended' was added to the
--     lawyer_verification_status enum via autocommit DDL before this file
--     ran (ALTER TYPE ... ADD VALUE cannot run inside a migration
--     transaction, and the column is policy-referenced so it cannot be
--     retyped). The enum itself remains the domain guard; no CHECK needed.

-- 1. Status domain: nothing to do here — 'suspended' already exists on the
-- enum (see note above). Existing rows untouched by construction.

-- 2. Verification record. All nullable: history is not backfilled, and no
-- external registry content is copied beyond identifiers/references.
ALTER TABLE lawyers ADD COLUMN IF NOT EXISTS verification_source TEXT NULL;
ALTER TABLE lawyers ADD COLUMN IF NOT EXISTS regulator TEXT NULL;
ALTER TABLE lawyers ADD COLUMN IF NOT EXISTS license_status TEXT NULL;
ALTER TABLE lawyers ADD COLUMN IF NOT EXISTS verification_reference TEXT NULL;
ALTER TABLE lawyers ADD COLUMN IF NOT EXISTS verification_notes TEXT NULL;

COMMENT ON COLUMN lawyers.verification_source IS 'How verification was established: official_register | admin_review | NULL. Never self-attestation.';
COMMENT ON COLUMN lawyers.license_status IS 'Regulator-reported standing: active | expired | suspended | unknown | NULL.';
COMMENT ON COLUMN lawyers.verified_at IS 'Last verification event. No automatic expiry; re-check is manual (suspend on doubt).';

-- 3. Guard: replaces enforce_lawyer_verification with the trust rules.
-- Protected columns (status, timestamps, actor, record) change by admin
-- only. Credential edits on verified rows force re-review. Owner
-- correction (rejected -> pending) is the single non-admin status path.
CREATE OR REPLACE FUNCTION enforce_lawyer_verification()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN := COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false);
  v_status_changed BOOLEAN := OLD.verification_status IS DISTINCT FROM NEW.verification_status;
  v_protected_changed BOOLEAN :=
    OLD.verified_at IS DISTINCT FROM NEW.verified_at
    OR OLD.verified_by IS DISTINCT FROM NEW.verified_by
    OR OLD.verification_source IS DISTINCT FROM NEW.verification_source
    OR OLD.regulator IS DISTINCT FROM NEW.regulator
    OR OLD.license_status IS DISTINCT FROM NEW.license_status
    OR OLD.verification_reference IS DISTINCT FROM NEW.verification_reference
    OR OLD.verification_notes IS DISTINCT FROM NEW.verification_notes;
  v_credentials_changed BOOLEAN :=
    OLD.bar_license_number IS DISTINCT FROM NEW.bar_license_number
    OR OLD.bar_jurisdiction IS DISTINCT FROM NEW.bar_jurisdiction;
  v_is_correction BOOLEAN :=
    OLD.verification_status = 'rejected'
    AND NEW.verification_status = 'pending';
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.verification_status IS DISTINCT FROM 'pending' THEN
      RAISE EXCEPTION 'Applications start as pending';
    END IF;
    -- Record columns are born empty; only review fills them.
    IF NEW.verification_source IS NOT NULL
      OR NEW.regulator IS NOT NULL
      OR NEW.license_status IS NOT NULL
      OR NEW.verification_reference IS NOT NULL
      OR NEW.verification_notes IS NOT NULL
      OR NEW.verified_at IS NOT NULL
      OR NEW.verified_by IS NOT NULL THEN
      RAISE EXCEPTION 'Verification record is set by review, not application';
    END IF;
    RETURN NEW;
  END IF;

  -- Credential integrity: new license claims on a verified profile void
  -- the verification. The row, not the claim, is what was verified.
  IF v_credentials_changed AND OLD.verification_status = 'verified' THEN
    NEW.verification_status := 'pending';
    NEW.verified_at := NULL;
    NEW.verified_by := NULL;
    NEW.verification_source := NULL;
    NEW.license_status := NULL;
    NEW.verification_reference := NULL;
    -- verification_notes stay: the review history is not rewritten. But a
    -- non-admin piggybacking a credential edit must not author notes.
    IF NOT v_is_admin THEN
      NEW.verification_notes := OLD.verification_notes;
    END IF;
    RETURN NEW;
  END IF;

  -- Owner correction path: rejected -> pending, record untouched.
  IF v_is_correction AND NOT v_is_admin THEN
    IF v_protected_changed THEN
      RAISE EXCEPTION 'Only administrators can change verification record';
    END IF;
    RETURN NEW;
  END IF;

  IF v_status_changed OR v_protected_changed THEN
    IF NOT v_is_admin THEN
      RAISE EXCEPTION 'Only administrators can change verification status';
    END IF;
  END IF;
  IF OLD.user_id IS DISTINCT FROM NEW.user_id THEN
    RAISE EXCEPTION 'Lawyer account ownership is immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lawyer_verification ON lawyers;
CREATE TRIGGER trg_lawyer_verification
  BEFORE INSERT OR UPDATE ON lawyers
  FOR EACH ROW EXECUTE FUNCTION enforce_lawyer_verification();
