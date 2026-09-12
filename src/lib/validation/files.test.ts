import { describe, it, expect } from "vitest"
import { sanitizeFilename, isSafeFilename, sniffUploadMime } from "./files"

describe("sanitizeFilename", () => {
  it("strips directory traversal and separators", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe("passwd")
    expect(sanitizeFilename("a/b\\c.pdf")).toBe("c.pdf")
    expect(sanitizeFilename("/absolute/path.docx")).toBe("path.docx")
  })

  it("removes control characters and unsafe symbols, preserving extension", () => {
    expect(sanitizeFilename("my contract (final)!.PDF")).toBe("my_contract_final.pdf")
    expect(sanitizeFilename("a\x00b.txt")).toBe("ab.txt")
  })

  it("bounds length and never returns empty or dot-only names", () => {
    const long = `${"a".repeat(200)}.pdf`
    const out = sanitizeFilename(long)
    expect(out.length).toBeLessThanOrEqual(120)
    expect(out.endsWith(".pdf")).toBe(true)
    expect(sanitizeFilename("...")).toBe("upload")
    expect(sanitizeFilename("")).toBe("upload")
    expect(sanitizeFilename(null)).toBe("upload")
  })

  it("isSafeFilename accepts only already-safe names", () => {
    expect(isSafeFilename("contract.pdf")).toBe(true)
    expect(isSafeFilename("../x.pdf")).toBe(false)
    expect(isSafeFilename("a/b.pdf")).toBe(false)
    expect(isSafeFilename("x".repeat(121))).toBe(false)
  })
})

describe("sniffUploadMime", () => {
  it("detects PDF, DOCX, and plain text by content, not extension", () => {
    expect(sniffUploadMime(Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]))).toBe("application/pdf")
    expect(sniffUploadMime(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]))).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
    expect(sniffUploadMime(Buffer.from("plain english text, nothing fancy."))).toBe("text/plain")
  })

  it("rejects binaries masquerading as text and tiny buffers", () => {
    const exe = Buffer.alloc(100, 0)
    exe[0] = 0x4d
    expect(sniffUploadMime(exe)).toBeNull()
    expect(sniffUploadMime(Buffer.alloc(0))).toBeNull()
    expect(sniffUploadMime(Buffer.from([0x01, 0x02]))).toBeNull()
  })
})
