import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { reportError, reportAIFallback, getFallbackSpike, sendOpsAlert } from "./logger"

function dbClient(rows: unknown[] = [], insertError: { message: string } | null = null) {
  const insert = vi.fn(() => Promise.resolve({ error: insertError }))
  const chain: Record<string, unknown> = {}
  chain.select = vi.fn(() => chain)
  chain.in = vi.fn(() => chain)
  chain.gte = vi.fn(() => chain)
  chain.limit = vi.fn(() => Promise.resolve({ data: rows, error: null }))
  chain.insert = insert
  return { from: vi.fn(() => chain), insert }
}

const OLD_ENV = process.env.OPS_ALERT_WEBHOOK

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env.OPS_ALERT_WEBHOOK
})

afterEach(() => {
  if (OLD_ENV === undefined) delete process.env.OPS_ALERT_WEBHOOK
  else process.env.OPS_ALERT_WEBHOOK = OLD_ENV
  vi.unstubAllGlobals()
})

describe("reportError", () => {
  it("writes a sanitized row and never throws", async () => {
    const db = dbClient()
    await reportError(db as never, {
      phase: "billing_webhook",
      error: new Error("card declined for alice@example.com sk_live_abc123"),
      details: { provider: "paddle", step: "ledger_grant", count: 2 },
      severity: "critical",
      userId: "00000000-0000-0000-0000-000000000001",
    })
    expect(db.insert).toHaveBeenCalledTimes(1)
    const calls = db.insert.mock.calls as unknown as Array<[unknown]>
    const row = calls[0]![0] as {
      phase?: unknown
      status?: unknown
      severity?: unknown
      user_id?: unknown
      error_message?: unknown
      metadata?: Record<string, unknown>
    }
    expect(row.phase).toBe("billing_webhook")
    expect(row.status).toBe("failure")
    expect(row.severity).toBe("critical")
    expect(row.user_id).toBe("00000000-0000-0000-0000-000000000001")
    expect(String(row.error_message)).not.toContain("sk_live_abc123")
    expect(String(row.error_message)).not.toContain("alice@")
    expect(row.metadata?.provider).toBe("paddle")
  })

  it("survives a broken client without throwing", async () => {
    const broken = { from: () => { throw new Error("nope") } }
    await expect(
      reportError(broken as never, { phase: "x", severity: "error" })
    ).resolves.toBeUndefined()
  })
})

describe("reportAIFallback", () => {
  it("records fallback-served calls as warn ai_fallback", async () => {
    const db = dbClient()
    await reportAIFallback(db as never, {
      surface: "authenticated",
      provider: "anthropic",
      model: "claude-sonnet-5",
      category: "timeout",
      servedByFallback: true,
    })
    const aiCalls = db.insert.mock.calls as unknown as Array<[unknown]>
    const row = aiCalls[0]![0] as {
      phase?: unknown
      severity?: unknown
      metadata?: Record<string, unknown>
    }
    expect(row.phase).toBe("ai_fallback")
    expect(row.severity).toBe("warn")
    expect(row.metadata).toMatchObject({ surface: "authenticated", provider: "anthropic", category: "timeout", served_by_fallback: true })
  })

  it("records unserved failures as error ai_failure", async () => {
    const db = dbClient()
    await reportAIFallback(db as never, {
      surface: "quick_review",
      provider: "gemini",
      category: "auth",
      servedByFallback: false,
    })
    const failCalls = db.insert.mock.calls as unknown as Array<[unknown]>
    const row = failCalls[0]![0] as { phase?: unknown; severity?: unknown }
    expect(row.phase).toBe("ai_failure")
    expect(row.severity).toBe("error")
  })
})

describe("getFallbackSpike", () => {
  it("counts recent fallback phases and flags spikes", async () => {
    const many = dbClient(new Array(12).fill({ id: "x" }))
    await expect(getFallbackSpike(many as never, 60, 10)).resolves.toEqual({ count: 12, spiking: true })
    const few = dbClient(new Array(3).fill({ id: "x" }))
    await expect(getFallbackSpike(few as never, 60, 10)).resolves.toEqual({ count: 3, spiking: false })
  })

  it("returns unknown-safe zeros on error", async () => {
    const broken = { from: () => { throw new Error("down") } }
    await expect(getFallbackSpike(broken as never)).resolves.toEqual({ count: 0, spiking: false })
  })
})

describe("sendOpsAlert", () => {
  it("returns false without a webhook configured", async () => {
    await expect(sendOpsAlert({ severity: "critical", phase: "x", summary: "y" })).resolves.toBe(false)
  })

  it("posts redacted text to an https webhook", async () => {
    process.env.OPS_ALERT_WEBHOOK = "https://hooks.example.com/abc"
    const fetchMock = vi.fn(() => Promise.resolve({ ok: true }))
    vi.stubGlobal("fetch", fetchMock)
    const sent = await sendOpsAlert({ severity: "error", phase: "billing_webhook", summary: "failed sk_live_abc123" })
    expect(sent).toBe(true)
    const fetchCalls = fetchMock.mock.calls as unknown as Array<[string, { body: string }]>
    const [, opts] = fetchCalls[0]!
    expect(opts.body).toContain("[dealenz:error]")
    expect(opts.body).not.toContain("sk_live_abc123")
  })

  it("refuses non-https webhooks and survives fetch failure", async () => {
    process.env.OPS_ALERT_WEBHOOK = "http://hooks.example.com/abc"
    await expect(sendOpsAlert({ severity: "error", phase: "x", summary: "y" })).resolves.toBe(false)
    process.env.OPS_ALERT_WEBHOOK = "https://hooks.example.com/abc"
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("net down"))))
    await expect(sendOpsAlert({ severity: "error", phase: "x", summary: "y" })).resolves.toBe(false)
  })
})
