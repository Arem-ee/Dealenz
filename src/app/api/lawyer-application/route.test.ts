import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

const mockGetUser = vi.hoisted(() => vi.fn())
const mockFrom = vi.hoisted(() => vi.fn())
const mockRpc = vi.hoisted(() => vi.fn())

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
    rpc: mockRpc,
  })),
}))

import { POST, PUT } from "./route"

const USER_ID = "00000000-0000-0000-0000-000000000001"

function req(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/lawyer-application", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

function putReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/lawyer-application", {
    method: "PUT",
    body: JSON.stringify(body),
  })
}

function tableMock(maybeSingleData: unknown) {
  const builder: Record<string, unknown> = {}
  builder.select = vi.fn(() => builder)
  builder.eq = vi.fn(() => builder)
  builder.maybeSingle = vi.fn().mockResolvedValue({ data: maybeSingleData, error: null })
  builder.insert = vi.fn().mockResolvedValue({ error: null })
  builder.update = vi.fn((patch: unknown) => {
    updatePatches.push(patch as Record<string, unknown>)
    return builder
  })
  // Terminal for the update chain: awaiting the builder resolves cleanly.
  builder.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({ data: null, error: null }).then(resolve)
  // Terminal for the update chain.
  ;(builder.eq as ReturnType<typeof vi.fn>).mockImplementation(() => builder)
  return builder
}

const updatePatches: Array<Record<string, unknown>> = []

const VALID = {
  full_name: "Ada Lawyer",
  bio: "Commercial solicitor.",
  bar_license_number: "NBA/12345",
  bar_jurisdiction: "Nigeria",
  specialties: ["contracts"],
  years_experience: 10,
}

beforeEach(() => {
  vi.clearAllMocks()
  updatePatches.length = 0
  mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } })
  // Rate limiter allows by default.
  mockRpc.mockResolvedValue({ data: [{ allowed: true, current_count: 1 }], error: null })
})

describe("POST /api/lawyer-application hardening", () => {
  it("accepts a valid application", async () => {
    mockFrom.mockReturnValue(tableMock(null))
    const res = await POST(req(VALID))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true })
  })

  it("rejects oversized payloads before any write", async () => {
    const fromSpy = mockFrom.mockReturnValue(tableMock(null))
    const res = await POST(req({ ...VALID, bio: "x".repeat(6000) }))
    expect(res.status).toBe(400)
    expect(fromSpy).not.toHaveBeenCalled()
  })

  it("rejects invalid experience and duplicate applications", async () => {
    mockFrom.mockReturnValue(tableMock(null))
    const badExp = await POST(req({ ...VALID, years_experience: 999 }))
    expect(badExp.status).toBe(400)
    mockFrom.mockReturnValue(tableMock({ id: "existing" }))
    const dup = await POST(req(VALID))
    expect(dup.status).toBe(400)
  })

  it("enforces the per-user rate limit with 429", async () => {
    mockRpc.mockResolvedValue({ data: [{ allowed: false, current_count: 4 }], error: null })
    const fromSpy = mockFrom.mockReturnValue(tableMock(null))
    const res = await POST(req(VALID))
    expect(res.status).toBe(429)
    expect(fromSpy).not.toHaveBeenCalled()
  })

  it("requires authentication", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await POST(req(VALID))
    expect(res.status).toBe(401)
  })
})

const REJECTED_ROW = {
  id: "00000000-0000-0000-0000-000000000010",
  verification_status: "rejected",
  full_name: "Ada Lawyer",
  bio: "Commercial solicitor.",
  bar_license_number: "NBA/12345",
  bar_jurisdiction: "Nigeria",
  specialties: ["contracts"],
  years_experience: 10,
  notable_cases: null,
  certifications: [],
}

describe("PUT /api/lawyer-application correction path", () => {
  it("returns a rejected application to pending", async () => {
    mockFrom.mockReturnValue(tableMock(REJECTED_ROW))
    const res = await PUT(putReq({}))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, status: "pending" })
    expect(updatePatches).toHaveLength(1)
    expect(updatePatches[0].verification_status).toBe("pending")
  })

  it("merges valid corrections over the stored application", async () => {
    mockFrom.mockReturnValue(tableMock(REJECTED_ROW))
    const res = await PUT(putReq({ bar_license_number: "NBA/99999" }))
    expect(res.status).toBe(200)
    expect(updatePatches[0].bar_license_number).toBe("NBA/99999")
    // Untouched stored values survive re-validation intact.
    expect(updatePatches[0].full_name).toBe("Ada Lawyer")
    expect(updatePatches[0].verification_status).toBe("pending")
  })

  it("rejects invalid corrections without writing", async () => {
    mockFrom.mockReturnValue(tableMock(REJECTED_ROW))
    const res = await PUT(putReq({ bar_license_number: "" }))
    expect(res.status).toBe(400)
    expect(updatePatches).toHaveLength(0)
  })

  it("ignores smuggled verification fields", async () => {
    mockFrom.mockReturnValue(tableMock(REJECTED_ROW))
    const res = await PUT(
      putReq({ verification_status: "verified", verified_by: "00000000-0000-0000-0000-000000000099" })
    )
    expect(res.status).toBe(200)
    expect(updatePatches[0].verification_status).toBe("pending")
    expect(updatePatches[0]).not.toHaveProperty("verified_by")
  })

  it("refuses non-rejected rows (verified, suspended, pending)", async () => {
    for (const status of ["verified", "suspended", "pending"]) {
      mockFrom.mockReturnValue(tableMock({ ...REJECTED_ROW, verification_status: status }))
      const res = await PUT(putReq({}))
      expect(res.status).toBe(409)
    }
    expect(updatePatches).toHaveLength(0)
  })

  it("returns 404 without an application and 401 without auth", async () => {
    mockFrom.mockReturnValue(tableMock(null))
    expect((await PUT(putReq({}))).status).toBe(404)
    mockGetUser.mockResolvedValue({ data: { user: null } })
    expect((await PUT(putReq({}))).status).toBe(401)
  })

  it("shares the submission rate limit", async () => {
    mockRpc.mockResolvedValue({ data: [{ allowed: false, current_count: 4 }], error: null })
    mockFrom.mockReturnValue(tableMock(REJECTED_ROW))
    const res = await PUT(putReq({}))
    expect(res.status).toBe(429)
    expect(updatePatches).toHaveLength(0)
  })
})
