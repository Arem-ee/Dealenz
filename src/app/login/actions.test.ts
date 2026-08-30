import { describe, it, expect, vi, beforeEach } from "vitest"
import { logEvent } from "@/lib/logger"
import { logAuthFailure } from "./actions"

vi.mock("@/lib/logger", () => ({
  logEvent: vi.fn(),
}))

describe("logAuthFailure", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("logs login failure with error message", async () => {
    await logAuthFailure("Invalid credentials", "login")
    expect(logEvent).toHaveBeenCalledWith({
      phase: "auth_login",
      status: "failure",
      error_message: "Invalid credentials",
    })
  })

  it("logs register failure with error message", async () => {
    await logAuthFailure("Email already in use", "register")
    expect(logEvent).toHaveBeenCalledWith({
      phase: "auth_register",
      status: "failure",
      error_message: "Email already in use",
    })
  })
})
