-- DRAFT, NOT EXECUTED. Human review and explicit approval required before use.
-- See PHASE_4A_REMEDIATION_EXECUTION_PLAN.md. Do not apply without approval.
--
-- Purpose: correct the dead lawyer assigned-request policies from
-- supabase/migrations/00020_lawyers_and_consultations.sql without touching
-- that file.
--
-- Defect: the policies compare auth.uid() to lawyer_id, but lawyer_id
-- references lawyers(id), a generated row UUID, not the lawyer user UUID
-- stored in lawyers.user_id. The comparison can never match, so the
-- policies deny every lawyer unconditionally, including assigned ones.
--
-- Correction preserves policy names, table, operations, and roles, and
-- changes only the USING and WITH CHECK expressions to match through
-- lawyers.user_id. Uses ALTER POLICY rather than DROP plus CREATE, so the
-- change is non-destructive, preserves policy identity, and is idempotent
-- on re-run. Requires 00020 to have applied first (enforced by filename
-- ordering); fails loudly otherwise.
--
-- Intended semantics after correction: an authenticated Supabase user can
-- read and update a consultation request exactly when a lawyers row links
-- that request to them (lawyers.id = request.lawyer_id AND
-- lawyers.user_id = calling user). Unassigned requests (lawyer_id NULL)
-- remain invisible under these policies, as intended.

ALTER POLICY "Lawyers can view assigned consultation requests"
  ON consultation_requests
  USING (
    EXISTS (
      SELECT 1 FROM lawyers
      WHERE lawyers.id = consultation_requests.lawyer_id
        AND lawyers.user_id = auth.uid()
    )
  );

ALTER POLICY "Lawyers can update assigned consultation requests"
  ON consultation_requests
  USING (
    EXISTS (
      SELECT 1 FROM lawyers
      WHERE lawyers.id = consultation_requests.lawyer_id
        AND lawyers.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM lawyers
      WHERE lawyers.id = consultation_requests.lawyer_id
        AND lawyers.user_id = auth.uid()
    )
  );
