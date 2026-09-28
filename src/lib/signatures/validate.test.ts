import { describe, it, expect } from "vitest"
import { validateSignatureArtifact } from "./validate"

const png = (n: number) => `data:image/png;base64,${"A".repeat(n)}`

describe("validateSignatureArtifact", () => {
  it("accepts well-formed artifacts in all three styles", () => {
    expect(validateSignatureArtifact({ imageData: png(5000), method: "drawn" })).toMatchObject({ ok: true, method: "drawn" })
    expect(validateSignatureArtifact({ imageData: png(5000), method: "typed" })).toMatchObject({ ok: true, method: "typed" })
    expect(validateSignatureArtifact({ imageData: png(5000), method: "uploaded" })).toMatchObject({ ok: true, method: "uploaded" })
  })

  it("rejects unknown styles, non-PNG payloads, blanks, and oversize images", () => {
    expect(validateSignatureArtifact({ imageData: png(5000), method: "stamped" }).ok).toBe(false)
    expect(validateSignatureArtifact({ imageData: "data:image/jpeg;base64,AAAA", method: "drawn" }).ok).toBe(false)
    expect(validateSignatureArtifact({ imageData: "not-a-data-url", method: "drawn" }).ok).toBe(false)
    expect(validateSignatureArtifact({ imageData: png(50), method: "drawn" }).ok).toBe(false)
    expect(validateSignatureArtifact({ imageData: png(70_001), method: "drawn" }).ok).toBe(false)
  })
})
