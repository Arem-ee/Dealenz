import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { callOpenAICompatible } from "./openai-compatible"
import { AIProviderError } from "../errors"

const fetchMock = vi.fn()

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function okChoices(text = "hi") {
  return jsonResponse(200, { choices: [{ message: { content: text } }] })
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
  vi.stubEnv("AI_API_KEY", "ci-dummy-key")
  vi.stubEnv("AI_BASE_URL", "https://example.invalid/v1")
  vi.stubEnv("AI_MODEL", "ci-dummy-model")
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://dealenz.site")
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe("openai-compatible failure categories", () => {
  it("maps 401/403 to auth", async () => {
    for (const status of [401, 403]) {
      fetchMock.mockResolvedValueOnce(jsonResponse(status, { error: { message: "bad key" } }))
      const err = await callOpenAICompatible({ systemPrompt: "s", userContent: "u" }).catch((e) => e)
      expect(err).toBeInstanceOf(AIProviderError)
      expect(err.category).toBe("auth")
      expect(err.status).toBe(status)
      expect(String(err.message)).toMatch(/AI_API_KEY/)
    }
  })

  it("maps unknown-model 404 to invalid_request with model guidance", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(404, { error: { message: "No endpoints found" } }))
    const err = await callOpenAICompatible({ systemPrompt: "s", userContent: "u" }).catch((e) => e)
    expect(err).toBeInstanceOf(AIProviderError)
    expect(err.category).toBe("invalid_request")
    expect(String(err.message)).toMatch(/AI_MODEL/)
  })

  it("maps 429 to rate_limit and 5xx to provider", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(429, { error: { message: "slow down" } }))
    const e429 = await callOpenAICompatible({ systemPrompt: "s", userContent: "u" }).catch((e) => e)
    expect(e429.category).toBe("rate_limit")
    fetchMock.mockResolvedValueOnce(jsonResponse(500, { error: { message: "boom" } }))
    const e500 = await callOpenAICompatible({ systemPrompt: "s", userContent: "u" }).catch((e) => e)
    expect(e500.category).toBe("provider")
    expect(e500.status).toBe(500)
  })

  it("maps aborts to timeout and connection failures to network", async () => {
    fetchMock.mockImplementationOnce(() => {
      const err = new Error("aborted")
      err.name = "AbortError"
      return Promise.reject(err)
    })
    const eTimeout = await callOpenAICompatible({ systemPrompt: "s", userContent: "u" }).catch((e) => e)
    expect(eTimeout.category).toBe("timeout")
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"))
    const eNet = await callOpenAICompatible({ systemPrompt: "s", userContent: "u" }).catch((e) => e)
    expect(eNet.category).toBe("network")
  })
})

describe("openai-compatible OpenRouter behavior", () => {
  it("sends attribution headers only to OpenRouter", async () => {
    vi.stubEnv("AI_BASE_URL", "https://openrouter.ai/api/v1")
    fetchMock.mockResolvedValueOnce(okChoices())
    await callOpenAICompatible({ systemPrompt: "s", userContent: "u" })
    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>
    expect(headers["HTTP-Referer"]).toBe("https://dealenz.site")
    expect(headers["X-Title"]).toBe("Dealenz")

    fetchMock.mockReset()
    vi.stubEnv("AI_BASE_URL", "https://example.invalid/v1")
    fetchMock.mockResolvedValueOnce(okChoices())
    await callOpenAICompatible({ systemPrompt: "s", userContent: "u" })
    const headers2 = fetchMock.mock.calls[0][1].headers as Record<string, string>
    expect(headers2["HTTP-Referer"]).toBeUndefined()
    expect(headers2["X-Title"]).toBeUndefined()
  })

  it("fails closed when OpenRouter has no explicit model", async () => {
    vi.stubEnv("AI_BASE_URL", "https://openrouter.ai/api/v1")
    vi.stubEnv("AI_MODEL", "")
    const err = await callOpenAICompatible({ systemPrompt: "s", userContent: "u" }).catch((e) => e)
    expect(err).toBeInstanceOf(AIProviderError)
    expect(err.category).toBe("config")
    expect(String(err.message)).toMatch(/AUTH_AI_MODEL/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("uses explicit OpenRouter model ids verbatim", async () => {
    vi.stubEnv("AI_BASE_URL", "https://openrouter.ai/api/v1")
    vi.stubEnv("AI_MODEL", "anthropic/claude-sonnet-5")
    fetchMock.mockResolvedValueOnce(okChoices())
    const result = await callOpenAICompatible({ systemPrompt: "s", userContent: "u" })
    expect(result.text).toBe("hi")
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as { model?: string }
    expect(body.model).toBe("anthropic/claude-sonnet-5")
  })
})
