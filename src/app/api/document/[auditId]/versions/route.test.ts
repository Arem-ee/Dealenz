import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

const mockGetUser = vi.hoisted(() => vi.fn())
const mockCheckRateLimit = vi.hoisted(() => vi.fn())
const mockAuditRow = vi.hoisted(() => ({ value: null as null | { id: string } }))
const mockExistingVersion = vi.hoisted(() => ({ value: null as null | { version_number: number } }))
const mockInsertImpl = vi.hoisted(() => ({ value: null as null | { impl: (row: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> } }))

function builder(table: string): Record<string, unknown> {
  const b: Record<string, unknown> = {}
  b.select = vi.fn(() => b)
  b.eq = vi.fn(() => b)
  b.order = vi.fn(() => b)
  b.limit = vi.fn(() => b)
  b.maybeSingle = vi.fn(() => {
    if (table === "audits") return Promise.resolve({ data: mockAuditRow.value, error: null })
    if (table === "document_versions") return Promise.resolve({ data: mockExistingVersion.value, error: null })
    return Promise.resolve({ data: null, error: null })
  })
  b.single = vi.fn(() => Promise.resolve({ data: { id: "ver_1" }, error: null }))
  b.insert = vi.fn((row: Record<string, unknown>) => {
    if (mockInsertImpl.value) {
      const impl = mockInsertImpl.value.impl
      return { select: vi.fn(() => ({ single: vi.fn(() => impl(row)) })) }
    }
    return { ...b, select: vi.fn(() => ({ single: b.single })) }
  })
  b.update = vi.fn(() => b)
  return b
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: (table: string) => builder(table),
  })),
}))

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}))

import { POST } from "./route"

const USER = { id: "00000000-0000-0000-0000-000000000001", email_confirmed_at: "2024-01-01" }

function req(auditId: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/document/${auditId}/versions`, {
    method: "POST",
    body: JSON.stringify(body),
  })
}

const GOOD = { documentType: "contract", title: "MSA with Acme", content: "This agreement is between..." }

beforeEach(() => {
  vi.clearAllMocks()
  mockGetUser.mockResolvedValue({ data: { user: USER } })
  mockCheckRateLimit.mockResolvedValue({ allowed: true })
  mockAuditRow.value = { id: "audit-1" }
  mockExistingVersion.value = null
  mockInsertImpl.value = null
})

describe("POST /api/document/[auditId]/versions", () => {
  it("rejects unauthenticated, unverified, and rate-limited callers", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    expect((await POST(req("audit-1", GOOD), { params: Promise.resolve({ auditId: "audit-1" }) })).status).toBe(401)
    mockGetUser.mockResolvedValue({ data: { user: { ...USER, email_confirmed_at: null } } })
    expect((await POST(req("audit-1", GOOD), { params: Promise.resolve({ auditId: "audit-1" }) })).status).toBe(403)
    mockGetUser.mockResolvedValue({ data: { user: USER } })
    mockCheckRateLimit.mockResolvedValue({ allowed: false, error: "Too many uploads" })
    expect((await POST(req("audit-1", GOOD), { params: Promise.resolve({ auditId: "audit-1" }) })).status).toBe(429)
  })

  it("validates type, content presence, and the 100k cap", async () => {
    const params = { params: Promise.resolve({ auditId: "audit-1" }) }
    expect((await POST(req("audit-1", { ...GOOD, documentType: "spreadsheet" }), params)).status).toBe(400)
    expect((await POST(req("audit-1", { ...GOOD, content: "   " }), params)).status).toBe(400)
    expect((await POST(req("audit-1", { ...GOOD, content: "x".repeat(100_001) }), params)).status).toBe(400)
    expect((await POST(req("audit-1", { ...GOOD, title: "x".repeat(121) }), params)).status).toBe(400)
  })

  it("404s on foreign audits and numbers versions per type", async () => {
    mockAuditRow.value = null
    expect((await POST(req("audit-9", GOOD), { params: Promise.resolve({ auditId: "audit-9" }) })).status).toBe(404)
    mockAuditRow.value = { id: "audit-1" }
    mockExistingVersion.value = { version_number: 2 }
    const res = await POST(req("audit-1", GOOD), { params: Promise.resolve({ auditId: "audit-1" }) })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ success: true, versionId: "ver_1", versionNumber: 3 })
  })

  it("stores uploads as upload-method versions, never AI output", async () => {
    let saved: Record<string, unknown> = {}
    mockInsertImpl.value = {
      impl: async (row: Record<string, unknown>) => {
        saved = row
        return { data: { id: "ver_9" }, error: null }
      },
    }
    // The default single() mock returns ver_1; this test captures the row.
    const res = await POST(req("audit-1", GOOD), { params: Promise.resolve({ auditId: "audit-1" }) })
    expect(res.status).toBe(200)
    expect(saved.generation_method).toBe("upload")
    expect(saved.document_type).toBe("contract")
  })
})
