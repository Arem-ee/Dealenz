import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"

function sql(name: string): string {
  return readFileSync(join(process.cwd(), "supabase", "migrations", name), "utf8")
}
function code(sqlText: string): string {
  return sqlText.split("\n").filter((line) => !line.trimStart().startsWith("--")).join("\n")
}

describe("00060 signing lifecycle and lock (static)", () => {
  const m = code(sql("00060_signing_lifecycle_and_lock.sql"))
  it("widens status to full lifecycle", () => {
    expect(m).toMatch(/ready_to_sign/)
    expect(m).toMatch(/owner_signed/)
    expect(m).toMatch(/counterparty_pending/)
    expect(m).toMatch(/fully_signed/)
    expect(m).toMatch(/locked/)
    expect(m).toMatch(/superseded/)
  })
  it("creates immutability trigger for locked/fully_signed", () => {
    expect(m).toMatch(/enforce_document_version_lock/)
    expect(m).toMatch(/Immutable document version/)
  })
  it("creates signing_events audit table with idempotency", () => {
    expect(m).toMatch(/CREATE TABLE IF NOT EXISTS signing_events/)
    expect(m).toMatch(/idempotency_key/)
    expect(m).toMatch(/UNIQUE \(audit_id, document_version_id, idempotency_key\)/)
  })
  it("uses RLS scoped to user and no broad grants", () => {
    expect(m).toMatch(/ENABLE ROW LEVEL SECURITY/)
    expect(m).not.toMatch(/GRANT ALL/i)
  })
  it("provides idempotent RPCs with advisory locks", () => {
    expect(m).toMatch(/sign_document_as_owner/)
    expect(m).toMatch(/sign_document_as_counterparty/)
    expect(m).toMatch(/pg_advisory_xact_lock/)
  })
})

describe("00061 lawyer service payment (static)", () => {
  const m = code(sql("00061_lawyer_service_payment_revenue.sql"))
  it("adds provider columns and revenue accounting", () => {
    expect(m).toMatch(/provider TEXT CHECK/)
    expect(m).toMatch(/platform_fee_minor/)
    expect(m).toMatch(/lawyer_payout_minor/)
  })
  it("creates service_payments with deterministic 20% fee check", () => {
    expect(m).toMatch(/CREATE TABLE IF NOT EXISTS service_payments/)
    expect(m).toMatch(/platform_fee_minor \+ lawyer_payout_minor = amount_minor/)
  })
  it("enforces provider confirmation before paid", () => {
    expect(m).toMatch(/Paid requires provider confirmation/)
    expect(m).toMatch(/Paid requires verified provider signature/)
  })
  it("uses provider_webhook_events for idempotency", () => {
    expect(m).toMatch(/CREATE TABLE IF NOT EXISTS provider_webhook_events/)
    expect(m).toMatch(/UNIQUE \(provider, provider_event_id\)/)
  })
})

describe("00062 monitoring (static)", () => {
  const m = code(sql("00062_monitoring_alerts.sql"))
  it("creates monitoring_events with provenance", () => {
    expect(m).toMatch(/CREATE TABLE IF NOT EXISTS monitoring_events/)
    expect(m).toMatch(/provenance TEXT NOT NULL CHECK/)
    expect(m).toMatch(/evidence JSONB/)
  })
  it("creates monitoring_alerts idempotent", () => {
    expect(m).toMatch(/CREATE TABLE IF NOT EXISTS monitoring_alerts/)
    expect(m).toMatch(/idempotency_key/)
    expect(m).toMatch(/UNIQUE \(monitoring_event_id, idempotency_key\)/)
  })
  it("uses Gmail for alerts", () => {
    expect(m).toMatch(/provider TEXT NOT NULL DEFAULT 'gmail'/)
  })
})

describe("00063 flywheel and parallel (static)", () => {
  const m = code(sql("00063_flywheel_and_parallel_execution.sql"))
  it("creates flywheel table with consent and tenant isolation", () => {
    expect(m).toMatch(/CREATE TABLE IF NOT EXISTS deal_intelligence_events/)
    expect(m).toMatch(/consented BOOLEAN/)
    expect(m).toMatch(/tenant_isolation/)
  })
  it("adds parallel execution columns", () => {
    expect(m).toMatch(/execution_mode TEXT NOT NULL DEFAULT 'foreground'/)
    expect(m).toMatch(/concurrency INTEGER NOT NULL DEFAULT 1 CHECK/)
  })
})

describe("00064 international knowledge (static)", () => {
  const m = code(sql("00064_international_knowledge_and_storage_hardening.sql"))
  it("seeds US/UK/EU knowledge", () => {
    expect(m).toMatch(/us-delaware-llc-formation/)
    expect(m).toMatch(/uk-llp-formation/)
    expect(m).toMatch(/eu-late-payment-directive/)
  })
  it("hardens storage RLS", () => {
    expect(m).toMatch(/Users update own document versions/)
  })
})
