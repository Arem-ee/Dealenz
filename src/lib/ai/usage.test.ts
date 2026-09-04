import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { logAIUsage, toUsageRecord, type AIUsageRecord } from "./usage"
import { callGeminiProvider } from "./providers/gemini"
import { callOpenAICompatible } from "./providers/openai-compatible"

const mockInsert = vi.hoisted(() => vi.fn())

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: () => ({ insert: mockInsert }),
  })),
}))

const fetchMock = vi.fn()

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
  vi.stubEnv("AI_API_KEY", "ci-dummy-key")
  vi.stubEnv("AI_BASE_URL", "https://example.invalid/v1")
  vi.stubEnv("AI_MODEL", "ci-dummy-model")
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe("AI usage records", () => {
  it("logs measurement metadata without prompts, documents, or keys", async () => {
    mockInsert.mockClear()
    mockInsert.mockResolvedValue({ error: null })
    const record = toUsageRecord({
      operation: "conversation",
      provider: "anthropic",
      model: "claude-sonnet-5",
      usage: { inputTokens: 200, outputTokens: 50 },
      status: "success",
    })
    await logAIUsage(record)
    expect(mockInsert).toHaveBeenCalledTimes(1)
    const row = mockInsert.mock.calls[0][0] as Record<string, unknown>
    expect(row.phase).toBe("ai_usage")
    expect(row.status).toBe("success")
    const serialized = JSON.stringify(row)
    expect(serialized).toMatch(/conversation/)
    expect(serialized).toMatch(/in=200 out=50/)
  })

  it("represents input and output tokens with a derived total", () => {
    const record = toUsageRecord({
      operation: "conversation",
      provider: "anthropic",
      model: "claude-sonnet-5",
      usage: { inputTokens: 200, outputTokens: 50 },
      status: "success",
    })
    expect(record.inputTokens).toBe(200)
    expect(record.outputTokens).toBe(50)
    expect(record.totalTokens).toBe(250)
    expect(record.creditsConsumed).toBeNull()
  })

  it("leaves token fields absent when the provider reports nothing", () => {
    const record = toUsageRecord({
      operation: "explanation",
      provider: "gemini",
      model: "gemini-2.0-flash",
      status: "success",
    })
    expect(record.inputTokens).toBeUndefined()
    expect(record.totalTokens).toBeUndefined()
    // Absent is not zero: accounting must distinguish unreported from measured.
    expect(record).not.toHaveProperty("inputTokens", 0)
  })

  it("keeps credit consumption separate from provider tokens", () => {
    const record: AIUsageRecord = {
      operation: "document_analysis",
      provider: "anthropic",
      model: "claude-sonnet-5",
      inputTokens: 5000,
      outputTokens: 1000,
      totalTokens: 6000,
      creditsConsumed: null,
      status: "success",
      createdAt: new Date().toISOString(),
    }
    // Tokens are measured facts; credits are a future policy charge.
    expect(record.totalTokens).toBe(6000)
    expect(record.creditsConsumed).toBeNull()
    expect(record).not.toHaveProperty("balance")
  })

  it("represents failed operations distinctly from successful ones", () => {
    const failed = toUsageRecord({
      operation: "conversation",
      provider: "anthropic",
      model: "claude-sonnet-5",
      status: "provider_failure",
    })
    expect(failed.status).toBe("provider_failure")
    expect(failed.creditsConsumed).toBeNull()
  })
})

describe("provider token reporting", () => {
  it("maps Gemini usageMetadata without fabricating zeros", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        candidates: [{ content: { parts: [{ text: "hi" }] } }],
        usageMetadata: { promptTokenCount: 30, candidatesTokenCount: 4 },
      })
    )
    const result = await callGeminiProvider({ systemPrompt: "s", userContent: "u" })
    expect(result.text).toBe("hi")
    expect(result.usage).toEqual({ inputTokens: 30, outputTokens: 4 })

    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { candidates: [{ content: { parts: [{ text: "hi" }] } }] })
    )
    const unreported = await callGeminiProvider({ systemPrompt: "s", userContent: "u" })
    expect(unreported.usage).toBeUndefined()
  })

  it("maps OpenAI-compatible usage without fabricating zeros", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        choices: [{ message: { content: "hi" } }],
        usage: { prompt_tokens: 44, completion_tokens: 6 },
      })
    )
    const result = await callOpenAICompatible({ systemPrompt: "s", userContent: "u" })
    expect(result.text).toBe("hi")
    expect(result.usage).toEqual({ inputTokens: 44, outputTokens: 6 })
  })
})
