import { describe, it, expect, vi } from "vitest"
import { ensureVersionSeal, hashVersionContent } from "./seal"

// Each from() call consumes the next queued step. Read steps terminate at
// maybeSingle; the update step terminates at select (PostgREST shape).
function mockClient(steps: Array<{ data: unknown; terminalSelect?: boolean }>) {
  let n = 0
  return {
    from: (table: string) => {
      if (table !== "document_versions") throw new Error(`unexpected table ${table}`)
      const step = steps[Math.min(n++, steps.length - 1)]!
      const b: Record<string, unknown> = {}
      const chain = () => b
      b.select = vi.fn(() =>
        step.terminalSelect ? Promise.resolve({ data: step.data, error: null }) : chain()
      )
      b.eq = vi.fn(chain)
      b.is = vi.fn(chain)
      b.update = vi.fn(chain)
      b.maybeSingle = vi.fn(() => Promise.resolve({ data: step.data, error: null }))
      return b
    },
  }
}

describe("hashVersionContent", () => {
  it("is deterministic and content-sensitive", () => {
    expect(hashVersionContent("hello")).toBe(hashVersionContent("hello"))
    expect(hashVersionContent("hello")).toMatch(/^[0-9a-f]{64}$/)
    expect(hashVersionContent("hello!")).not.toBe(hashVersionContent("hello"))
  })
})

describe("ensureVersionSeal", () => {
  const input = { auditId: "audit-1", versionId: "ver-1", userId: "user-1" }

  it("returns null for missing or foreign versions", async () => {
    expect(await ensureVersionSeal(mockClient([{ data: null }]) as never, input)).toBeNull()
  })

  it("seals an unsealed version first-writer-wins", async () => {
    const hash = hashVersionContent("contract text")
    const client = mockClient([
      { data: { id: "ver-1", content: "contract text", seal_hash: null, sealed_at: null } },
      { data: [{ seal_hash: hash, sealed_at: "2026-01-01T00:00:00.000Z" }], terminalSelect: true },
    ])
    const seal = await ensureVersionSeal(client as never, input)
    expect(seal).toMatchObject({ hash, tampered: false })
  })

  it("flags content drift as tampered, never resealing", async () => {
    const client = mockClient([
      {
        data: {
          id: "ver-1",
          content: "edited after signing",
          seal_hash: hashVersionContent("original text"),
          sealed_at: "2026-01-01T00:00:00.000Z",
        },
      },
    ])
    const seal = await ensureVersionSeal(client as never, input)
    expect(seal?.tampered).toBe(true)
    expect(seal?.hash).toBe(hashVersionContent("original text"))
  })

  it("reads intact seals without writing", async () => {
    const hash = hashVersionContent("contract text")
    const update = vi.fn()
    const client = {
      from: () => ({
        select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { id: "ver-1", content: "contract text", seal_hash: hash, sealed_at: "2026-01-01" }, error: null }) }) }) }) }),
        update,
      }),
    }
    const seal = await ensureVersionSeal(client as never, input)
    expect(seal).toMatchObject({ hash, tampered: false })
    expect(update).not.toHaveBeenCalled()
  })

  it("takes the reread path when it loses the sealing race", async () => {
    const hash = hashVersionContent("contract text")
    const client = mockClient([
      { data: { id: "ver-1", content: "contract text", seal_hash: null, sealed_at: null } },
      { data: [], terminalSelect: true },
      { data: { seal_hash: hash, sealed_at: "2026-01-02T00:00:00.000Z" } },
    ])
    const seal = await ensureVersionSeal(client as never, input)
    expect(seal).toMatchObject({ hash, tampered: false })
  })
})
