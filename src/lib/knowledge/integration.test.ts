import { describe, it, expect, vi } from "vitest"
import { parseContextEnvelope } from "@/lib/context/schema"
import { fetchPublishedKnowledge } from "./store"
import { resolveKnowledge } from "./resolver"
import {
  TEST_STATUTE_A,
  TEST_GUIDANCE_B,
  TEST_PRACTICE_GLOBAL,
  TEST_DRAFT_C,
  testEnvelope,
} from "./fixtures"
import { parseKnowledgeItem } from "./schema"

const envelope = parseContextEnvelope(testEnvelope())
const storeItems = [TEST_STATUTE_A, TEST_GUIDANCE_B, TEST_PRACTICE_GLOBAL, TEST_DRAFT_C].map((f) =>
  parseKnowledgeItem(f)
)

describe("context to knowledge integration", () => {
  it("resolves a ContextEnvelope to knowledge candidates", () => {
    const candidates = resolveKnowledge(envelope, storeItems, { asOf: "2026-09-04" })
    const keys = candidates.map((c) => c.itemKey)
    expect(keys).toContain("test-statute-a")
    expect(keys).toContain("test-practice-global")
    // Expired guidance and drafts never resolve in production mode.
    expect(keys).not.toContain("test-guidance-b")
    expect(keys).not.toContain("test-draft-c")
  })

  it("makes candidates available through the store boundary", async () => {
    const toRow = (item: (typeof storeItems)[number]) => ({
      id: item.id,
      item_key: item.itemKey,
      version: item.version,
      title: item.title,
      kind: item.kind,
      authority: item.authority,
      jurisdiction_scope: item.jurisdiction.scope,
      jurisdiction_code: item.jurisdiction.code,
      source_name: item.provenance.source,
      source_reference: item.provenance.sourceReference,
      source_authority: item.provenance.sourceAuthority,
      retrieved_at: item.provenance.retrievedAt,
      publisher: item.provenance.publisher,
      original_uri: item.provenance.originalUri,
      checksum: item.provenance.checksum,
      effective_from: item.effectiveFrom,
      effective_to: item.effectiveTo,
      status: item.status,
      content: item.content,
      applicability: item.applicability,
      superseded_by_version: item.supersededByVersion,
      created_at: item.createdAt,
      updated_at: item.updatedAt,
    })
    const publishedRows = storeItems.filter((i) => i.status === "published").map(toRow)
    const builder: Record<string, unknown> = {}
    builder.select = vi.fn(() => builder)
    builder.eq = vi.fn(() => builder)
    builder.order = vi.fn(() => builder)
    builder.limit = vi.fn(() => builder)
    builder.then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data: publishedRows, error: null }).then(resolve)
    const client = {
      auth: { getUser: vi.fn() },
      from: vi.fn(() => builder),
    } as never

    const items = await fetchPublishedKnowledge(client)
    const candidates = resolveKnowledge(envelope, items, { asOf: "2026-09-04" })
    expect(candidates.length).toBeGreaterThan(0)
    expect(candidates.every((c) => c.sourceReference.startsWith("TEST-"))).toBe(true)
  })

  it("leaves existing analysis working when the store is empty", () => {
    // Empty knowledge is valid: the resolver returns [] and analysis
    // proceeds exactly as before Phase 5C.
    expect(resolveKnowledge(envelope, [])).toEqual([])
  })

  it("has no anonymous analysis path (Dealenz is authenticated-only)", async () => {
    const { existsSync } = await import("node:fs")
    expect(existsSync("src/app/api/analyze-anonymous/route.ts")).toBe(false)
  })
})
