import { describe, expect, it } from "vitest"
import {
  advanceAfterSign,
  ceremonyProgress,
  mintSignerToken,
  sealContent,
  validateRecipients,
} from "./ceremony"

describe("validateRecipients", () => {
  it("accepts clean lists and rejects bad emails, blanks, dupes, overflow", () => {
    expect(validateRecipients([{ name: "Ava", email: "ava@example.com" }])).toBeNull()
    expect(validateRecipients([{ name: "", email: "ava@example.com" }])).toContain("name")
    expect(validateRecipients([{ name: "Ava", email: "not-an-email" }])).toContain("not a valid email")
    expect(
      validateRecipients([
        { name: "Ava", email: "ava@example.com" },
        { name: "Ava 2", email: "AVA@example.com" },
      ])
    ).toContain("twice")
    expect(validateRecipients(Array.from({ length: 21 }, (_, i) => ({ name: `N${i}`, email: `n${i}@x.com` })))).toContain("20")
  })

  it("mints 48-char hex tokens", () => {
    const t = mintSignerToken()
    expect(t).toMatch(/^[0-9a-f]{48}$/)
    expect(mintSignerToken()).not.toBe(t)
  })
})

describe("ceremonyProgress", () => {
  const signer = (over: Partial<{ id: string; isOwner: boolean; status: "pending" | "signed" | "declined" | "revoked" }> = {}) => ({
    id: over.id ?? "s1",
    isOwner: over.isOwner ?? false,
    status: over.status ?? "pending" as const,
  })

  it("derives completion from active signers; revoked never block; declined blocks", () => {
    expect(ceremonyProgress([signer({ status: "signed" }), signer({ id: "s2", status: "pending" })])).toMatchObject({ signed: 1, total: 2, complete: false, blocked: false })
    expect(ceremonyProgress([signer({ status: "signed" })])).toMatchObject({ complete: true })
    expect(ceremonyProgress([signer({ status: "signed" }), signer({ id: "s2", status: "revoked" })])).toMatchObject({ signed: 1, total: 1, complete: true })
    expect(ceremonyProgress([signer({ status: "signed" }), signer({ id: "s2", status: "declined" })])).toMatchObject({ blocked: true, complete: false })
    expect(ceremonyProgress([])).toMatchObject({ complete: false })
  })
})

describe("advanceAfterSign", () => {
  it("walks ready → owner → counterparty → fully signed", () => {
    expect(advanceAfterSign("ready_to_sign", { signed: 1, total: 2, complete: false })).toBe("owner_signed")
    expect(advanceAfterSign("owner_signed", { signed: 1, total: 2, complete: false })).toBe("counterparty_pending")
    expect(advanceAfterSign("counterparty_pending", { signed: 2, total: 2, complete: true })).toBe("fully_signed")
    expect(advanceAfterSign("draft", { signed: 1, total: 2, complete: false })).toBeNull()
  })
})

describe("sealContent", () => {
  it("is a stable sha256 hex", () => {
    expect(sealContent("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")
  })
})
