-- 00048 Execution-locked final-document pointer (Phase 11 integrity lockdown).
--
-- Root cause: the owner RLS UPDATE policy on final_documents permits any
-- column change on own rows, while the executed-final lock lived only in
-- the finalizeDocument server action. A session holding the owner's JWT
-- could bypass the action (direct PostgREST UPDATE) and re-point, swap, or
-- roll back an executed final. RLS answers WHO may attempt the write; it
-- cannot answer whether the write is semantically allowed. This trigger
-- answers the second question at the Postgres boundary.
--
-- Lock definition (mirrors isVersionExecuted in
-- src/app/audit/[id]/document-actions.ts EXACTLY — same scope, same rule):
-- a final is execution-locked when at least one signer is bound to its
-- exact (audit_id, document_type, document_version_id) AND every bound
-- signer has status 'signed'. Declined/revoked rows therefore keep the
-- pointer re-pointable, matching the application re-point guard; completion
-- (zero-pending rule in completeDeal) is a separate, intentionally
-- different gate and is NOT what this trigger enforces.
--
-- Rule: on an execution-locked row, any UPDATE that changes the row is
-- rejected. No-op updates (identical row, e.g. idempotent retries) pass.
-- Pre-execution re-points, inserts, and reads are untouched. DELETE was
-- never granted (no policy), so no trigger is needed for it.
--
-- Concurrency: the check runs inside the writer's row lock at statement
-- time, strictly after the application's own check, so a signature landing
-- between the app check and the write still locks correctly. Signer writes
-- keep their existing advisory-lock serialization; this trigger takes no
-- explicit locks.
--
-- Forward-only, safely re-runnable (OR REPLACE + DROP IF EXISTS).

CREATE OR REPLACE FUNCTION enforce_final_document_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Execution lock derived from bound signer state, never stored.
  IF EXISTS (
    SELECT 1 FROM document_signers s
    WHERE s.audit_id = OLD.audit_id
      AND s.document_type = OLD.document_type
      AND s.document_version_id = OLD.document_version_id
      AND s.status = 'signed'
  ) AND NOT EXISTS (
    SELECT 1 FROM document_signers s
    WHERE s.audit_id = OLD.audit_id
      AND s.document_type = OLD.document_type
      AND s.document_version_id = OLD.document_version_id
      AND s.status IS DISTINCT FROM 'signed'
  ) THEN
    IF NEW IS DISTINCT FROM OLD THEN
      RAISE EXCEPTION 'Executed final documents are immutable: re-pointing, swapping, or rolling back an executed final is not allowed';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_final_document_lock ON final_documents;
CREATE TRIGGER trg_final_document_lock
  BEFORE UPDATE ON final_documents
  FOR EACH ROW EXECUTE FUNCTION enforce_final_document_lock();
