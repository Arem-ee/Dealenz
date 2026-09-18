import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { callAnthropicProvider } from "./providers/anthropic"
import { AIProviderError } from "./errors"

const SENTINEL_KEY = "sk-ant-SENTINEL-KEY-9f8e7d6c5b"

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function anthropicOk(text: string): Response {
  return jsonResponse(200, {
    id: "msg_test",
    type: "message",
    role: "assistant",
    content: [{ type: "text", text }],
    stop_reason: "end_turn",
    usage: { input_tokens: 10, output_tokens: 5 },
  })
}

const fetchMock = vi.fn()
const AI_ENV_KEYS = [
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_BASE_URL",
  "AUTH_AI_PROVIDER",
  "AUTH_AI_MODEL",
  "AUTH_AI_FALLBACK_MODEL",
  "AI_PROVIDER",
  "AI_API_KEY",
  "AI_BASE_URL",
  "AI_MODEL",
  "GEMINI_API_KEY",
  "GEMINI_MODEL",
]

function clearAIEnv() {
  for (const key of AI_ENV_KEYS) vi.stubEnv(key, undefined)
}

beforeEach(() => {
  clearAIEnv()
  fetchMock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
  vi.stubEnv("ANTHROPIC_API_KEY", SENTINEL_KEY)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe("callAnthropicProvider", () => {
  it("performs a successful primary call against the Messages API contract", async () => {
    fetchMock.mockResolvedValueOnce(anthropicOk("  hello world  "))

    const { text } = await callAnthropicProvider({
      systemPrompt: "sys",
      userContent: "user",
      model: "claude-sonnet-5",
    })

    expect(text).toBe("hello world")
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("https://api.anthropic.com/v1/messages")
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe(SENTINEL_KEY)
    expect((init.headers as Record<string, string>)["anthropic-version"]).toBe("2023-06-01")
    const body = JSON.parse(init.body as string) as Record<string, unknown>
    expect(body.model).toBe("claude-sonnet-5")
    expect(body.system).toEqual([{ type: "text", text: "sys", cache_control: { type: "ephemeral" } }])
    expect((init.headers as Record<string, string>)["anthropic-beta"]).toBe("prompt-caching-2024-07-31")
    expect(body.messages).toEqual([{ role: "user", content: "user" }])
    expect(typeof body.max_tokens).toBe("number")
  })

  it("passes structured JSON response text through verbatim for upstream validation", async () => {
    const payload = '{"goals":["a"],"confidence":0.9}'
    fetchMock.mockResolvedValueOnce(anthropicOk(payload))

    const { text } = await callAnthropicProvider({ systemPrompt: "s", userContent: "u" })
    expect(text).toBe(payload)
    expect(() => JSON.parse(text)).not.toThrow()
  })

  it("joins multiple text blocks and ignores non-text blocks", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        content: [
          { type: "text", text: "part-one " },
          { type: "tool_use", id: "x", name: "y", input: {} },
          { type: "text", text: "part-two" },
        ],
        stop_reason: "end_turn",
      })
    )

    const { text } = await callAnthropicProvider({ systemPrompt: "s", userContent: "u" })
    expect(text).toBe("part-one part-two")
  })

  it("rejects malformed responses instead of returning valid-looking data", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { content: [] }))

    const err = await callAnthropicProvider({ systemPrompt: "s", userContent: "u" }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(AIProviderError)
    expect((err as AIProviderError).category).toBe("malformed_response")
  })

  it("maps authentication failures and keeps the key out of the error", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { error: { type: "authentication_error" } }))

    const err = await callAnthropicProvider({ systemPrompt: "s", userContent: "u" }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(AIProviderError)
    expect((err as AIProviderError).category).toBe("auth")
    expect((err as AIProviderError).status).toBe(401)
    expect(String(err)).not.toContain(SENTINEL_KEY)
  })

  it("maps server failures as retryable provider errors", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(500, { error: { type: "api_error" } }))

    const err = await callAnthropicProvider({ systemPrompt: "s", userContent: "u" }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(AIProviderError)
    expect((err as AIProviderError).category).toBe("provider")
  })

  it("maps transport failures as network errors", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"))

    const err = await callAnthropicProvider({ systemPrompt: "s", userContent: "u" }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(AIProviderError)
    expect((err as AIProviderError).category).toBe("network")
    expect(String(err)).not.toContain(SENTINEL_KEY)
  })

  it("reports measured token usage without fabricating it", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        content: [{ type: "text", text: "hi" }],
        usage: { input_tokens: 120, output_tokens: 8 },
      })
    )
    const withUsage = await callAnthropicProvider({ systemPrompt: "s", userContent: "u" })
    expect(withUsage.text).toBe("hi")
    expect(withUsage.usage).toEqual({ inputTokens: 120, outputTokens: 8 })

    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { content: [{ type: "text", text: "no usage here" }] })
    )
    const withoutUsage = await callAnthropicProvider({ systemPrompt: "s", userContent: "u" })
    expect(withoutUsage.text).toBe("no usage here")
    expect(withoutUsage.usage).toBeUndefined()
  })

  it("raises a configuration error when the key is missing", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", undefined)

    const err = await callAnthropicProvider({ systemPrompt: "s", userContent: "u" }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(AIProviderError)
    expect((err as AIProviderError).category).toBe("config")
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
