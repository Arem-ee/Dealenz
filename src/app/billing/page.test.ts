import { describe, it, expect } from "vitest"
import { PURCHASE_STATUS_LABEL, checkoutReturnNotice } from "./page"

describe("purchase history labels", () => {
  it("states every purchase outcome honestly", () => {
    expect(PURCHASE_STATUS_LABEL.succeeded.label).toMatch(/credit/i)
    expect(PURCHASE_STATUS_LABEL.pending.label).toMatch(/processing|settlement/i)
    expect(PURCHASE_STATUS_LABEL.failed.label).toMatch(/no credits/i)
    expect(PURCHASE_STATUS_LABEL.canceled.label).toMatch(/no credits/i)
  })
})

describe("checkout return notices (spoof-proof)", () => {
  it("explains cancellation without touching balance language", () => {
    const notice = checkoutReturnNotice("cancel")
    expect(notice?.title).toMatch(/cancelled/i)
    expect(notice?.body).toMatch(/no charge/i)
  })

  it("never claims payment success on return", () => {
    const notice = checkoutReturnNotice("success")
    expect(notice?.body).toMatch(/does not mean payment succeeded/i)
    expect(notice?.body).not.toMatch(/^payment (succeeded|complete)/i)
  })

  it("renders nothing for missing, unknown, or hostile values", () => {
    expect(checkoutReturnNotice(undefined)).toBeNull()
    expect(checkoutReturnNotice("")).toBeNull()
    expect(checkoutReturnNotice("succeeded")).toBeNull()
    expect(checkoutReturnNotice("success'; DROP TABLE--")).toBeNull()
    expect(checkoutReturnNotice("SUCCESS")).toBeNull()
  })
})
