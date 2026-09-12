// Live bounded retrieval adapter (Phase 31).
//
// Real authoritative-source fetching behind the existing allowlist. Webpage
// content is DATA, never instructions: no script execution (string-only
// sanitization), no credential forwarding, no cookies, no user headers.
//
// Safety: HTTPS-only, SSRF guards (localhost/private/loopback/link-local/
// metadata endpoints, validated on every redirect hop), manual redirect
// following with per-hop allowlist re-validation, content-type allowlist,
// byte cap enforced during streaming, request timeout via AbortController.
// DNS-rebinding TOCTOU cannot be fully eliminated at this layer; mitigate by
// re-validating the final host and keeping the allowlist narrow.

import { isAllowedUrl, RESEARCH_TIMEOUT_MS, MAX_RESULT_CONTENT_CHARS, RESEARCH_MAX_REDIRECTS } from "./allowlist"
import type { RetrievalAdapter } from "./research"

export interface LiveRetrievalOptions {
  timeoutMs?: number
  maxBytes?: number
  maxRedirects?: number
  /** Injectable fetch for tests. Defaults to global fetch. */
  fetchImpl?: typeof fetch
  /** Brave Search API key. When absent, search() is unavailable (corpus + direct revalidation only). */
  searchApiKey?: string
}

const TEXT_CONTENT_TYPES = ["text/html", "text/plain"]

function isPrivateHostname(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "")
  if (h === "localhost" || h === "0.0.0.0" || h === "::" || h === "::1") return true
  if (h === "169.254.169.254" || h === "100.100.100.200" || h === "metadata.google.internal") return true
  if (h.startsWith("10.") || h.startsWith("192.168.")) return true
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true
  if (h.startsWith("169.254.")) return true
  if (h.startsWith("fd") || h.startsWith("fc")) return true // fc00::/7 ULA (heuristic)
  if (h.startsWith("fe80:")) return true // link-local
  if (h.startsWith("::ffff:")) {
    const v4 = h.slice("::ffff:".length)
    if (v4 === "127.0.0.1" || v4.startsWith("10.") || v4.startsWith("192.168.") || v4 === "169.254.169.254") return true
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(v4)) return true
  }
  return false
}

export function isSafeRetrievalUrl(raw: string): { ok: boolean; reason?: string } {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return { ok: false, reason: "invalid URL" }
  }
  if (url.protocol !== "https:") return { ok: false, reason: "HTTPS required" }
  if (url.username || url.password) return { ok: false, reason: "credentials in URL" }
  if (isPrivateHostname(url.hostname)) return { ok: false, reason: "private/loopback/metadata host" }
  if (!isAllowedUrl(raw)) return { ok: false, reason: "host not allowlisted" }
  return { ok: true }
}

/** Strip HTML to text with string ops only. No script execution, no DOM. */
export function htmlToText(html: string): string {
  let t = html
  t = t.replace(/<!--[\s\S]*?-->/g, " ")
  t = t.replace(/<script[\s\S]*?<\/script\s*>/gi, " ")
  t = t.replace(/<style[\s\S]*?<\/style\s*>/gi, " ")
  t = t.replace(/<(noscript|template|iframe|object|embed|svg|canvas)[\s\S]*?<\/\1\s*>/gi, " ")
  t = t.replace(/<\/(p|div|section|article|h[1-6]|li|tr|br)[^>]*>/gi, "\n")
  t = t.replace(/<[^>]+>/g, " ")
  t = t
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ")
  return t.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim()
}

async function readCapped(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
  signal: AbortSignal,
  fetchImpl: typeof fetch
): Promise<string> {
  // Fallback for mock fetch implementations without streaming bodies.
  if (!body || typeof body.getReader !== "function") {
    return ""
  }
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    for (;;) {
      if (signal.aborted) throw new Error("timeout")
      const { done, value } = await reader.read()
      if (done) break
      if (value) {
        total += value.byteLength
        if (total > maxBytes) throw new Error("too_large")
        chunks.push(value)
      }
    }
  } finally {
    try {
      reader.releaseLock()
    } catch {
      // ignore
    }
  }
  const merged = new Uint8Array(total)
  let offset = 0
  for (const c of chunks) {
    merged.set(c, offset)
    offset += c.byteLength
  }
  void fetchImpl
  return new TextDecoder("utf-8", { fatal: false }).decode(merged)
}

