// Synthetic Knowledge fixtures for tests ONLY (Phase 5C).
//
// Every value here is invented for mechanics testing. Jurisdictions
// (TESTLANDIA, EXAMPLIA) and references (TEST-*) are deliberately unreal so
// these fixtures can never be mistaken for law. Do not import this file from
// application code — tests only.

import type { KnowledgeItem } from "./schema"

function base(overrides: Partial<KnowledgeItem> & { itemKey: string }): KnowledgeItem {
  return {
    id: `test-${overrides.itemKey}-v${overrides.version ?? 1}`,
    version: 1,
    title: `Test item ${overrides.itemKey}`,
    kind: "market_practice",
    authority: "market_practice",
    jurisdiction: { scope: "global", code: null },
    provenance: {
      source: "synthetic-test-fixture",
      sourceReference: "TEST-REF-001",
      sourceAuthority: "test-suite",
      retrievedAt: "2026-01-01T00:00:00.000Z",
      publisher: null,
      originalUri: null,
      checksum: null,
    },
    effectiveFrom: "2020-01-01",
    effectiveTo: null,
    status: "published",
    content: "Synthetic content for resolver mechanics testing. Not legal material.",
    applicability: {},
    supersededByVersion: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }
}

export const TEST_STATUTE_A = base({
  itemKey: "test-statute-a",
  title: "Test Statute A (Testlandia late-payment interest)",
  kind: "statute",
  authority: "authoritative",
  jurisdiction: { scope: "country", code: "Testlandia" },
  provenance: {
    source: "synthetic-test-fixture",
    sourceReference: "TEST-STATUTE-A",
    sourceAuthority: "test-suite",
    retrievedAt: "2026-01-01T00:00:00.000Z",
    publisher: null,
    originalUri: null,
    checksum: null,
  },
  effectiveFrom: "2021-06-01",
  effectiveTo: null,
  applicability: { dealTypes: ["freelance", "generic"], industries: ["technology"] },
})

export const TEST_GUIDANCE_B = base({
  itemKey: "test-guidance-b",
  title: "Test Guidance B (Examplia contractor guidance)",
  kind: "official_guidance",
  authority: "official_guidance",
  jurisdiction: { scope: "country", code: "Examplia" },
  provenance: {
    source: "synthetic-test-fixture",
    sourceReference: "TEST-GUIDANCE-B",
    sourceAuthority: "test-suite",
    retrievedAt: "2026-01-01T00:00:00.000Z",
    publisher: null,
    originalUri: null,
    checksum: null,
  },
  effectiveFrom: "2022-01-01",
  effectiveTo: "2023-12-31",
  applicability: { dealTypes: ["generic"] },
})

export const TEST_PRACTICE_GLOBAL = base({
  itemKey: "test-practice-global",
  title: "Test Practice Global (deposit norms)",
  kind: "market_practice",
  authority: "market_practice",
  applicability: { structures: ["fixed_price"] },
})

export const TEST_DRAFT_C = base({
  ...base({
    itemKey: "test-draft-c",
    title: "Test Draft C (must never resolve)",
  }),
  id: "test-test-draft-c-v1",
  status: "draft",
})

export function testEnvelope(overrides: Record<string, unknown> = {}) {
  return {
    version: 1,
    fields: {
      dealType: { value: "freelance", source: "user_confirmed", confidence: 1 },
      jurisdiction: { value: "Testlandia", source: "user_confirmed", confidence: 1 },
      governingLaw: { value: null, source: "unknown", confidence: 0 },
      userRole: { value: "freelancer", source: "user_confirmed", confidence: 1 },
      counterpartyRole: { value: "client", source: "user_confirmed", confidence: 1 },
      industry: { value: "technology", source: "user_confirmed", confidence: 1 },
      transactionStructure: { value: "fixed_price", source: "user_confirmed", confidence: 1 },
      transactionValue: { value: null, source: "unknown", confidence: 0 },
      transactionCurrency: { value: null, source: "unknown", confidence: 0 },
      transactionStage: { value: "negotiation", source: "user_confirmed", confidence: 1 },
      crossBorder: { value: false, source: "user_confirmed", confidence: 1 },
      regulatedIndustry: { value: false, source: "user_confirmed", confidence: 1 },
      entityTypes: { value: ["individual"], source: "user_confirmed", confidence: 1 },
    },
    missingRequiredContext: [],
    updatedAt: "2026-01-01T00:00:00.000Z",
    updatedBy: "test-user",
    ...overrides,
  }
}
