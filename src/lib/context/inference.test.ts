import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { inferContextFields, mergeInferredContext } from "./inference"
import { emptyContextEnvelope, seedEnvelopeForDealType } from "./schema"

const SENTINEL_KEY = "sk-ant-SENTINEL-KEY-9f8e7d6c5b"

function anthropicOk(text: string): Response {
  return new Response(
    JSON.stringify({
      id: "msg_test",
      type: "message",
      role: "assistant",
      content: [{ type: "text", text }],
      stop_reason: "end_turn",
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  )
}

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
  vi.stubEnv("ANTHROPIC_API_KEY", SENTINEL_KEY)
  vi.stubEnv("AUTH_AI_MODEL", "claude-sonnet-5")
  vi.stubEnv("AUTH_AI_FALLBACK_MODEL", "claude-opus-5")
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

const INFERENCE_JSON = JSON.stringify({
  jurisdiction: { value: "United Kingdom", confidence: 0.81 },
  governingLaw: { value: null, confidence: 0 },
  userRole: { value: "freelancer", confidence: 0.94 },
  counterpartyRole: { value: null, confidence: 0 },
  industry: { value: "technology", confidence: 0.7 },
  transactionStructure: { value: null, confidence: 0 },
  transactionValue: { value: 5000, confidence: 0.6 },
  transactionCurrency: { value: "USD", confidence: 0.6 },
  transactionStage: { value: "negotiation", confidence: 0.5 },
  crossBorder: { value: false, confidence: 0.9 },
  regulatedIndustry: { value: null, confidence: 0 },
  entityTypes: { value: ["individual"], confidence: 0.8 },
})

describe("context inference", () => {
  it("produces structured inferred fields on the authenticated surface", async () => {
    fetchMock.mockResolvedValueOnce(anthropicOk(INFERENCE_JSON))

    const envelope = await inferContextFields(
      { dealType: "freelance", rawInput: "Website build for a London client, $5000, negotiating now." },
      "authenticated"
    )

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("https://api.anthropic.com/v1/messages")
    expect(envelope.fields.jurisdiction).toEqual({ value: "United Kingdom", source: "inferred", confidence: 0.81 })
    expect(envelope.fields.userRole).toEqual({ value: "freelancer", source: "inferred", confidence: 0.94 })
    expect(envelope.fields.governingLaw).toEqual({ value: null, source: "unknown", confidence: 0 })
  })

  it("treats null and zero-confidence values as unknown", async () => {
    fetchMock.mockResolvedValueOnce(anthropicOk(INFERENCE_JSON))
    const envelope = await inferContextFields({ dealType: "generic", rawInput: "Some agreement text." })
    expect(envelope.fields.counterpartyRole.source).toBe("unknown")
    expect(envelope.fields.regulatedIndustry).toEqual({ value: null, source: "unknown", confidence: 0 })
  })

  it("fails safely on malformed AI output", async () => {
    fetchMock.mockResolvedValueOnce(anthropicOk("not json at all {{{"))
    await expect(inferContextFields({ dealType: "freelance", rawInput: "text" })).rejects.toThrow(
      /Failed to parse/
    )
  })

  it("rejects out-of-vocabulary inferred values instead of persisting them", async () => {
    const bad = JSON.stringify({
      jurisdiction: { value: "Atlantis", confidence: 0.9 },
      userRole: { value: "time_traveler", confidence: 0.9 },
    })
    fetchMock.mockResolvedValueOnce(anthropicOk(bad))
    await expect(inferContextFields({ dealType: "freelance", rawInput: "text" })).rejects.toThrow(
      /invalid value/
    )
  })

  it("never lets inference overwrite user-confirmed fields", async () => {
    fetchMock.mockResolvedValueOnce(anthropicOk(INFERENCE_JSON))
    const stored = seedEnvelopeForDealType("freelance")
    stored.fields.jurisdiction = { value: "Canada", source: "user_confirmed", confidence: 1 }
    const inferred = await inferContextFields({ dealType: "freelance", rawInput: "London client work." })
    const merged = mergeInferredContext(stored, inferred)
    // User correction survives; fresh inference fills the rest.
    expect(merged.fields.jurisdiction).toEqual({ value: "Canada", source: "user_confirmed", confidence: 1 })
    expect(merged.fields.userRole.source).toBe("inferred")
    expect(merged.fields.dealType.source).toBe("user_confirmed")
  })

  it("never lets inference propose intent or priorities", async () => {
    fetchMock.mockResolvedValueOnce(anthropicOk(INFERENCE_JSON))
    const inferred = await inferContextFields({ dealType: "freelance", rawInput: "London client work." })
    expect(inferred.fields.intent).toEqual({ value: null, source: "unknown", confidence: 0 })
    expect(inferred.fields.priorities).toEqual({ value: null, source: "unknown", confidence: 0 })
  })

  it("never lets inference overwrite confirmed intent or priorities", async () => {
    fetchMock.mockResolvedValueOnce(anthropicOk(INFERENCE_JSON))
    const stored = seedEnvelopeForDealType("freelance")
    stored.fields.intent = { value: "review", source: "user_confirmed", confidence: 1 }
    stored.fields.priorities = { value: ["fee_terms"], source: "user_confirmed", confidence: 1 }
    const inferred = await inferContextFields({ dealType: "freelance", rawInput: "London client work." })
    const merged = mergeInferredContext(stored, inferred)
    expect(merged.fields.intent).toEqual({ value: "review", source: "user_confirmed", confidence: 1 })
    expect(merged.fields.priorities).toEqual({ value: ["fee_terms"], source: "user_confirmed", confidence: 1 })
  })

  it("requires input before calling the model", async () => {
    await expect(inferContextFields({ dealType: "freelance" })).rejects.toThrow(/No input/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("keeps the API key out of inference errors", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"))
    const err = await inferContextFields({ dealType: "freelance", rawInput: "text" }).catch((e: unknown) => e)
    expect(String(err)).not.toContain(SENTINEL_KEY)
  })

  it("inference output never contains legal conclusions", async () => {
    // The contract here is structural: inference returns observations with
    // confidence and no finding/severity/score fields of any kind.
    fetchMock.mockResolvedValueOnce(anthropicOk(INFERENCE_JSON))
    const envelope = await inferContextFields({ dealType: "freelance", rawInput: "Lease for a shop." })
    const serialized = JSON.stringify(envelope.fields)
    for (const banned of ["severity", "riskLevel", "overallScore", "enforceab", "compliant", "illegal", "lawful"]) {
      expect(serialized).not.toContain(banned)
    }
    expect(emptyContextEnvelope().fields).toBeDefined()
  })
})
