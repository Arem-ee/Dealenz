import { describe, it, expect } from "vitest"
import { isLinkFlow, LINK_CALLBACK_PATH, resolveNextPath } from "./link"

describe("resolveNextPath", () => {
  it("accepts known internal destinations", () => {
    expect(resolveNextPath("/")).toBe("/")
    expect(resolveNextPath("/pricing")).toBe("/pricing")
    expect(resolveNextPath("/login")).toBe("/login")
    expect(resolveNextPath("/help")).toBe("/help")
  })

  it("falls back to / for removed routes", () => {
    expect(resolveNextPath("/dashboard")).toBe("/")
    expect(resolveNextPath("/settings")).toBe("/")
    expect(resolveNextPath("/lawyer-application")).toBe("/")
    expect(resolveNextPath("/lawyer-application/status")).toBe("/")
  })

  it("rejects external origins", () => {
    expect(resolveNextPath("https://evil.example")).toBe("/")
    expect(resolveNextPath("http://evil.example/x")).toBe("/")
  })

  it("rejects protocol-relative URLs", () => {
    expect(resolveNextPath("//evil.example")).toBe("/")
  })

  it("rejects javascript: and data: schemes", () => {
    expect(resolveNextPath("javascript:alert(1)")).toBe("/")
    expect(resolveNextPath("data:text/html,hi")).toBe("/")
  })

  it("rejects encoded external destinations", () => {
    expect(resolveNextPath("%2F%2Fevil.example")).toBe("/")
    expect(resolveNextPath("/%2e%2e/evil")).toBe("/")
  })

  it("rejects unknown internal paths and non-strings", () => {
    expect(resolveNextPath("/admin/secret")).toBe("/")
    expect(resolveNextPath(null)).toBe("/")
    expect(resolveNextPath(undefined)).toBe("/")
  })
})

describe("isLinkFlow", () => {
  it("detects the explicit link flow only", () => {
    const params = new URLSearchParams("flow=link")
    expect(isLinkFlow(params)).toBe(true)
    expect(isLinkFlow(new URLSearchParams(""))).toBe(false)
    expect(isLinkFlow(new URLSearchParams("flow=login"))).toBe(false)
  })
})

describe("LINK_CALLBACK_PATH", () => {
  it("is a fixed server-owned relative path", () => {
    expect(LINK_CALLBACK_PATH.startsWith("/")).toBe(true)
    expect(LINK_CALLBACK_PATH).toContain("flow=link")
  })
})
