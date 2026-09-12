import { describe, it, expect, vi, beforeEach } from "vitest"

const mockRpc = vi.hoisted(() => vi.fn())
const mockNotFound = vi.hoisted(() => vi.fn(() => { throw new Error("__NOT_FOUND__") }))

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({ rpc: mockRpc })),
}))

vi.mock("next/headers", () => ({
  headers: vi.fn(() => Promise.resolve(new Headers({ "x-real-ip": "203.0.113.11" }))),
}))

vi.mock("next/navigation", () => ({
  notFound: () => mockNotFound(),
}))

vi.mock("@/components/portal-view", () => ({
  PortalView: ({ document }: { document: unknown }) => ({ stub: "portal-view", document }),
}))

import ViewPage from "./page"

const DOC = { content: "doc", audit_id: "a", document_type: "contract", business_name: "", signed: false }

function rpcAllowThenRows(rows: unknown[]) {
  mockRpc.mockImplementation((fn: string) => {
    if (fn === "check_anonymous_rate_limit") {
      return Promise.resolve({ data: [{ allowed: true, current_count: 1 }], error: null })
    }
    return Promise.resolve({ data: rows, error: null })
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("share view throttle", () => {
  it("serves a valid token and queries the limiter first", async () => {
    rpcAllowThenRows([DOC])
    const out = (await ViewPage({ params: Promise.resolve({ token: "00000000-0000-0000-0000-000000000001" }) })) as unknown as {
      props: { document: unknown; token: string }
    }
    // Server component returns a <PortalView> element carrying the document.
    expect(out.props.document).toEqual(DOC)
    expect(out.props.token).toBe("00000000-0000-0000-0000-000000000001")
    expect(mockRpc).toHaveBeenCalledWith("check_anonymous_rate_limit", {
      p_key: "shareview:203.0.113.11",
      p_limit: 60,
      p_window_seconds: 3600,
    })
    expect(mockRpc).toHaveBeenCalledWith("get_shared_document", {
      p_token: "00000000-0000-0000-0000-000000000001",
    })
  })

  it("renders not-found when the throttle denies (no oracle)", async () => {
    mockRpc.mockImplementation((fn: string) => {
      if (fn === "check_anonymous_rate_limit") {
        return Promise.resolve({ data: [{ allowed: false, current_count: 61 }], error: null })
      }
      return Promise.resolve({ data: [DOC], error: null })
    })
    await expect(
      ViewPage({ params: Promise.resolve({ token: "00000000-0000-0000-0000-000000000001" }) })
    ).rejects.toThrow("__NOT_FOUND__")
    expect(mockNotFound).toHaveBeenCalled()
  })

  it("renders not-found for unknown tokens", async () => {
    rpcAllowThenRows([])
    await expect(
      ViewPage({ params: Promise.resolve({ token: "00000000-0000-0000-0000-000000000099" }) })
    ).rejects.toThrow("__NOT_FOUND__")
  })
})
