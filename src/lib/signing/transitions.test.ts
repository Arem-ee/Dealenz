import { describe, it, expect } from "vitest"
import { canTransitionSigning, normalizeSigningStatus, isLockedStatus } from "./transitions"

describe("signing transitions", () => {
  it("allows draft -> ready_to_sign", () => {
    expect(canTransitionSigning("draft", "ready_to_sign")).toBe(true)
  })
  it("allows owner_signed -> counterparty_pending", () => {
    expect(canTransitionSigning("owner_signed", "counterparty_pending")).toBe(true)
  })
  it("allows fully_signed -> locked", () => {
    expect(canTransitionSigning("fully_signed", "locked")).toBe(true)
  })
  it("allows locked -> superseded (redraft)", () => {
    expect(canTransitionSigning("locked", "superseded")).toBe(true)
  })
  it("rejects draft -> locked directly", () => {
    expect(canTransitionSigning("draft", "locked")).toBe(false)
  })
  it("rejects locked -> draft", () => {
    expect(canTransitionSigning("locked", "draft")).toBe(false)
  })
  it("normalizes legacy ready_to_send", () => {
    expect(normalizeSigningStatus("ready_to_send")).toBe("ready_to_sign")
  })
  it("normalizes legacy sent", () => {
    expect(normalizeSigningStatus("sent")).toBe("counterparty_pending")
  })
  it("detects locked statuses", () => {
    expect(isLockedStatus("locked")).toBe(true)
    expect(isLockedStatus("fully_signed")).toBe(true)
    expect(isLockedStatus("superseded")).toBe(true)
    expect(isLockedStatus("draft")).toBe(false)
  })
})
