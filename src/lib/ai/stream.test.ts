import { describe, it, expect, vi, afterEach } from "vitest"
import { streamChatContent } from "./stream"

const REAL_FETCH = globalThis.fetch

afterEach(() => {
  globalThis.fetch = REAL_FETCH
  vi.unstubAllGlobals()
})

function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  })
  return new Response(stream, { status: 200, headers: { "Content-Type": "text/event-stream" } })
}

describe("streamChatContent — OpenAI-compatible", () => {
  it("assembles deltas across arbitrary byte splits", async () => {
    // Split mid-JSON to prove the line buffer reassembles partial events.
    const full = 'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\ndata: {"choices":[{"delta":{"content":" world"}}]}\n\ndata: [DONE]\n\n'
    const mid = Math.floor(full.length / 2)
    globalThis.fetch = vi.fn(async () => sseResponse([full.slice(0, mid), full.slice(mid)]))
    const seen: string[] = []
    const result = await streamChatContent(
      { url: "https://example.invalid/v1", headers: {}, body: {}, provider: "openai_compatible" },
      (delta) => seen.push(delta)
    )
    expect(result.text).toBe("Hello world")
    expect(seen.join("")).toBe("Hello world")
  })

  it("captures usage from the terminal chunk", async () => {
    globalThis.fetch = vi.fn(async () =>
      sseResponse([
        'data: {"choices":[{"delta":{"content":"Hi"}}]}\n\ndata: {"choices":[{"delta":{}}],"usage":{"prompt_tokens":12,"completion_tokens":3}}\n\ndata: [DONE]\n\n',
      ])
    )
    const result = await streamChatContent(
      { url: "https://example.invalid/v1", headers: {}, body: {}, provider: "openai_compatible" },
      () => undefined
    )
    expect(result.usage).toEqual({ inputTokens: 12, outputTokens: 3 })
  })

  it("rejects empty streams and non-2xx status", async () => {
    globalThis.fetch = vi.fn(async () => sseResponse(['data: {"choices":[{"delta":{}}]}\n\ndata: [DONE]\n\n']))
    await expect(
      streamChatContent({ url: "https://example.invalid/v1", headers: {}, body: {}, provider: "openai_compatible" }, () => undefined)
    ).rejects.toThrow(/empty response/)
    globalThis.fetch = vi.fn(async () => new Response("nope", { status: 429 }))
    await expect(
      streamChatContent({ url: "https://example.invalid/v1", headers: {}, body: {}, provider: "openai_compatible" }, () => undefined)
    ).rejects.toThrow(/429/)
  })
})

describe("streamChatContent — Anthropic", () => {
  it("assembles text deltas and merges usage across events", async () => {
    globalThis.fetch = vi.fn(async () =>
      sseResponse([
        'event: message_start\ndata: {"type":"message_start","usage":{"input_tokens":40,"output_tokens":0}}\n\n',
        'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello "}}\n\n',
        'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"there"}}\n\n',
        'event: message_delta\ndata: {"type":"message_delta","usage":{"output_tokens":7}}\n\nevent: message_stop\ndata: {"type":"message_stop"}\n\n',
      ])
    )
    const seen: string[] = []
    const result = await streamChatContent(
      { url: "https://example.invalid/v1", headers: {}, body: {}, provider: "anthropic" },
      (delta) => seen.push(delta)
    )
    expect(result.text).toBe("Hello there")
    expect(seen.join("")).toBe("Hello there")
    expect(result.usage).toEqual({ inputTokens: 40, outputTokens: 7 })
  })
})
