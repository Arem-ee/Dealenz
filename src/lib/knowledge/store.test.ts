import { describe, it, expect, vi } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
  fetchPublishedKnowledge,
  ingestKnowledgeItem,
  listItemVersions,
  transitionKnowledgeStatus,
  type KnowledgeStoreClient,
} from "./store"

const ADMIN = { id: "00000000-0000-0000-0000-0000000000a1", app_metadata: { is_admin: true } }
const USER = { id: "00000000-0000-0000-0000-0000000000b2", app_metadata: {} }
// Forged self-promotion: user-writable metadata must never confer privilege.
const FORGED = { id: "00000000-0000-0000-0000-0000000000c3", app_metadata: {}, user_metadata: { is_admin: true } }

type Row = Record<string, unknown>

// Minimal in-memory query double supporting exactly the chains store.ts uses:
// select().eq()...order().limit() (awaited), insert().select().single(),
// update().select().single(), select().eq().single().
function mockClient(user: { id: string; app_metadata: Record<string, unknown>; user_metadata?: Record<string, unknown> } | null, seed: Row[] = []) {
  const tables: Record<string, Row[]> = { knowledge_items: seed.map((r) => ({ ...r })) }
  const api = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user } }),
    },
    from: (table: string) => {
      const rows = tables[table] ?? []
      const state: { filters: Array<(r: Row) => boolean>; orderKey?: string; orderAsc?: boolean; limitN?: number; patch?: Row; inserting?: Row } = { filters: [] }
      const builder: Record<string, unknown> = {}
      builder.select = vi.fn(() => builder)
      builder.eq = vi.fn((col: string, val: unknown) => {
        state.filters.push((r) => r[col] === val)
        return builder
      })
      builder.order = vi.fn((col: string, opts?: { ascending: boolean }) => {
        state.orderKey = col
        state.orderAsc = opts?.ascending ?? true
        return builder
      })
      builder.limit = vi.fn((n: number) => {
        state.limitN = n
        return builder
      })
      builder.insert = vi.fn((row: Row) => {
        state.inserting = { ...row }
        return builder
      })
      builder.update = vi.fn((patch: Row) => {
        state.patch = { ...patch }
        return builder
      })
      builder.single = vi.fn(() => {
        if (state.inserting) {
          const inserted = { ...state.inserting, id: `id-${Math.random().toString(36).slice(2)}`, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
          rows.push(inserted)
          return Promise.resolve({ data: inserted, error: null })
        }
        const found = applyFilters(rows, state)[0] ?? null
        if (state.patch && found) Object.assign(found, state.patch, { updated_at: new Date().toISOString() })
        if (!found) return Promise.resolve({ data: null, error: { message: "none" } })
        return Promise.resolve({ data: found, error: null })
      })
      builder.then = (resolve: (v: unknown) => unknown) =>
        Promise.resolve({ data: applyFilters(rows, state), error: null }).then(resolve)
      return builder
    },
  }
  return { client: api as unknown as KnowledgeStoreClient, tables }
}

function applyFilters(
  rows: Row[],
  state: { filters: Array<(r: Row) => boolean>; orderKey?: string; orderAsc?: boolean; limitN?: number }
): Row[] {
  let out = rows.filter((r) => state.filters.every((f) => f(r)))
  if (state.orderKey) {
    const key = state.orderKey
    const asc = state.orderAsc ?? true
    out = [...out].sort((a, b) => {
      const av = a[key]
      const bv = b[key]
      if (av === bv) return 0
      if (av === null || av === undefined) return 1
      if (bv === null || bv === undefined) return -1
      return (av < bv ? -1 : 1) * (asc ? 1 : -1)
    })
  }
  if (state.limitN !== undefined) out = out.slice(0, state.limitN)
  return out
}

function ingestInput(overrides: Record<string, unknown> = {}) {
  return {
    itemKey: "test-ingest",
    title: "Test ingest item",
    kind: "market_practice" as const,
    authority: "market_practice" as const,
    jurisdiction: { scope: "global" as const, code: null },
    provenance: {
      source: "synthetic-test-fixture",
      sourceReference: "TEST-INGEST-1",
      sourceAuthority: "test-suite",
      retrievedAt: "2026-01-01T00:00:00.000Z",
      publisher: null,
      originalUri: null,
      checksum: null,
    },
    effectiveFrom: "2024-01-01",
    content: "Synthetic content. Not legal material.",
    applicability: {},
    ...overrides,
  }
}

