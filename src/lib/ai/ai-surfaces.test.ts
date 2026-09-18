import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { callAIForSurface, resolveSurfaceConfig } from "./providers"
import { AIProviderError } from "./errors"
import { extractAndValidate } from "./extract"
import { analyzeRisk, analyzeRiskForDealType } from "./risk-analysis"
import { generateNegotiationPoints } from "./negotiation"

const SENTINEL_KEY = "sk-ant-SENTINEL-KEY-9f8e7d6c5b"
const PRIMARY_MODEL = "claude-sonnet-5"
const FALLBACK_MODEL = "claude-opus-5"

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

const VALID_EXTRACTION_JSON = JSON.stringify({
  goals: ["Launch website"],
  deliverables: ["Design", "Build"],
  timeline: null,
  budget: null,
  projectType: null,
  clientSignals: [],
  missingInformation: [],
  confidence: 0.9,
})

const RISK_JSON = JSON.stringify({
  summary: "Low risk",
  overallScore: 80,
  riskLevel: "low",
  recommendations: ["Confirm scope"],
  categories: {},
})

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

function stubAuthenticated() {
  vi.stubEnv("ANTHROPIC_API_KEY", SENTINEL_KEY)
  vi.stubEnv("AUTH_AI_MODEL", PRIMARY_MODEL)
  vi.stubEnv("AUTH_AI_FALLBACK_MODEL", FALLBACK_MODEL)
}