export function createLiveRetrievalAdapter(opts: LiveRetrievalOptions = {}): RetrievalAdapter {
  const timeoutMs = opts.timeoutMs ?? RESEARCH_TIMEOUT_MS
  const maxBytes = opts.maxBytes ?? MAX_RESULT_CONTENT_CHARS
  const maxRedirects = opts.maxRedirects ?? RESEARCH_MAX_REDIRECTS
  const fetchImpl: typeof fetch =
    opts.fetchImpl ??
    ((globalThis as unknown as { fetch?: typeof fetch }).fetch?.bind(globalThis) as typeof fetch)
  if (!fetchImpl) throw new Error("No fetch implementation available")

  async function fetchUrl(url: string): Promise<{ url: string; status: number; text: string; headers: Record<string, string> }> {
    let current = url
    const visited = new Set<string>()
    for (let hop = 0; hop <= maxRedirects; hop++) {
      const safety = isSafeRetrievalUrl(current)
      if (!safety.ok) throw new Error(`unsafe URL (${safety.reason}): ${redactUrl(current)}`)
      if (visited.has(current)) throw new Error("redirect loop")
      visited.add(current)

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      let res: Response
      try {
        res = await fetchImpl(current, {
          method: "GET",
          redirect: "manual",
          credentials: "omit",
          signal: controller.signal,
          headers: { "User-Agent": "Dealenz-LegalResearch/1.0", Accept: "text/html,text/plain" },
        })
      } catch (e) {
        clearTimeout(timer)
        if (e instanceof Error && (e.name === "AbortError" || /abort/i.test(e.message))) throw new Error("timeout")
        throw new Error(`network failure: ${e instanceof Error ? e.message.slice(0, 120) : "unknown"}`)
      } finally {
        clearTimeout(timer)
      }

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location")
        if (!location) throw new Error("redirect without location")
        try {
          res.body?.cancel().catch(() => undefined)
        } catch {
          // ignore
        }
        current = new URL(location, current).toString()
        continue
      }

      const contentType = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase()
      if (!TEXT_CONTENT_TYPES.includes(contentType)) {
        try {
          await res.body?.cancel()
        } catch {
          // ignore
        }
        throw new Error(`unsupported content-type: ${contentType || "unknown"}`)
      }

      const controller2 = new AbortController()
      const timer2 = setTimeout(() => controller2.abort(), timeoutMs)
      let raw: string
      try {
        // Prefer streaming cap when available; fall back to res.text() for mocks.
        if (res.body && typeof (res.body as ReadableStream).getReader === "function") {
          raw = await readCapped(res.body as unknown as ReadableStream<Uint8Array>, maxBytes, controller2.signal, fetchImpl)
        } else {
          const text = await res.text()
          if (new TextEncoder().encode(text).byteLength > maxBytes) throw new Error("too_large")
          raw = text
        }
      } catch (e) {
        clearTimeout(timer2)
        if (e instanceof Error && /too_large|timeout/.test(e.message)) throw e
        throw new Error(`read failure: ${e instanceof Error ? e.message.slice(0, 120) : "unknown"}`)
      }
      clearTimeout(timer2)

      const text = contentType === "text/html" ? htmlToText(raw) : raw.trim()
      return { url: current, status: res.status, text: text.slice(0, maxBytes), headers: { "content-type": contentType } }
    }
    throw new Error("too many redirects")
  }

  const adapter: RetrievalAdapter = {
    fetch: fetchUrl,
  }

  const searchApiKey = opts.searchApiKey ?? process.env.LEGAL_SEARCH_API_KEY
  if (searchApiKey) {
    adapter.search = async (query: string): Promise<string[]> => {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      try {
        const res = await fetchImpl(
          `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query.slice(0, 200))}&count=5`,
          {
            headers: { "X-Subscription-Token": searchApiKey, Accept: "application/json" },
            signal: controller.signal,
          }
        )
        if (!res.ok) return []
        const data = (await res.json()) as { web?: { results?: Array<{ url?: string }> } }
        const urls = (data.web?.results ?? []).map((r) => r.url).filter((u): u is string => typeof u === "string")
        return urls.filter((u) => isAllowedUrl(u)).slice(0, 5)
      } catch {
        return []
      } finally {
        clearTimeout(timer)
      }
    }
  }

  return adapter
}

function redactUrl(raw: string): string {
  try {
    const u = new URL(raw)
    return `${u.protocol}//${u.hostname}/…`
  } catch {
    return "invalid-url"
  }
}

/**
 * Env-gated live adapter for server-side research. Default off (null →
 * corpus-only) so tests and default deployments stay deterministic.
 * Server-only env vars; never NEXT_PUBLIC.
 */
export function getResearchAdapter(): RetrievalAdapter | null {
  if (process.env.LEGAL_RESEARCH_LIVE !== "1") return null
  try {
    return createLiveRetrievalAdapter()
  } catch {
    return null
  }
}
