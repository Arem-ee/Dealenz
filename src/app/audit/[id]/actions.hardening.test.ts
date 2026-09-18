/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from "vitest"

const mockGetUser = vi.hoisted(() => vi.fn())
const mockFrom = vi.hoisted(() => vi.fn())

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
    rpc: vi.fn(),
    storage: { from: vi.fn(() => ({ download: vi.fn() })) },
  })),
}))

import { updateAudit } from "./actions"

const mockUser = { id: "00000000-0000-0000-0000-000000000001", email: "test@test.com", email_confirmed_at: "2024-01-01" }

function qb() {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve({ data: { status: "draft", title: "Old" }, error: null })),
    update: vi.fn(() => chain),
    insert: vi.fn(() => Promise.resolve({ error: null })),
    then: (resolve: (v: unknown) => unknown) => resolve({ data: null, error: null }),
  } as unknown as { select: ReturnType<typeof vi.fn>; eq: ReturnType<typeof vi.fn>; single: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn>; insert: ReturnType<typeof vi.fn>; then: (r: unknown) => unknown }
  return chain as never
}

describe("updateAudit hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })
  })

  it("strips server-derived intelligence keys from structured_data", async () => {
    let capturedUpdate: Record<string, unknown> | null = null
    const builder = qb()
    const origUpdate = builder.update
    builder.update = vi.fn((payload: Record<string, unknown>) => {
      capturedUpdate = payload
      return builder as never
    })
    // Need to mock from to return builder that captures update
    mockFrom.mockImplementation(() => builder as never)
    // Mock single for oldStatus
    builder.single = vi.fn(() => Promise.resolve({ data: { status: "draft", title: "Old" }, error: null })) as never

    await updateAudit("00000000-0000-0000-0000-000000000001", {
      structured_data: {
        project_type: "web",
        budget: "5000",
        deterministicFindings: [{ ruleKey: "fake", status: "FAIL" }],
        extractedData: { goals: [] },
        negotiationPoints: ["fake"],
        genericRiskDegraded: true,
        generatedDocuments: [],
      } as unknown as Record<string, unknown>,
    })

    expect(capturedUpdate).not.toBeNull()
    const sd = (capturedUpdate as Record<string, unknown>).structured_data as Record<string, unknown>
    expect(sd.project_type).toBe("web")
    expect(sd.budget).toBe("5000")
    expect(sd.deterministicFindings).toBeUndefined()
    expect(sd.extractedData).toBeUndefined()
    expect(sd.negotiationPoints).toBeUndefined()
    expect(sd.genericRiskDegraded).toBeUndefined()
    expect(sd.generatedDocuments).toBeUndefined()
  })

  it("allows normal form fields through", async () => {
    let capturedUpdate: Record<string, unknown> | null = null
    const builder = qb()
    builder.update = vi.fn((payload: Record<string, unknown>) => {
      capturedUpdate = payload
      return builder as never
    })
    builder.single = vi.fn(() => Promise.resolve({ data: { status: "draft", title: "Old" }, error: null })) as never
    mockFrom.mockImplementation(() => builder as never)

    await updateAudit("00000000-0000-0000-0000-000000000001", {
      title: "New Title",
      raw_input: "hello",
    })

    expect((capturedUpdate as Record<string, unknown>).title).toBe("New Title")
    expect((capturedUpdate as Record<string, unknown>).raw_input).toBe("hello")
  })
})