beforeEach(() => {
  clearAIEnv()
  fetchMock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe("authenticated fallback policy", () => {
  it("falls back from Sonnet to Opus on a retryable provider failure", async () => {
    stubAuthenticated()
    fetchMock
      .mockResolvedValueOnce(jsonResponse(500, { error: { type: "api_error" } }))
      .mockResolvedValueOnce(anthropicOk("fallback-text"))

    const { text, meta } = await callAIForSurface("authenticated", {
      systemPrompt: "s",
      userContent: "u",
    })

    expect(text).toBe("fallback-text")
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const firstBody = JSON.parse(fetchMock.mock.calls[0][1].body as string) as { model: string }
    const secondBody = JSON.parse(fetchMock.mock.calls[1][1].body as string) as { model: string }
    expect(firstBody.model).toBe(PRIMARY_MODEL)
    expect(secondBody.model).toBe(FALLBACK_MODEL)
    expect(meta.fallbackAttempted).toBe(true)
    expect(meta.servedByFallback).toBe(true)
    expect(meta.failureCategory).toBe("provider")
  })

  it("does not fall back on authentication errors", async () => {
    stubAuthenticated()
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { error: { type: "authentication_error" } }))

    const err = await callAIForSurface("authenticated", { systemPrompt: "s", userContent: "u" }).catch(
      (e: unknown) => e
    )
    expect(err).toBeInstanceOf(AIProviderError)
    expect((err as AIProviderError).category).toBe("auth")
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("does not fall back on configuration errors", async () => {
    // No ANTHROPIC_API_KEY stubbed: primary fails closed before any HTTP call.
    const err = await callAIForSurface("authenticated", { systemPrompt: "s", userContent: "u" }).catch(
      (e: unknown) => e
    )
    expect(err).toBeInstanceOf(AIProviderError)
    expect((err as AIProviderError).category).toBe("config")
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("does not convert a successful primary response into an Opus call", async () => {
    stubAuthenticated()
    fetchMock.mockResolvedValueOnce(anthropicOk("primary-text"))

    const { text, meta } = await callAIForSurface("authenticated", {
      systemPrompt: "s",
      userContent: "u",
    })

    expect(text).toBe("primary-text")
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(meta.fallbackAttempted).toBe(false)
    expect(meta.servedByFallback).toBe(false)
    expect(meta.primary).toEqual({ provider: "anthropic", model: PRIMARY_MODEL })
  })

  it("keeps the original failure visible when the fallback also fails", async () => {
    stubAuthenticated()
    fetchMock
      .mockResolvedValueOnce(jsonResponse(500, { error: { type: "api_error" } }))
      .mockResolvedValueOnce(jsonResponse(503, { error: { type: "overloaded_error" } }))

    const err = await callAIForSurface("authenticated", { systemPrompt: "s", userContent: "u" }).catch(
      (e: unknown) => e
    )
    expect(err).toBeInstanceOf(AIProviderError)
    expect((err as AIProviderError).category).toBe("provider")
    expect(fetchMock).toHaveBeenCalledTimes(2)
    // The primary failure travels as cause instead of being hidden.
    expect(err).toHaveProperty("cause")
  })
})

describe("provider selection", () => {
  it("defaults authenticated to Sonnet primary plus Opus fallback", () => {
    const config = resolveSurfaceConfig("authenticated")
    expect(config.provider).toBe("anthropic")
    expect(config.model).toBe(PRIMARY_MODEL)
    expect(config.fallbackModel).toBe(FALLBACK_MODEL)
  })

  it("honors explicit authenticated model configuration", () => {
    vi.stubEnv("AUTH_AI_MODEL", "claude-sonnet-5-pinned")
    vi.stubEnv("AUTH_AI_FALLBACK_MODEL", "claude-opus-5-pinned")

    const config = resolveSurfaceConfig("authenticated")
    expect(config.model).toBe("claude-sonnet-5-pinned")
    expect(config.fallbackModel).toBe("claude-opus-5-pinned")
  })

  it("supports a non-Anthropic authenticated provider without fallback models", () => {
    vi.stubEnv("AUTH_AI_PROVIDER", "gemini")
    vi.stubEnv("AUTH_AI_MODEL", "gemini-2.0-flash")

    const config = resolveSurfaceConfig("authenticated")
    expect(config.provider).toBe("gemini")
    expect(config.model).toBe("gemini-2.0-flash")
    expect(config.fallbackModel).toBeUndefined()
  })

})

describe("secret redaction", () => {
  it("never exposes the API key in errors or metadata", async () => {
    stubAuthenticated()

    // Sweep every failure mode with the sentinel key configured.
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { error: { type: "authentication_error" } }))
      .mockResolvedValueOnce(jsonResponse(500, { error: { type: "api_error" } }))
      .mockResolvedValueOnce(anthropicOk("recovered"))
      .mockResolvedValueOnce(jsonResponse(200, { content: [] }))
      .mockRejectedValueOnce(new TypeError("fetch failed"))

    const failures: unknown[] = []
    for (let i = 0; i < 3; i += 1) {
      try {
        await callAIForSurface("authenticated", { systemPrompt: "s", userContent: "u" })
      } catch (err) {
        failures.push(err)
      }
    }
    // Calls: 401 (no fallback), 500→200 (fallback success), malformed (fallbackable,
    // fallback transport fails → combined error). The loop ends after 3 attempts.
    expect(failures).toHaveLength(2)
    for (const failure of failures) {
      expect(String(failure)).not.toContain(SENTINEL_KEY)
      expect((failure as Error).message).not.toContain(SENTINEL_KEY)
    }
    for (const call of fetchMock.mock.calls) {
      const [url, init] = call as [string, RequestInit]
      expect(url).not.toContain("key=")
      expect(url).not.toContain(SENTINEL_KEY)
      // The key travels in exactly one place: the auth header.
      expect((init.headers as Record<string, string>)["x-api-key"]).toBe(SENTINEL_KEY)
    }
  })
})

describe("surface routing regression", () => {
  it("routes default extraction through the authenticated provider", async () => {
    stubAuthenticated()
    fetchMock.mockResolvedValueOnce(anthropicOk(VALID_EXTRACTION_JSON))

    const result = await extractAndValidate("Build a website with design and build phases")

    expect(result.valid).toBe(true)
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("https://api.anthropic.com/v1/messages")
  })

  it("marks usedFallback accurately when the authenticated fallback serves", async () => {
    stubAuthenticated()
    const extracted = {
      goals: ["g"],
      deliverables: ["d"],
      timeline: null,
      budget: null,
      projectType: null,
      clientSignals: [],
      missingInformation: [],
      confidence: 0.9,
    }
    fetchMock
      .mockResolvedValueOnce(jsonResponse(500, { error: { type: "api_error" } }))
      .mockResolvedValueOnce(anthropicOk(RISK_JSON))

    const { report, usedFallback } = await analyzeRisk(extracted)

    expect(usedFallback).toBe(true)
    expect(report.overallScore).toBe(80)
  })

  it("routes negotiation points through the authenticated provider by default", async () => {
    stubAuthenticated()
    fetchMock.mockResolvedValueOnce(anthropicOk('{"points":["Ask about scope"]}'))
    const extracted = {
      goals: ["g"],
      deliverables: ["d"],
      timeline: null,
      budget: null,
      projectType: null,
      clientSignals: [],
      missingInformation: [],
      confidence: 0.9,
    }
    const report = {
      overallScore: 80,
      riskLevel: "Low" as const,
      categories: {},
      summary: "Low risk",
      recommendations: [],
    }

    const points = await generateNegotiationPoints(extracted, report)

    expect(points).toEqual(["Ask about scope"])
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("https://api.anthropic.com/v1/messages")
  })

  it("routes lease extraction through the agreement-oriented generic prompt", async () => {
    stubAuthenticated()
    fetchMock.mockResolvedValueOnce(anthropicOk(VALID_EXTRACTION_JSON))

    const { extractProjectData } = await import("./extract")
    await extractProjectData("Shop lease, 12 month term.", "lease")

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string) as { system: unknown }
    const systemText = typeof body.system === "string" ? body.system : Array.isArray(body.system) ? (body.system as Array<{ text?: string }>).map((b) => b.text ?? "").join(" ") : ""
    expect(systemText).toContain("agreement analyst")
    expect(systemText).not.toContain("project analyst")
  })

  it("routes lease risk analysis through the adaptive generic path, not the freelance engine", async () => {
    stubAuthenticated()
    fetchMock.mockResolvedValueOnce(anthropicOk(RISK_JSON))
    const extracted = {
      goals: ["g"],
      deliverables: [],
      timeline: null,
      budget: null,
      projectType: "lease",
      clientSignals: [],
      missingInformation: [],
      confidence: 0.9,
    }

    const result = await analyzeRiskForDealType(extracted, "lease")

    expect(result.genericAnalysisUnavailable).toBe(false)
    expect(result.usedFallback).toBe(false)
    // Freelance-shaped reports always carry the 8 fixed categories;
    // the generic path returns only what the model identified.
    expect(result.report.categories).toEqual({})
    expect("scopeRisk" in result.report.categories).toBe(false)
  })
})
