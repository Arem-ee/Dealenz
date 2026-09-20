import { describe, it, expect, vi, beforeEach } from "vitest"

// uploadAndAttachFile: paper-in must land bytes before analysis runs, fail
// fast on obvious cases, never orphan storage objects, and surface the
// credit gate with next actions instead of a bare failure.

const mockGetUser = vi.hoisted(() => vi.fn())
const mockUpload = vi.hoisted(() => vi.fn())
const mockRemove = vi.hoisted(() => vi.fn())
const mockAttach = vi.hoisted(() => vi.fn())

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    storage: { from: vi.fn(() => ({ upload: mockUpload, remove: mockRemove })) },
  })),
}))

vi.mock("@/app/audit/[id]/actions", () => ({
  attachFileMetadata: mockAttach,
}))

import { uploadAndAttachFile } from "./attach"

const USER_ID = "00000000-0000-0000-0000-000000000001"
const AUDIT_ID = "00000000-0000-0000-0000-000000000002"

function pdfFile(name = "My Contract.PDF"): File {
  return new File(["contract text here"], name, { type: "application/pdf" })
}

describe("uploadAndAttachFile", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } })
    mockUpload.mockResolvedValue({ error: null })
    mockRemove.mockResolvedValue({ error: null })
    mockAttach.mockResolvedValue([{ name: "x" }])
  })

  it("uploads bytes to the caller-scoped path and attaches the sanitized name", async () => {
    const res = await uploadAndAttachFile(AUDIT_ID, pdfFile())
    expect(res).toEqual({ ok: true })
    expect(mockUpload).toHaveBeenCalledTimes(1)
    const [key] = mockUpload.mock.calls[0]
    expect(key).toBe(`${USER_ID}/${AUDIT_ID}/My_Contract.pdf`)
    expect(mockAttach).toHaveBeenCalledWith(AUDIT_ID, {
      name: "My_Contract.pdf",
      size: expect.any(Number),
      type: "application/pdf",
      path: `audit-files/${USER_ID}/${AUDIT_ID}/My_Contract.pdf`,
    })
  })

  it("rejects unsupported types before touching storage", async () => {
    const res = await uploadAndAttachFile(AUDIT_ID, new File(["x"], "photo.png", { type: "image/png" }))
    expect(res.ok).toBe(false)
    expect(mockUpload).not.toHaveBeenCalled()
    expect(mockAttach).not.toHaveBeenCalled()
  })

  it("removes the orphan and explains next actions when credits are insufficient", async () => {
    mockAttach.mockRejectedValue(new Error("Insufficient credits for this operation. File upload costs 15 credits."))
    const res = await uploadAndAttachFile(AUDIT_ID, pdfFile())
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.error).toMatch(/Insufficient credits/)
      expect(res.error).toMatch(/Billing|paste the contract text/i)
    }
    expect(mockRemove).toHaveBeenCalledWith([`${USER_ID}/${AUDIT_ID}/My_Contract.pdf`])
  })

  it("fails closed when the upload itself fails, without calling attach", async () => {
    mockUpload.mockResolvedValue({ error: { message: "boom" } })
    const res = await uploadAndAttachFile(AUDIT_ID, pdfFile())
    expect(res.ok).toBe(false)
    expect(mockAttach).not.toHaveBeenCalled()
  })
})
