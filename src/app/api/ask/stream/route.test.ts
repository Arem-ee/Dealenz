import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

const mockPrepare = vi.hoisted(() => vi.fn())
const mockPersist = vi.hoisted(() => vi.fn())
const mockBuildPorts = vi.hoisted(() => vi.fn())
const mockAnswer = vi.hoisted(() => vi.fn())

vi.mock("@/app/ask/actions", () => ({
  prepareAskTurn: (...args: unknown[]) => mockPrepare(...args),
  persistAskAssistant: (...args: unknown[]) => mockPersist(...args),
  buildAskPorts: (...args: unknown[]) => mockBuildPorts(...args),
}))

vi.mock("@/lib/conversation/request", () => ({
  answerQuestion: (...args: unknown[]) => mockAnswer(...args),
}))

import { POST } from "./route"

function req(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/ask/stream", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

interface StreamPayload {
  type: string
  label?: string
  delta?: string
  response?: Record<string, unknown>
  conversationId?: string
  replaced?: boolean
  error?: string
}

async function readEvents(res: Response): Promise<StreamPayload[]> {
  const text = await res.text()
  return text
    .split("\n\n")
    .filter((block) => block.includes("data:"))
    .map((block) => {
      const line = block.split("\n").find((l) => l.startsWith("data:")) ?? ""
      return JSON.parse(line.slice(5).trim()) as StreamPayload
    })
}

const READY = {
  ready: {
    supabase: {},
    user: { id: "00000000-0000-0000-0000-000000000001" },
    conversation: { id: "conv_1", attached_audit_id: null },
    ledger: {},
    serverHistory: [],
  },
}

const PORTS = {
  loadContext: vi.fn(async () => null),
  loadFacts: vi.fn(async () => null),
  loadKnowledge: vi.fn(async () => []),
}

beforeEach(() => {
  vi.clearAllMocks()
  mockBuildPorts.mockReturnValue(PORTS)
})

describe("POST /api/ask/stream", () => {
  it("streams tokens, persists, and finishes with done", async () => {
    mockPrepare.mockResolvedValue(READY)
    mockAnswer.mockImplementation(async (request: { onToken?: (d: string) => void }) => {
      request.onToken?.("Hello ")
      request.onToken?.("there")
      return { type: "answer", text: "Hello there", operation: "conversation" }
    })
    const res = await POST(req({ text: "What is this?" }))
    expect(res.headers.get("Content-Type")).toContain("text/event-stream")
    const events = await readEvents(res)
    // Turn setup commits first: the started event carries the conversation
    // id so clients resume instead of duplicating on transport failure.
    expect(events[0]).toMatchObject({ type: "started", conversationId: "conv_1" })
    expect(events[1]).toMatchObject({ type: "stage" })
    expect(events.filter((e) => e.type === "token").map((e) => e.delta).join("")).toBe("Hello there")
    const done = events.find((e) => e.type === "done")
    expect(done).toMatchObject({ conversationId: "conv_1", replaced: false })
    expect((done?.response as Record<string, unknown>).text).toBe("Hello there")
    expect(mockPersist).toHaveBeenCalledTimes(1)
  })

  it("emits replaced when the repair path changes streamed text", async () => {
    mockPrepare.mockResolvedValue(READY)
    mockAnswer.mockImplementation(async (request: { onToken?: (d: string) => void }) => {
      request.onToken?.("Was this one question or two questions or three?")
      return { type: "answer", text: "What is the single most important term?", operation: "conversation" }
    })
    const events = await readEvents(await POST(req({ text: "x".repeat(10) })))
    const done = events.find((e) => e.type === "done")
    expect(done).toMatchObject({ replaced: true })
    expect((done?.response as Record<string, unknown>).text).toBe("What is the single most important term?")
  })

  it("serves greetings as an immediate done without the pipeline", async () => {
    mockPrepare.mockResolvedValue({ early: { type: "answer", text: "Hello!", deterministic: true } })
    const events = await readEvents(await POST(req({ text: "hi" })))
    expect(events).toHaveLength(1)
    expect(events[0]?.type).toBe("done")
    expect(mockAnswer).not.toHaveBeenCalled()
    expect(mockPersist).not.toHaveBeenCalled()
  })

  it("surfaces consent as an error event, not a crash", async () => {
    mockPrepare.mockRejectedValue(new Error("CONSENT_REQUIRED"))
    const events = await readEvents(await POST(req({ text: "Review this" })))
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ type: "error", error: "CONSENT_REQUIRED" })
  })

  it("rejects invalid JSON", async () => {
    const bad = new NextRequest("http://localhost/api/ask/stream", { method: "POST", body: "{{{" })
    const res = await POST(bad)
    expect(res.status).toBe(400)
  })
})
