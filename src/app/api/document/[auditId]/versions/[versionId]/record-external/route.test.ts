import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

const mockGetUser = vi.hoisted(() => vi.fn())
const mockCheckRateLimit = vi.hoisted(() => vi.fn())
const mockAuditRow = vi.hoisted(() => ({ value: null as null | { id: string } }))
const mockVersionRow = vi.hoisted(() => ({ value: null as null | { id: string; status: string | null; metadata: Record<string, unknown> | null } }))
const mockUpdateImpl = vi.hoisted(() => ({ value: null as null | { impl: (row: Record<string, unknown>) => void } }))

function userBuilder(table: string): Record<string, unknown> {
  const b: Record<string, unknown> = {}
  b.select = vi.fn(() => b)
  b.eq = vi.fn(() => b)
  b.maybeSingle = vi.fn(() => {
    if (table === "audits") return Promise.resolve({ data: mockAuditRow.value, error: null })
    return Promise.resolve({ data: null, error: null })
  })
  return b
}

function serviceBuilder(table: string): Record<string, unknown> {
  const b: Record<string, unknown> = {}
  b.select = vi.fn(() => b)
  b.eq = vi.fn(() => b)
  b.maybeSingle = vi.fn(() => {
    if (table === "document_versions") return Promise.resolve({ data: mockVersionRow.value, error: null })
    return Promise.resolve({ data: null, error: null })
  })
  b.update = vi.fn((row: Record<string, unknown>) => {
    mockUpdateImpl.value?.impl(row)
    return { eq: vi.fn(() => Promise.resolve({ error: null })) }
  })
  return b
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: (table: string) => userBuilder(table),
  })),
}))

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: (table: string) => serviceBuilder(table),
  })),
}))

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}))

import { POST } from "./route"

const USER = { id: "00000000-0000-0000-0000-000000000001", email_confirmed_at: "2024-01-01" }

function req(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/document/audit-1/versions/ver-1/record-external", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

const params = { params: Promise.resolve({ auditId: "audit-1", versionId: "ver-1" }) }

beforeEach(() => {
  vi.clearAllMocks()
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321"
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key"
  mockGetUser.mockResolvedValue({ data: { user: USER } })
  mockCheckRateLimit.mockResolvedValue({ allowed: true })
  mockAuditRow.value = { id: "audit-1" }
  mockVersionRow.value = { id: "ver-1", status: "draft", metadata: null }
  mockUpdateImpl.value = null
})

describe("POST record-external", () => {
  it("rejects bad, future, and ancient dates", async () => {
    expect((await POST(req({}), params)).status).toBe(400)
    expect((await POST(req({ signedAt: "not-a-date" }), params)).status).toBe(400)
    expect((await POST(req({ signedAt: "2999-01-01" }), params)).status).toBe(400)
    expect((await POST(req({ signedAt: "1985-06-01" }), params)).status).toBe(400)
  })

  it("404s on foreign audits and versions", async () => {
    mockAuditRow.value = null
    expect((await POST(req({ signedAt: "2024-05-01" }), params)).status).toBe(404)
    mockAuditRow.value = { id: "audit-1" }
    mockVersionRow.value = null
    expect((await POST(req({ signedAt: "2024-05-01" }), params)).status).toBe(404)
  })

  it("refuses terminal versions and flags external provenance", async () => {
    mockVersionRow.value = { id: "ver-1", status: "locked", metadata: null }
    expect((await POST(req({ signedAt: "2024-05-01" }), params)).status).toBe(400)
    mockVersionRow.value = { id: "ver-1", status: "draft", metadata: null }
    let saved: Record<string, unknown> = {}
    mockUpdateImpl.value = { impl: (row) => { saved = row } }
    const res = await POST(req({ signedAt: "2024-05-01" }), params)
    expect(res.status).toBe(200)
    expect(saved.status).toBe("fully_signed")
    expect((saved.metadata as Record<string, unknown>).recorded_externally).toBe(true)
    expect(saved.fully_signed_at).toContain("2024-05-01")
  })
})
