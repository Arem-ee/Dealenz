-- Least-privilege service_role grants for the signing ceremony (00084/00085).
-- This project grants service_role per table (see 00055 pattern): without
-- these, the artifact writes and seal updates fail closed in production.
-- All service-role use stays user-scoped in code (token or audit ownership
-- verified before every write). No RLS policy changes.
-- STAGING: verify on staging before prod (db push).

-- Artifact writes from token-gated + ownership-verified routes.
GRANT INSERT, UPDATE ON public.signer_signature_artifacts TO service_role;

-- Token-to-pending-signer lookup for invitee artifact writes.
GRANT SELECT ON public.document_signers TO service_role;

-- Tamper-seal first-writer-wins updates on executed versions.
GRANT SELECT, UPDATE ON public.document_versions TO service_role;
