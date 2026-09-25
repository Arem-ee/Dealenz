import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"

// Static regression coverage for migrations that cannot run without a live
// database. These assert the security properties of the SQL text itself;
// live application still requires `supabase db push` against a real project.
function sql(name: string): string {
  return readFileSync(join(process.cwd(), "supabase", "migrations", name), "utf8")
}

// Header comments explain intent; assertions below target executable SQL.
function code(sqlText: string): string {
  return sqlText
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n")
}

describe("00039 security policies remediation (static)", () => {
  const remediation = code(sql("00039_security_policies_remediation.sql"))

  it("contains no user_metadata privilege checks", () => {
    expect(remediation).not.toMatch(/user_metadata/)
  })

  it("gates every admin policy on server-controlled app_metadata via JWT", () => {
    const checks = remediation.match(/auth\.jwt\(\) -> 'app_metadata' ->> 'is_admin'/g) ?? []
    // lawyers view+update x2, consultation view + updateUSING + updateCHECK x3,
    // knowledge read + insert + updateUSING + updateCHECK x4, grant_credits x1 = 10
    expect(checks.length).toBe(10)
  })

  it("fixes the lawyer identity mismatch through lawyers.user_id", () => {
    expect(remediation).toMatch(/lawyers\.user_id = auth\.uid\(\)/)
    expect(remediation).not.toMatch(/auth\.uid\(\) = lawyer_id/)
  })

  it("is idempotent and forward-only (no ALTER TABLE on platform objects)", () => {
    expect(remediation).toMatch(/DROP POLICY IF EXISTS/)
    expect(remediation).toMatch(/EXCEPTION WHEN duplicate_object/)
    expect(remediation).not.toMatch(/ALTER TABLE storage\.objects/)
    expect(remediation).not.toMatch(/DROP TABLE/)
  })

  it("keeps storage policies bucket- and owner-scoped", () => {
    const scoped = remediation.match(/bucket_id = 'audit-files'/g) ?? []
    expect(scoped.length).toBe(4)
    expect(remediation).toMatch(/storage\.foldername\(name\)/)
  })
})

describe("00042 data lifecycle reliability (static)", () => {
  const lifecycle = code(sql("00042_data_lifecycle_reliability.sql"))

  it("extends document_versions to real family ids without touching share tables", () => {
    expect(lifecycle).toContain("purchase-terms-sheet")
    expect(lifecycle).toContain("lease-terms-summary")
    expect(lifecycle).toContain("employment-terms-summary")
    expect(lifecycle).toContain("founder-agreement")
    expect(lifecycle).toContain("'assembled'")
    expect(lifecycle).toMatch(/uq_document_version/)
    // Share/sign tables keep their freelance-only scope (product boundary).
    expect(lifecycle).not.toMatch(/share_tokens/)
    expect(lifecycle).not.toMatch(/document_signatures/)
  })

  it("expires stale reservation holds and keeps settle paths exact", () => {
    expect(lifecycle).toMatch(/interval '1 hour'/)
    expect(lifecycle).toMatch(/t\.created_at > now\(\) - interval '1 hour'/)
  })

  it("makes admin grants idempotent without changing default calls", () => {
    expect(lifecycle).toMatch(/p_idempotency_key TEXT DEFAULT NULL/)
    expect(lifecycle).toMatch(/ON CONFLICT \(user_id, idempotency_key\) DO NOTHING/)
    // Changed signatures overload instead of replacing: drop first.
    expect(lifecycle).toMatch(/DROP FUNCTION IF EXISTS grant_credits\(UUID, INTEGER, TEXT\)/)
  })

  it("adds a partial unique index against consultation double-submit races", () => {
    expect(lifecycle).toMatch(/uq_consultation_active_per_audit/)
    expect(lifecycle).toMatch(/WHERE status IN \('requested',\s*'matched',\s*'in_progress'\)/)
  })

  it("adds bounded limiter cleanup without new infrastructure", () => {
    expect(lifecycle).toMatch(/random\(\) < 0\.05/)
    expect(lifecycle).toMatch(/interval '7 days'/)
  })

  it("is forward-only and idempotent", () => {
    expect(lifecycle).toMatch(/DROP CONSTRAINT IF EXISTS/)
    expect(lifecycle).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS/)
    expect(lifecycle).toMatch(/CREATE OR REPLACE FUNCTION/)
    expect(lifecycle).not.toMatch(/DROP TABLE/)
  })
})

