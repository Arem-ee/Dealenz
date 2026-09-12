import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const mockFrom = vi.hoisted(() => vi.fn())
const mockServiceFrom = vi.hoisted(() => vi.fn())

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({ from: mockFrom })),
}))

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ from: mockServiceFrom })),
}))

import { GET } from "./route"

function selectChain(result: { data: unknown; error: { message: string } | null }) {
  const chain: Record<string, unknown> = {}
  chain.select = vi.fn(() => chain)
  chain.eq = vi.fn(() => chain)
  chain.in = vi.fn(() => chain)
  chain.gte = vi.fn(() => chain)
  chain.limit = vi.fn(() => Promise.resolve(result))
  return chain
}

const OLD_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const OLD_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const OLD_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

beforeEach(() => {
  vi.clearAllMocks()
  // The route honestly reports down when required config is absent.
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co"
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "ci-dummy-anon-key"
})

afterEach(() => {
  if (OLD_URL === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL
  else process.env.NEXT_PUBLIC_SUPABASE_URL = OLD_URL
  if (OLD_ANON === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = OLD_ANON
  if (OLD_SERVICE_KEY === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY
  else process.env.SUPABASE_SERVICE_ROLE_KEY = OLD_SERVICE_KEY
})

describe("GET /api/health", () => {
  it("reports ok when the database answers and no spike query is possible", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    mockFrom.mockReturnValue(selectChain({ data: [], error: null }))
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe("ok")
    expect(body.checks).toMatchObject({ app: "ok", database: "ok", ai: "unknown" })
    expect(body).not.toHaveProperty("aiFallbacksLastHour")
  })

  it("reports down with 503 when the database is unreachable", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    mockFrom.mockReturnValue(selectChain({ data: null, error: { message: "connection refused" } }))
    const res = await GET()
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.status).toBe("down")
    expect(body.checks.database).toBe("unavailable")
  })

  it("reports degraded when fallback volume spikes", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co"
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key"
    mockFrom.mockReturnValue(selectChain({ data: [], error: null }))
    mockServiceFrom.mockReturnValue(selectChain({ data: new Array(15).fill({ id: "x" }), error: null }))
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe("degraded")
    expect(body.checks.ai).toBe("degraded")
    expect(body.aiFallbacksLastHour).toBe(15)
  })

  it("reports down when required configuration is absent", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    mockFrom.mockReturnValue(selectChain({ data: [], error: null }))
    const res = await GET()
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.status).toBe("down")
  })

  it("never exposes env values", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    mockFrom.mockReturnValue(selectChain({ data: [], error: null }))
    const res = await GET()
    const text = await res.text()
    expect(text).not.toContain("test-service-key")
    expect(text).not.toContain("service-role")
  })
})
