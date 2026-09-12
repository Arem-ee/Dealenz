import { describe, it, expect } from "vitest"
import { extractTextFromBuffer, MAX_TOTAL_UPLOAD_BYTES } from "./text-extract"

describe("extractTextFromBuffer security boundaries", () => {
  it("extracts matching plain text", async () => {
    const text = await extractTextFromBuffer(Buffer.from("hello deal", "utf-8"), "text/plain")
    expect(text).toBe("hello deal")
  })

  it("rejects content that does not match the declared MIME", async () => {
    const textBytes = Buffer.from("just some words", "utf-8")
    await expect(extractTextFromBuffer(textBytes, "application/pdf")).rejects.toThrow(/does not match/)
    const pdfBytes = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34])
    await expect(extractTextFromBuffer(pdfBytes, "text/plain")).rejects.toThrow(/does not match/)
  })

  it("rejects binary garbage claimed as text", async () => {
    const exe = Buffer.alloc(64, 0)
    await expect(extractTextFromBuffer(exe, "text/plain")).rejects.toThrow(/does not match/)
  })

  it("rejects empty and oversized buffers explicitly", async () => {
    await expect(extractTextFromBuffer(Buffer.alloc(0), "text/plain")).rejects.toThrow(/empty/)
    await expect(
      extractTextFromBuffer(Buffer.alloc(11 * 1024 * 1024, 97), "text/plain")
    ).rejects.toThrow(/exceeds maximum size/)
  })

  it("aggregate upload cap is sane (below 10 files x 10MB)", () => {
    expect(MAX_TOTAL_UPLOAD_BYTES).toBeLessThan(10 * 10 * 1024 * 1024)
    expect(MAX_TOTAL_UPLOAD_BYTES).toBeGreaterThan(10 * 1024 * 1024)
  })
})
