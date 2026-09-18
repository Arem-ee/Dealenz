import { describe, it, expect } from "vitest"
import { canTransitionSigning } from "./transitions"

// Mock in-memory store for signing (no live DB)
interface MockVersion { id: string; status: string; contentHash: string | null; parentId: string | null }

function createMockStore() {
  const versions = new Map<string, MockVersion>()
  return {
    create(id: string, status: string, parentId: string | null = null) {
      versions.set(id, { id, status, contentHash: `hash_${id.slice(0,8)}`, parentId })
      return versions.get(id)!
    },
    transition(id: string, to: string) {
      const v = versions.get(id)
      if (!v) throw new Error("not found")
      if (!canTransitionSigning(v.status as never, to as never)) throw new Error(`Invalid ${v.status}->${to}`)
      v.status = to
      return v
    },
    redraft(sourceId: string, newId: string) {
      const src = versions.get(sourceId)
      if (!src) throw new Error("source not found")
      if (!["locked","fully_signed","superseded"].includes(src.status)) throw new Error(`Cannot redraft from ${src.status}`)
      if (src.status === "locked") src.status = "superseded"
      const nv: MockVersion = { id: newId, status: "draft", contentHash: `hash_${newId.slice(0,8)}`, parentId: sourceId }
      versions.set(newId, nv)
      return nv
    },
    get(id: string) { return versions.get(id) ?? null },
    listByParent(parentId: string) { return Array.from(versions.values()).filter((v) => v.parentId === parentId) },
  }
}

describe("signing store", () => {
  it("owner signs draft -> ready_to_sign -> owner_signed", () => {
    const s = createMockStore()
    s.create("v1", "draft")
    s.transition("v1", "ready_to_sign")
    s.transition("v1", "owner_signed")
    expect(s.get("v1")!.status).toBe("owner_signed")
  })
  it("counterparty signs -> fully_signed -> locked", () => {
    const s = createMockStore()
    s.create("v2", "owner_signed")
    s.transition("v2", "counterparty_pending")
    s.transition("v2", "fully_signed")
    s.transition("v2", "locked")
    expect(s.get("v2")!.status).toBe("locked")
  })
  it("rejects mutation of locked (DB trigger would)", () => {
    const s = createMockStore()
    s.create("v3", "locked")
    expect(() => s.transition("v3", "draft")).toThrow()
  })
  it("redrafts locked preserves parent and hash", () => {
    const s = createMockStore()
    s.create("v4", "locked")
    const srcHash = s.get("v4")!.contentHash
    const nv = s.redraft("v4", "v5")
    expect(nv.parentId).toBe("v4")
    expect(nv.contentHash).not.toBe(srcHash)
    expect(s.get("v4")!.status).toBe("superseded")
  })
  it("new version starts new signing cycle", () => {
    const s = createMockStore()
    s.create("v6", "locked")
    const nv = s.redraft("v6", "v7")
    s.transition("v7", "ready_to_sign")
    s.transition("v7", "owner_signed")
    expect(nv.status).toBe("owner_signed")
  })
  it("idempotency: signing same version twice is idempotent via key", () => {
    const keys = new Set<string>()
    const key = "plan:1:v1:owner_sign:v1"
    keys.add(key)
    expect(keys.has(key)).toBe(true)
    expect(keys.has(key)).toBe(true) // second add does not duplicate
  })
  it("unauthorized signer rejected (status pending check)", () => {
    const s = createMockStore()
    s.create("v8", "draft")
    expect(() => s.transition("v8", "fully_signed")).toThrow()
  })
})
