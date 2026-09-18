import { describe, it, expect, vi, beforeEach } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const pdfLoadCalls: unknown[] = []

// Stand in for the real pdf-parse (pdfjs-dist): records when the PDF branch
// actually loads it. The point of these tests is load TIMING, not parsing.
vi.mock("pdf-parse", () => ({
  PDFParse: class {
    constructor(opts: unknown) {
      pdfLoadCalls.push(opts)
    }
    async getText() {
      return { text: "stubbed pdf text" }
    }
  },
}))

const DOM_LIKE_GLOBALS = ["DOMMatrix", "DOMPoint", "DOMRect", "document", "window", "self", "navigator"]

function removeDomGlobals(): Map<string, unknown> {
  const saved = new Map<string, unknown>()
  const g = globalThis as Record<string, unknown>
  for (const key of DOM_LIKE_GLOBALS) {
    if (key in g) {
      saved.set(key, g[key])
      try {
        delete g[key]
      } catch {
        // Non-configurable in this runtime: the import must still succeed.
      }
    }
  }
  return saved
}

function restoreDomGlobals(saved: Map<string, unknown>) {
  const g = globalThis as Record<string, unknown>
  for (const [key, value] of saved) {
    try {
      g[key] = value
    } catch {
      // Best effort; test assertions already ran.
    }
  }
}

describe("pdf-parse stays lazy (P0 DOMMatrix production crash)", () => {
  beforeEach(() => {
    pdfLoadCalls.length = 0
    vi.resetModules()
  })

  it("text-extract evaluates with no DOM globals present", async () => {
    const saved = removeDomGlobals()
    try {
      const mod = await import("./text-extract")
      expect(typeof mod.extractTextFromBuffer).toBe("function")
      expect(typeof mod.isSupportedFileType).toBe("function")
    } finally {
      restoreDomGlobals(saved)
    }
  })

  it("plain-text extraction never loads pdf-parse", async () => {
    const saved = removeDomGlobals()
    try {
      const { extractTextFromBuffer } = await import("./text-extract")
      await expect(extractTextFromBuffer(Buffer.from("hello deal", "utf-8"), "text/plain")).resolves.toBe(
        "hello deal"
      )
      expect(pdfLoadCalls).toHaveLength(0)
    } finally {
      restoreDomGlobals(saved)
    }
  })

  it("pdf branch loads pdf-parse on demand and returns its text", async () => {
    const { extractTextFromBuffer } = await import("./text-extract")
    const pdf = Buffer.concat([Buffer.from("%PDF-1.4\n", "utf-8"), Buffer.alloc(64, 0x20)])
    await expect(extractTextFromBuffer(pdf, "application/pdf")).resolves.toBe("stubbed pdf text")
    expect(pdfLoadCalls).toHaveLength(1)
  })

  it("text-extract source has no top-level pdf-parse/pdfjs import", () => {
    const src = readFileSync(join(process.cwd(), "src/lib/text-extract.ts"), "utf8")
    const offenders = src
      .split("\n")
      .map((line) => line.trimEnd())
      .filter((line) => {
        if (line.trimStart().startsWith("//")) return false
        // Column-zero static import of the PDF stack. The lazy
        // `await import("pdf-parse")` inside the PDF branch is indented.
        return /^import\s+(?:.*\bfrom\s+)?["'](pdf-parse|pdfjs-dist[^"']*)["']/.test(line)
      })
    expect(offenders).toEqual([])
  })
})
