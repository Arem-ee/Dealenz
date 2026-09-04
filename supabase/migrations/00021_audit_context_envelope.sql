-- Phase 5B: Context Resolution envelope on audits.
--
-- Decision: columns on the audits table (structured JSONB envelope plus
-- version and timestamp), not a separate context table. Rationale: context has
-- exactly one owner (the audit row), is always read/written with the audit,
-- and therefore inherits the audits RLS ownership policies with no new policy
-- surface. Field-level state, confidence, and versioning live inside the
-- validated JSONB envelope (see src/lib/context/schema.ts). Change history is
-- recorded through the existing activity_events trail by the context actions.
--
-- Existing rows keep a NULL envelope and version 0; the application lazily
-- seeds a validated envelope on first context interaction (see
-- ensureContextEnvelope in src/app/audit/[id]/context-actions.ts).

ALTER TABLE audits
  ADD COLUMN context_envelope JSONB,
  ADD COLUMN context_version INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN context_updated_at TIMESTAMPTZ;

-- Guard the version column; envelope shape is validated application-side
-- (parseContextEnvelope) because CHECK constraints cannot express the
-- field-level source/value/confidence invariants.
ALTER TABLE audits
  ADD CONSTRAINT audits_context_version_non_negative CHECK (context_version >= 0);