describe("00044 review collaboration signing (static)", () => {
  const review = code(sql("00044_review_collaboration_signing.sql"))

  it("adds the review lifecycle states without touching history", () => {
    expect(review).toMatch(/ADD VALUE IF NOT EXISTS 'accepted'/)
    expect(review).toMatch(/ADD VALUE IF NOT EXISTS 'changes_requested'/)
    expect(review).toMatch(/ADD VALUE IF NOT EXISTS 'client_review'/)
    expect(review).not.toMatch(/DROP TYPE/)
  })

  it("creates scoped tables with RLS and status-bounded lawyer access", () => {
    for (const table of ["review_comments", "document_signers", "service_orders"]) {
      expect(review).toContain(`CREATE TABLE IF NOT EXISTS ${table}`)
    }
    // Terminal-state revocation is documented intent (comments stripped above).
    expect(sql("00044_review_collaboration_signing.sql")).toMatch(/terminal[\s\S]{0,120}revoke/i)
    // Lawyer policies are gated on active review statuses only.
    const activeGates = review.match(/cr\.status IN \('matched', 'accepted', 'in_progress', 'changes_requested', 'client_review'\)/g) ?? []
    expect(activeGates.length).toBeGreaterThanOrEqual(4)
    // No public write paths: owner-scoped or assigned-lawyer only.
    expect(review).not.toMatch(/FOR ALL[\s\S]{0,200}USING \(true\)/)
  })

  it("keeps money and credits separate by construction", () => {
    expect(review).toContain("service_orders")
    // No ledger writes, no second ledger, no payment processing: the only
    // Paystack surface is a passive nullable reference column for the future.
    expect(review).not.toMatch(/INSERT INTO credit_ledger/)
    expect(review).not.toMatch(/CREATE TABLE \w*credit/)
    expect(review).not.toMatch(/grant_credits|finalize_reservation|void_reservation/)
    expect(review).toMatch(/paystack_reference TEXT/)
  })

  it("binds signing to versions and tokens with least privilege", () => {
    expect(review).toMatch(/DROP NOT NULL/)
    expect(review).toMatch(/signer_id UUID REFERENCES document_signers/)
    expect(review).toMatch(/GRANT EXECUTE ON FUNCTION get_signer_view TO anon, authenticated/)
    expect(review).toMatch(/GRANT EXECUTE ON FUNCTION sign_as_invitee TO anon, authenticated/)
    expect(review).toMatch(/GRANT EXECUTE ON FUNCTION decline_as_invitee TO anon, authenticated/)
    expect(review).toMatch(/GRANT EXECUTE ON FUNCTION get_lawyer_review_bundle TO authenticated/)
    expect(review).toMatch(/GRANT EXECUTE ON FUNCTION lawyer_create_version TO authenticated/)
    expect(review).toMatch(/SET search_path = public/)
    // Superseded versions cannot be signed; duplicates cannot double-sign.
    expect(review).toMatch(/newer document version/i)
    expect(review).toMatch(/already been signed/)
  })

  it("is forward-only and safely re-runnable", () => {
    // Supabase applies each migration transactionally, so tables, indexes,
    // columns, and functions use IF NOT EXISTS / CREATE OR REPLACE.
    expect(review).toMatch(/CREATE TABLE IF NOT EXISTS/)
    expect(review).toMatch(/CREATE INDEX IF NOT EXISTS/)
    expect(review).toMatch(/ADD COLUMN IF NOT EXISTS/)
    expect(review).toMatch(/CREATE OR REPLACE FUNCTION/)
    expect(review).toMatch(/DROP TRIGGER IF EXISTS/)
    expect(review).not.toMatch(/DROP TABLE/)
    expect(review).not.toMatch(/DROP TYPE/)
  })

  it("denies owners direct signer writes and comment/proposal forgery", () => {
    // No owner UPDATE/DELETE on signers: revocation is RPC-only.
    expect(review).not.toMatch(/ON document_signers FOR UPDATE/)
    expect(review).not.toMatch(/ON document_signers FOR DELETE/)
    // Provenance/scoping immutability for comments, reviews, and orders.
    expect(review).toContain("enforce_review_comment_immutable")
    expect(review).toContain("enforce_consultation_request_immutable")
    expect(review).toContain("enforce_service_order_immutable")
    expect(review).toContain("revoke_signer_invite")
    expect(review).toMatch(/GRANT EXECUTE ON FUNCTION revoke_signer_invite TO authenticated/)
  })

  it("binds invitee identity by email and serializes version races", () => {
    expect(review).toMatch(/Email does not match this invitation/)
    expect(review).toMatch(/pg_advisory_xact_lock\(hashtext\('docver:'/)
  })

  it("bounds lawyer bundle reads against abuse", () => {
    expect(review).toMatch(/ORDER BY dv\.version_number DESC LIMIT 100/)
    expect(review).toMatch(/ORDER BY c\.created_at DESC LIMIT 200/)
  })

  it("exposes scoped lawyer activity without widening RLS", () => {
    expect(review).toContain("get_lawyer_activity")
    expect(review).toMatch(/GRANT EXECUTE ON FUNCTION get_lawyer_activity TO authenticated/)
    expect(review).toMatch(/LIMIT v_limit/)
  })

  it("reports invitee execution counts without leaking identities", () => {
    expect(review).toMatch(/total_signers INTEGER/)
    expect(review).toMatch(/signed_signers INTEGER/)
  })

  it("blocks lawyer self-verification at the database layer", () => {
    // The owner-profile policy would otherwise let anyone verify themselves.
    expect(review).toContain("enforce_lawyer_verification")
    expect(review).toMatch(/Applications start as pending/)
    expect(review).toMatch(/Only administrators can change verification status/)
    expect(review).toMatch(/Lawyer account ownership is immutable/)
  })

  it("caps review growth against automated abuse", () => {
    expect(review).toMatch(/enforce_review_comment_cap/)
    expect(review).toMatch(/Comment limit reached for this review/)
    expect(review).toMatch(/Version limit reached for this document/)
  })
})

describe("00040 abuse rate limits (static)", () => {
  const abuse = code(sql("00040_abuse_rate_limits.sql"))

  it("creates a function-gated counter table with no direct access", () => {
    expect(abuse).toMatch(/CREATE TABLE IF NOT EXISTS anonymous_rate_limits/)
    expect(abuse).toMatch(/ENABLE ROW LEVEL SECURITY/)
    expect(abuse).toMatch(/GRANT EXECUTE ON FUNCTION check_anonymous_rate_limit TO anon, authenticated/)
    expect(abuse).toMatch(/SECURITY DEFINER/)
    expect(abuse).toMatch(/SET search_path = public/)
  })

  it("fails closed on malformed limiter input", () => {
    expect(abuse).toMatch(/RETURN QUERY SELECT false, 0/)
  })

  it("gates share reads on token shape and throttles view writes", () => {
    expect(abuse).toMatch(/p_token !~\*/)
    expect(abuse).toMatch(/10 minutes/)
  })

  it("validates sign inputs server-side", () => {
    expect(abuse).toMatch(/char_length\(btrim\(p_name\)\) = 0/)
    expect(abuse).toMatch(/char_length\(p_name\) > 120/)
    expect(abuse).toMatch(/A-Za-z0-9._%\+-/)
  })
})

describe("00047 lawyer trust layer (static)", () => {
  const trust = code(sql("00047_lawyer_trust.sql"))

  it("does not retype the policy-referenced status column", () => {
    // 'suspended' was pre-committed to the enum out-of-band (ADD VALUE
    // cannot run in a migration transaction, and the column is
    // policy-referenced so it cannot be retyped). Regression guard: the
    // failing TEXT-conversion approach must not come back.
    expect(trust).not.toMatch(/ALTER COLUMN verification_status TYPE/)
    expect(trust).toMatch(/OLD\.verification_status = 'rejected'/)
    expect(trust).toMatch(/NEW\.verification_status := 'pending'/)
  })

  it("adds a nullable verification record without backfilling history", () => {
    for (const col of ["verification_source", "regulator", "license_status", "verification_reference", "verification_notes"]) {
      expect(trust).toContain(`ADD COLUMN IF NOT EXISTS ${col}`)
    }
    expect(trust).toMatch(/Never self-attestation/)
  })

  it("keeps inserts born pending with an empty record", () => {
    expect(trust).toMatch(/Applications start as pending/)
    expect(trust).toMatch(/Verification record is set by review, not application/)
  })

  it("voids verification when credentials change on a verified row", () => {
    expect(trust).toMatch(/bar_license_number IS DISTINCT FROM NEW.bar_license_number/)
    expect(trust).toMatch(/bar_jurisdiction IS DISTINCT FROM NEW.bar_jurisdiction/)
    expect(trust).toMatch(/NEW.verification_status := 'pending'/)
    expect(trust).toMatch(/NEW.verification_notes := OLD.verification_notes/)
  })

  it("allows only the rejected -> pending owner correction, nothing else", () => {
    expect(trust).toMatch(/OLD.verification_status = 'rejected'/)
    expect(trust).toMatch(/NEW.verification_status = 'pending'/)
    expect(trust).toMatch(/Only administrators can change verification record/)
    expect(trust).toMatch(/Only administrators can change verification status/)
    expect(trust).toMatch(/Lawyer account ownership is immutable/)
  })

  it("is forward-only and safely re-runnable", () => {
    expect(trust).toMatch(/CREATE OR REPLACE FUNCTION enforce_lawyer_verification/)
    expect(trust).toMatch(/DROP TRIGGER IF EXISTS trg_lawyer_verification/)
    expect(trust).toMatch(/IF NOT EXISTS/)
  })
})

describe("00046 lawyer auto-assignment (static)", () => {
  const auto = code(sql("00046_auto_assignment.sql"))

  it("is forward-only, locked down, and callable by owners", () => {
    expect(auto).toMatch(/CREATE OR REPLACE FUNCTION auto_assign_review/)
    expect(auto).toMatch(/SECURITY DEFINER/)
    expect(auto).toMatch(/SET search_path = public/)
    expect(auto).toMatch(/GRANT EXECUTE ON FUNCTION auto_assign_review TO authenticated/)
  })

  it("assigns only verified lawyers, never pending or rejected", () => {
    expect(auto).toMatch(/verification_status = 'verified'/)
  })

  it("excludes self-dealing through the lawyer user link", () => {
    expect(auto).toMatch(/l\.user_id IS NULL OR l\.user_id IS DISTINCT FROM v_request\.user_id/)
  })

  it("never silently re-assigns a recorded decliner", () => {
    expect(auto).toMatch(/review_decline/)
    expect(auto).toMatch(/payload ->> 'lawyer_id'/)
  })

  it("spreads load deterministically without an invented capacity cap", () => {
    expect(auto).toMatch(/ORDER BY COUNT\(active\.id\) ASC, l\.created_at ASC, l\.id ASC/)
  })

  it("writes only when the request is still unassigned (race-safe)", () => {
    expect(auto).toMatch(/FOR UPDATE/)
    expect(auto).toMatch(/AND lawyer_id IS NULL/)
    expect(auto).toMatch(/AND status IN \('requested', 'waitlist'\)/)
    expect(auto).toMatch(/race_lost/)
  })

  it("restricts triggering to the requesting owner", () => {
    expect(auto).toMatch(/v_request\.user_id IS DISTINCT FROM auth\.uid\(\)/)
  })
})

describe("00048 execution-locked final pointer (static)", () => {
  const lock = code(sql("00048_final_document_lock.sql"))

  it("derives the lock from bound signer state with the exact app scope", () => {
    expect(lock).toMatch(/s\.audit_id = OLD\.audit_id/)
    expect(lock).toMatch(/s\.document_type = OLD\.document_type/)
    expect(lock).toMatch(/s\.document_version_id = OLD\.document_version_id/)
    expect(lock).toMatch(/AND s\.status = 'signed'/)
    expect(lock).toMatch(/AND s\.status IS DISTINCT FROM 'signed'/)
  })

  it("rejects any real change to a locked row but passes no-op writes", () => {
    expect(lock).toMatch(/Executed final documents are immutable/)
    expect(lock).toMatch(/IF NEW IS DISTINCT FROM OLD/)
  })

  it("is a scoped UPDATE trigger that weakens nothing", () => {
    expect(lock).toMatch(/CREATE TRIGGER trg_final_document_lock/)
    expect(lock).toMatch(/BEFORE UPDATE ON final_documents/)
    expect(lock).toMatch(/DROP TRIGGER IF EXISTS trg_final_document_lock/)
    expect(lock).not.toMatch(/CREATE POLICY/)
    expect(lock).not.toMatch(/GRANT EXECUTE/)
    expect(lock).not.toMatch(/SECURITY DEFINER/)
  })

  it("is forward-only and safely re-runnable", () => {
    expect(lock).toMatch(/CREATE OR REPLACE FUNCTION enforce_final_document_lock/)
    expect(lock).toMatch(/SET search_path = public/)
  })
})

describe("00055 billing service-role grants (static)", () => {
  const grants = code(sql("00055_billing_service_role_grants.sql"))

  it("grants exactly the webhook's read/write set on billing tables", () => {
    expect(grants).toMatch(/GRANT SELECT, INSERT, UPDATE ON public\.credit_purchases TO service_role/)
    expect(grants).toMatch(/GRANT SELECT, INSERT ON public\.credit_ledger TO service_role/)
  })

  it("grants failure-reporting inserts on system_logs only", () => {
    expect(grants).toMatch(/GRANT INSERT ON public\.system_logs TO service_role/)
  })

  it("grants nothing broad, destructive, or future-facing", () => {
    expect(grants).not.toMatch(/GRANT ALL/i)
    expect(grants).not.toMatch(/DELETE/i)
    expect(grants).not.toMatch(/TRUNCATE/i)
    expect(grants).not.toMatch(/REFERENCES/i)
    expect(grants).not.toMatch(/TRIGGER/i)
    expect(grants).not.toMatch(/ON ALL TABLES/i)
    expect(grants).not.toMatch(/DEFAULT PRIVILEGES/i)
    expect(grants).not.toMatch(/UPDATE ON public\.credit_ledger/i)
    expect(grants).not.toMatch(/SELECT ON public\.system_logs/i)
  })

  it("changes no schema, RLS, ownership, or RPC surface", () => {
    expect(grants).not.toMatch(/CREATE TABLE/i)
    expect(grants).not.toMatch(/ALTER TABLE/i)
    expect(grants).not.toMatch(/CREATE POLICY/i)
    expect(grants).not.toMatch(/ALTER .* OWNER/i)
    expect(grants).not.toMatch(/CREATE (OR REPLACE )?FUNCTION/i)
    expect(grants).not.toMatch(/CREATE INDEX/i)
    expect(grants).not.toMatch(/DROP /i)
  })
})

describe("00065 storage audit-files ownership (static, P0-1)", () => {
  const storage = code(sql("00065_fix_child_rls_and_storage.sql"))

  it("keeps all four audit-files policies bucket- and owner-scoped", () => {
    const scoped = storage.match(/bucket_id = 'audit-files'/g) ?? []
    expect(scoped.length).toBe(4)
    const ownerChecks = storage.match(/auth\.uid\(\)::text = \(storage\.foldername\(name\)\)\[1\]/g) ?? []
    expect(ownerChecks.length).toBe(4)
  })

  it("binds the second path segment to caller-owned audits", () => {
    const auditChecks = storage.match(/\(storage\.foldername\(name\)\)\[2\] AND a\.user_id = auth\.uid\(\)/g) ?? []
    expect(auditChecks.length).toBe(4)
  })

  it("is hosted-safe: no ALTER TABLE on the platform-owned storage.objects", () => {
    expect(storage).not.toMatch(/ALTER TABLE storage\.objects/)
  })

  it("supersedes the 20260903 storage draft (which must stay unapplied)", () => {
    // The draft carries only first-segment ownership; 00065 adds the audit
    // ownership check on top. Applying the draft now would be a no-op at
    // best (duplicate_object guard) — the effective enforcement lives here.
    const draft = code(sql("20260903000001_storage_rls_remediation.sql"))
    expect(draft).not.toMatch(/foldername\(name\)\)\[2\]/)
    // Header marker is a comment, so assert on the raw file, not the
    // comment-stripped code.
    expect(sql("20260903000001_storage_rls_remediation.sql")).toMatch(/DRAFT, NOT EXECUTED/)
  })
})

describe("00070 owner-signs-first enforcement (static)", () => {
  const enforcement = code(sql("00070_owner_signs_first.sql"))

  it("gates every signer-status write with a trigger", () => {
    expect(enforcement).toMatch(/CREATE OR REPLACE FUNCTION enforce_owner_signs_first/)
    expect(enforcement).toMatch(/DROP TRIGGER IF EXISTS trg_owner_signs_first ON document_signers/)
    expect(enforcement).toMatch(/CREATE TRIGGER trg_owner_signs_first/)
    expect(enforcement).toMatch(/BEFORE UPDATE ON document_signers/)
    expect(enforcement).toMatch(/Owner must sign before counterparties/)
  })

  it("requires a post-owner version status on all gated paths", () => {
    const gates = enforcement.match(/'owner_signed', 'counterparty_pending', 'sent', 'fully_signed', 'locked'/g) ?? []
    // Trigger + sign_as_invitee + sign_shared_document = 3 gates.
    expect(gates.length).toBe(3)
  })

  it("keeps the invitee and legacy share flows otherwise identical", () => {
    expect(enforcement).toMatch(/Email does not match this invitation/)
    expect(enforcement).toMatch(/A newer document version exists/)
    expect(enforcement).toMatch(/Invalid or expired share link/)
    expect(enforcement).toMatch(/Document has already been signed/)
    expect(enforcement).toMatch(/GRANT EXECUTE ON FUNCTION sign_as_invitee\(TEXT, TEXT, TEXT\) TO anon, authenticated/)
  })

  it("is forward-only and safely re-runnable", () => {
    expect(enforcement).not.toMatch(/DROP TABLE/)
    expect(enforcement).not.toMatch(/ALTER TABLE storage\.objects/)
  })
})

describe("00071 step consumption RPC (static)", () => {
  const step = code(sql("00071_step_consumption.sql"))

  it("settles steps incrementally without voiding the reservation", () => {
    expect(step).toMatch(/CREATE OR REPLACE FUNCTION consume_reservation_step/)
    expect(step).toMatch(/RETURNS TABLE\(consumed_total INTEGER, remaining INTEGER\)/)
    expect(step).toMatch(/SECURITY DEFINER/)
    expect(step).toMatch(/SET search_path = public/)
    // Incremental rows link to the reservation; only finalize/void close it.
    expect(step).toMatch(/related_entry_id/)
    expect(step).not.toMatch(/status = 'voided'/)
  })

  it("is idempotent per step and capped at the reserved amount", () => {
    expect(step).toMatch(/idempotency_key/)
    expect(step).toMatch(/Step consumption exceeds reservation/)
    expect(step).toMatch(/GRANT EXECUTE ON FUNCTION consume_reservation_step\(UUID, TEXT, INTEGER\) TO authenticated/)
  })
})

describe("00072 signup grant (static)", () => {  const grant = code(sql("00072_signup_grant.sql"))

  it("grants the free-signup balance exactly once per new user", () => {
    expect(grant).toMatch(/CREATE OR REPLACE FUNCTION grant_signup_credits/)
    expect(grant).toMatch(/AFTER INSERT ON auth\.users/)
    expect(grant).toMatch(/FOR EACH ROW EXECUTE FUNCTION grant_signup_credits/)
    expect(grant).toMatch(/'grant',\s+10/)
    expect(grant).toMatch(/'signup:' \|\| NEW\.id::text/)
    expect(grant).toMatch(/ON CONFLICT \(user_id, idempotency_key\) DO NOTHING/)
  })

  it("writes through the same append-only ledger with no public surface", () => {
    expect(grant).toMatch(/SECURITY DEFINER/)
    expect(grant).toMatch(/SET search_path = public/)
    expect(grant).toMatch(/DROP TRIGGER IF EXISTS trg_grant_signup_credits ON auth\.users/)
  })
})

describe("00073 system_logs service read (static)", () => {
  const read = code(sql("00073_system_logs_service_read.sql"))

  it("grants read-only service access and nothing else", () => {
    expect(read).toMatch(/GRANT SELECT ON public\.system_logs TO service_role/)
    expect(read).not.toMatch(/GRANT (ALL|INSERT|UPDATE|DELETE)/i)
    expect(read).not.toMatch(/CREATE POLICY/)
    expect(read).not.toMatch(/ALTER TABLE/)
    expect(read).not.toMatch(/FORCE/)
  })
})

describe("00074 audit user cascade (static)", () => {
  const cascade = code(sql("00074_audit_user_cascade.sql"))

  it("aligns audits with the cascade-everywhere rule and nothing else", () => {
    expect(cascade).toMatch(/DROP CONSTRAINT IF EXISTS audits_user_id_fkey/)
    expect(cascade).toMatch(/REFERENCES auth\.users\(id\) ON DELETE CASCADE/)
    expect(cascade).not.toMatch(/CREATE POLICY/)
    expect(cascade).not.toMatch(/CREATE TABLE/)
    expect(cascade).not.toMatch(/DROP TABLE/)
  })
})

describe("00075 delete own account RPC (static)", () => {
  const rpc = code(sql("00075_delete_own_account.sql"))

  it("erases only the caller, with no parameters and no privilege widening", () => {
    expect(rpc).toMatch(/CREATE OR REPLACE FUNCTION delete_own_account\(\)/)
    expect(rpc).toMatch(/SECURITY DEFINER/)
    expect(rpc).toMatch(/v_user_id := auth\.uid\(\)/)
    expect(rpc).toMatch(/DELETE FROM storage\.objects WHERE owner = v_user_id/)
    expect(rpc).toMatch(/DELETE FROM auth\.users WHERE id = v_user_id/)
    expect(rpc).toMatch(/GRANT EXECUTE ON FUNCTION delete_own_account\(\) TO authenticated/)
    expect(rpc).not.toMatch(/TO anon/)
    expect(rpc).not.toMatch(/TO service_role/)
    expect(rpc).not.toMatch(/CREATE POLICY/)
    expect(rpc).not.toMatch(/CREATE TABLE/)
  })
})

describe("00076 delete own account without storage SQL (static)", () => {
  const rpc = code(sql("00076_delete_own_account_no_storage.sql"))

  it("keeps caller-only erasure and routes files through the Storage API", () => {
    expect(rpc).toMatch(/CREATE OR REPLACE FUNCTION delete_own_account\(\)/)
    expect(rpc).toMatch(/v_user_id := auth\.uid\(\)/)
    expect(rpc).toMatch(/DELETE FROM auth\.users WHERE id = v_user_id/)
    expect(rpc).toMatch(/GRANT EXECUTE ON FUNCTION delete_own_account\(\) TO authenticated/)
    expect(rpc).not.toMatch(/DELETE FROM storage\.objects/)
    expect(rpc).not.toMatch(/TO anon/)
    expect(rpc).not.toMatch(/CREATE POLICY/)
  })
})

describe("00077 token cost summary RPC (static)", () => {
  const rpc = code(sql("00077_token_cost_summary.sql"))

  it("aggregates measured tokens per deal type behind the admin gate", () => {
    expect(rpc).toMatch(/CREATE OR REPLACE FUNCTION token_cost_summary\(/)
    expect(rpc).toMatch(/app_metadata.*is_admin/)
    expect(rpc).toMatch(/phase = 'ai_usage'/)
    expect(rpc).toMatch(/GRANT EXECUTE ON FUNCTION token_cost_summary\(INTEGER\) TO authenticated/)
    expect(rpc).not.toMatch(/TO anon/)
    expect(rpc).not.toMatch(/TO service_role/)
    expect(rpc).not.toMatch(/CREATE POLICY/)
    expect(rpc).not.toMatch(/CREATE TABLE/)
  })
})

describe("00078 shared finding reports (static)", () => {
  const mig = code(sql("00078_shared_finding_reports.sql"))

  it("adds a report share kind with a read-only anon RPC", () => {
    expect(mig).toMatch(/'report'/)
    expect(mig).toMatch(/CREATE OR REPLACE FUNCTION get_shared_report\(/)
    expect(mig).toMatch(/revoked_at IS NULL/)
    expect(mig).toMatch(/expires_at > now\(\)/)
    expect(mig).toMatch(/GRANT EXECUTE ON FUNCTION get_shared_report TO anon/)
    expect(mig).not.toMatch(/document_signatures/)
    expect(mig).not.toMatch(/sign_shared_document/)
  })
})

describe("00079 audit hardening bundle (static)", () => {
  const mig = code(sql("00079_audit_hardening.sql"))

  it("closes the verified gaps without widening any grant", () => {
    expect(mig).toMatch(/WITH CHECK/)
    expect(mig).toMatch(/REVOKE EXECUTE ON FUNCTION sign_document_as_counterparty\(UUID, TEXT\) FROM anon/)
    expect(mig).toMatch(/locked[\s\S]*superseded/)
    expect(mig).toMatch(/LEAST\(COALESCE\(p_consumption_amount/)
    expect(mig).toMatch(/ON DELETE CASCADE/)
    expect(mig).toMatch(/founder-agreement/)
    expect(mig).toMatch(/phase IN \(/)
    expect(mig).toMatch(/'auth_login'/)
    expect(mig).toMatch(/'client_error'/)
    expect(mig).not.toMatch(/GRANT EXECUTE ON FUNCTION sign_document_as_counterparty\(UUID, TEXT\) TO anon/)
  })
})

describe("00082 counterparty briefs (static)", () => {
  const mig = code(sql("00082_counterparty_briefs.sql"))

  it("keeps briefs owner-scoped and immutable with idempotent persist", () => {
    expect(mig).toMatch(/ENABLE ROW LEVEL SECURITY/)
    expect(mig).toMatch(/auth\.uid\(\) = user_id/)
    expect(mig).toMatch(/FOR SELECT/)
    expect(mig).toMatch(/FOR INSERT/)
    expect(mig).not.toMatch(/FOR UPDATE/)
    expect(mig).not.toMatch(/FOR DELETE/)
    expect(mig).toMatch(/idempotency_key TEXT NOT NULL UNIQUE/)
    expect(mig).toMatch(/ON DELETE CASCADE/)
    expect(mig).not.toMatch(/TO anon/)
    expect(mig).not.toMatch(/TO public/)
  })
})

describe("00083 credit purchase revocation statuses (static)", () => {
  const mig = code(sql("00083_credit_purchase_status_revocations.sql"))

  it("widens purchase status only to the two terminal revocation states", () => {
    expect(mig).toMatch(/'refunded'/)
    expect(mig).toMatch(/'disputed'/)
    expect(mig).toMatch(/DROP CONSTRAINT IF EXISTS credit_purchases_status_check/)
  })
})
