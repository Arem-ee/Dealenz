import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const mockGetUser = vi.hoisted(() => vi.fn())
const mockDeleteChain = vi.hoisted(() => vi.fn())
const mockList = vi.hoisted(() => vi.fn())
const mockRemove = vi.hoisted(() => vi.fn())

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: vi.fn(() => ({ delete: mockDeleteChain })),
    storage: { from: vi.fn(() => ({ list: mockList, remove: mockRemove })) },
  })),
}))

import { POST } from "./route"

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "development")
})

afterEach(() => {
  vi.unstubAllEnvs()
})

const USER_ID = "00000000-0000-0000-0000-000000000001"

function deleteOk(ids: Array<{ id: string }>) {
  const chain: Record<string, unknown> = {}
  chain.eq = vi.fn(() => chain)
  chain.in = vi.fn(() => chain)
  chain.not = vi.fn(() => chain)
  chain.lt = vi.fn(() => chain)
  chain.select = vi.fn(() => Promise.resolve({ data: ids, error: null }))
  mockDeleteChain.mockReturnValue(chain)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } })
})

describe("POST /api/clear-dev-data storage lifecycle", () => {
  it("removes storage objects for deleted audits (no orphans)", async () => {
    deleteOk([{ id: "audit-1" }, { id: "audit-2" }])
    mockList.mockImplementation((prefix: string) =>
      Promise.resolve({ data: [{ name: "contract.pdf" }], error: null, prefix })
    )
    mockRemove.mockResolvedValue({ error: null })
    const res = await POST()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, deleted: 2, storageErrors: 0 })
    expect(mockList).toHaveBeenCalledTimes(2)
    expect(mockRemove).toHaveBeenCalledWith([`${USER_ID}/audit-1/contract.pdf`])
  })

  it("row cleanup succeeds even when storage removal fails", async () => {
    deleteOk([{ id: "audit-1" }])
    mockList.mockResolvedValue({ data: [{ name: "a.pdf" }], error: null })
    mockRemove.mockResolvedValue({ error: { message: "storage down" } })
    const res = await POST()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, deleted: 1, storageErrors: 1 })
  })

  it("requires authentication", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await POST()
    expect(res.status).toBe(401)
  })
})