describe("knowledge ingestion", () => {
  it("ingests a validated draft as version 1 and versions subsequent ingests", async () => {
    const { client, tables } = mockClient(ADMIN)
    const first = await ingestKnowledgeItem(client, ingestInput())
    expect(first.version).toBe(1)
    expect(first.status).toBe("draft")
    const second = await ingestKnowledgeItem(client, ingestInput())
    expect(second.version).toBe(2)
    expect(tables.knowledge_items).toHaveLength(2)
  })

  it("rejects invalid items before any write", async () => {
    const { client, tables } = mockClient(ADMIN)
    await expect(ingestKnowledgeItem(client, ingestInput({ authority: "supreme_truth" }))).rejects.toThrow(/authority/)
    await expect(
      ingestKnowledgeItem(client, ingestInput({ effectiveFrom: "2025-01-01", effectiveTo: "2024-01-01" }))
    ).rejects.toThrow(/precedes/)
    expect(tables.knowledge_items).toHaveLength(0)
  })

  it("rejects publishing while another version is published", async () => {
    const { client } = mockClient(ADMIN)
    await ingestKnowledgeItem(client, ingestInput(), "published")
    await expect(ingestKnowledgeItem(client, ingestInput(), "published")).rejects.toThrow(/supersede/)
  })

  it("walks the lifecycle draft to verified to published, then supersedes", async () => {
    const { client } = mockClient(ADMIN)
    const v1 = await ingestKnowledgeItem(client, ingestInput())
    await expect(transitionKnowledgeStatus(client, v1.id, "published")).rejects.toThrow(/Cannot transition/)
    const verified = await transitionKnowledgeStatus(client, v1.id, "verified")
    expect(verified.status).toBe("verified")
    const published = await transitionKnowledgeStatus(client, verified.id, "published")
    expect(published.status).toBe("published")
    const v2 = await ingestKnowledgeItem(client, ingestInput())
    // Publishing v2 while v1 is published is rejected; supersede v1 first.
    const verified2 = await transitionKnowledgeStatus(client, v2.id, "verified")
    await expect(transitionKnowledgeStatus(client, verified2.id, "published")).rejects.toThrow(/supersede/)
    const superseded = await transitionKnowledgeStatus(client, published.id, "superseded", 2)
    expect(superseded.status).toBe("superseded")
    expect(superseded.supersededByVersion).toBe(2)
    const published2 = await transitionKnowledgeStatus(client, verified2.id, "published")
    expect(published2.status).toBe("published")
    await expect(transitionKnowledgeStatus(client, published2.id, "superseded", 2)).rejects.toThrow(/newer version/)
    const history = await listItemVersions(client, "test-ingest")
    expect(history.map((h) => h.version)).toEqual([2, 1])
  })

  it("rejects unauthorized ingestion and modification", async () => {
    const { client: userClient } = mockClient(USER)
    await expect(ingestKnowledgeItem(userClient, ingestInput())).rejects.toThrow(/administrator/)
    const { client: anonClient } = mockClient(null)
    await expect(ingestKnowledgeItem(anonClient, ingestInput())).rejects.toThrow(/signed in/)
    await expect(transitionKnowledgeStatus(userClient, "some-id", "published")).rejects.toThrow(/administrator/)
  })

  it("rejects forged user_metadata self-promotion", async () => {
    const { client: forgedClient } = mockClient(FORGED)
    await expect(ingestKnowledgeItem(forgedClient, ingestInput())).rejects.toThrow(/administrator/)
    await expect(transitionKnowledgeStatus(forgedClient, "some-id", "published")).rejects.toThrow(/administrator/)
  })
})

describe("knowledge reads", () => {
  it("lists published items and skips malformed rows", async () => {
    const good = {
      id: "good-1", item_key: "k1", version: 1, title: "Good", kind: "market_practice",
      authority: "market_practice", jurisdiction_scope: "global", jurisdiction_code: null,
      source_name: "s", source_reference: "r", source_authority: "a", retrieved_at: "2026-01-01T00:00:00.000Z",
      publisher: null, original_uri: null, checksum: null, effective_from: "2020-01-01", effective_to: null,
      status: "published", content: "synthetic", applicability: {}, superseded_by_version: null,
      created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z",
    }
    const { client } = mockClient(ADMIN, [
      good,
      { ...good, id: "draft-1", item_key: "k2", status: "draft" },
      { ...good, id: "bad-1", item_key: "k3", kind: "not_a_kind" },
    ])
    const items = await fetchPublishedKnowledge(client)
    // fetchPublishedKnowledge filters by status published in-query; the mock
    // applies .eq filters, so only published rows arrive; malformed skipped.
    expect(items.map((i) => i.id)).toEqual(["good-1"])
  })

  it("returns [] when the store is unreachable instead of throwing", async () => {
    const broken = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: ADMIN } }) },
      from: () => { throw new Error("relation does not exist") },
    } as unknown as KnowledgeStoreClient
    await expect(fetchPublishedKnowledge(broken)).resolves.toEqual([])
  })
})

describe("knowledge migration (static, not a live check)", () => {
  const sql = readFileSync(join(process.cwd(), "supabase", "migrations", "00022_knowledge_items.sql"), "utf8")

  it("enables RLS with published-read, admin-read, and admin-write policies", () => {
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/)
    expect(sql).toMatch(/Published knowledge is publicly readable/)
    expect(sql).toMatch(/Admins can read all knowledge/)
    expect(sql).toMatch(/Admins can insert knowledge/)
    expect(sql).toMatch(/Admins can update knowledge/)
  })

  it("exposes no public write path and keeps drafts out of the public policy", () => {
    const publicRead = sql.match(/Published knowledge is publicly readable"[\s\S]*?USING \(status = 'published'\);/)
    expect(publicRead).not.toBeNull()
    // Draft visibility appears only inside the admin policy.
    const draftMentions = (sql.match(/draft/g) ?? []).length
    expect(draftMentions).toBeGreaterThan(0)
    expect(sql).not.toMatch(/FOR INSERT[\s\S]*?USING \(true\)/)
    expect(sql).not.toMatch(/FOR UPDATE[\s\S]*?USING \(true\)/)
  })

  it("constrains versions, dates, and supersede linkage", () => {
    expect(sql).toMatch(/UNIQUE \(item_key, version\)/)
    expect(sql).toMatch(/effective_to >= effective_from/)
    expect(sql).toMatch(/superseded_by_version/)
  })
})
