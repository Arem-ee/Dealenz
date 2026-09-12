import { describe, it, expect, vi, beforeEach } from "vitest"

const OWNER_ID = "00000000-0000-0000-0000-00000000aa01"
const AUDIT_ID = "00000000-0000-0000-0000-00000000bb02"
const VERSION_ID = "00000000-0000-0000-0000-00000000cc03"

interface MockOpts {
  user?: { id: string } | null
  auditRow?: Record<string, unknown> | null
  versionRow?: Record<string, unknown> | null
  latestRow?: Record<string, unknown> | null
  versionQueue?: Array<Record<string, unknown> | null>
  finalRow?: Record<string, unknown> | null
  finalList?: Record<string, unknown>[]
  versionList?: Record<string, unknown>[]
  signerList?: Array<Record<string, unknown>>
  finalUpdateError?: { message: string } | null
  insertError?: { message: string } | null
  updateError?: { message: string } | null
}

const state: { opts: MockOpts; writes: Array<{ table: string; op: string }> } = {
  opts: {},
  writes: [],
}

function chainFor(table: string) {
  const builder: Record<string, unknown> = {}
  const terminal = (data: unknown) => Promise.resolve({ data, error: null })
  builder.select = vi.fn(() => builder)
  builder.eq = vi.fn(() => builder)
  builder.order = vi.fn(() => builder)
  builder.limit = vi.fn(() => builder)
  builder.update = vi.fn(() => {
    state.writes.push({ table, op: "update" })
    if (table === "final_documents" && state.opts.finalUpdateError) {
      // Database trigger rejection terminal (e.g. trg_final_document_lock):
      // the chained .eq() calls resolve the same error.
      const terminalErr: Record<string, unknown> = {}
      terminalErr.eq = vi.fn(() => terminalErr)
      terminalErr.then = (resolve: (v: unknown) => unknown) =>
        Promise.resolve({ data: null, error: state.opts.finalUpdateError }).then(resolve)
      return terminalErr
    }
    return builder
  })
  builder.insert = vi.fn(() => {
    state.writes.push({ table, op: "insert" })
    if (table === "final_documents" && state.opts.insertError) {
      return Promise.resolve({ data: null, error: state.opts.insertError })
    }
    if (table === "audits" && state.opts.updateError) {
      return Promise.resolve({ data: null, error: state.opts.updateError })
    }
    return builder
  })
  builder.single = vi.fn(() => {
    if (table === "audits") return terminal(state.opts.auditRow ?? null)
    return terminal(null)
  })
  builder.maybeSingle = vi.fn(() => {
    if (table === "audits") return terminal(state.opts.auditRow ?? null)
    if (table === "document_versions") {
      // First call resolves the named version, second the latest lookup.
      if (state.opts.versionQueue && state.opts.versionQueue.length > 0) {
        return terminal(state.opts.versionQueue.shift() ?? null)
      }
      return terminal(state.opts.versionRow ?? null)
    }
    if (table === "final_documents") return terminal(state.opts.finalRow ?? null)
    return terminal(null)
  })
  builder.then = (resolve: (v: unknown) => unknown) => {
    if (table === "document_signers" && state.opts.signerList !== undefined) {
      return terminal(state.opts.signerList).then(resolve)
    }
    if (table === "final_documents" && state.opts.finalList !== undefined) {
      return terminal(state.opts.finalList).then(resolve)
    }
    if (table === "document_versions" && state.opts.versionList !== undefined) {
      return terminal(state.opts.versionList).then(resolve)
    }
    return terminal([]).then(resolve)
  }
  return builder
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: vi.fn(() => Promise.resolve({ data: { user: state.opts.user ?? null } })) },
    from: (table: string) => chainFor(table),
  })),
}))

vi.mock("@/lib/logger", () => ({
  logEvent: vi.fn(),
  logDuration: vi.fn(() => 1),
  reportError: vi.fn(),
  reportAIFallback: vi.fn(),
}))

import { finalizeDocument, getFinalDocuments, completeDeal, isVersionExecuted } from "./document-actions"

const VERSION = { id: VERSION_ID, audit_id: AUDIT_ID, document_type: "contract", version_number: 3 }

beforeEach(() => {
  vi.clearAllMocks()
  state.opts = {
    user: { id: OWNER_ID },
    auditRow: { id: AUDIT_ID, status: "analyzed" },
    versionRow: { ...VERSION },
  }
  state.writes = []
})

describe("isVersionExecuted", () => {
  it("requires at least one signer and zero pending", async () => {
    await expect(isVersionExecuted([])).resolves.toBe(false)
    await expect(isVersionExecuted([{ status: "signed" }])).resolves.toBe(true)
    await expect(isVersionExecuted([{ status: "signed" }, { status: "pending" }])).resolves.toBe(false)
    await expect(isVersionExecuted([{ status: "signed" }, { status: "declined" }])).resolves.toBe(false)
  })
})

describe("finalizeDocument", () => {
  it("finalizes the latest version for its type", async () => {
    state.opts.versionQueue = [{ ...VERSION }, { version_number: 3 }]
    const res = await finalizeDocument(AUDIT_ID, VERSION_ID)
    expect(res).toEqual({ success: true, final: true })
    expect(state.writes.some((w) => w.table === "final_documents" && w.op === "insert")).toBe(true)
  })

  it("rejects versions from other deals and stale versions", async () => {
    state.opts.versionQueue = [null]
    await expect(finalizeDocument(AUDIT_ID, VERSION_ID)).rejects.toThrow(/belong/)
    state.opts.versionQueue = [{ ...VERSION }, { version_number: 4 }]
    await expect(finalizeDocument(AUDIT_ID, VERSION_ID)).rejects.toThrow(/newer version/)
  })

  it("rejects malformed ids and strangers", async () => {
    await expect(finalizeDocument("nope", VERSION_ID)).rejects.toThrow(/Invalid audit/)
    await expect(finalizeDocument(AUDIT_ID, "nope")).rejects.toThrow(/Invalid document/)
    state.opts.user = null
    await expect(finalizeDocument(AUDIT_ID, VERSION_ID)).rejects.toThrow(/Unauthorized/)
  })

  it("is idempotent for the same version", async () => {
    state.opts.versionQueue = [{ ...VERSION }, { version_number: 3 }]
    state.opts.finalRow = { document_version_id: VERSION_ID }
    const res = await finalizeDocument(AUDIT_ID, VERSION_ID)
    expect(res).toEqual({ success: true, final: true })
    expect(state.writes.some((w) => w.table === "final_documents")).toBe(false)
  })

  it("locks executed finals against re-pointing", async () => {
    state.opts.versionQueue = [{ ...VERSION, id: "v4", version_number: 4 }, { version_number: 4 }]
    state.opts.finalRow = { document_version_id: "v3" }
    state.opts.signerList = [{ status: "signed" }, { status: "signed" }]
    // Signer list here belongs to the requested type; the mock returns it
    // for the executed check on the CURRENT final (v3).
    await expect(
      finalizeDocument(AUDIT_ID, "00000000-0000-0000-0000-00000000dd04")
    ).rejects.toThrow(/already executed/)
  })

  it("re-points unexecuted finals to newer versions", async () => {
    state.opts.versionQueue = [{ ...VERSION, id: "v4", version_number: 4 }, { version_number: 4 }]
    state.opts.finalRow = { document_version_id: "v3" }
    state.opts.signerList = [{ status: "pending" }]
    const res = await finalizeDocument(AUDIT_ID, "00000000-0000-0000-0000-00000000dd04")
    expect(res.success).toBe(true)
    expect(state.writes.some((w) => w.table === "final_documents" && w.op === "update")).toBe(true)
  })

  it("surfaces a database execution-lock rejection honestly when signing lands mid-flight", async () => {
    // App-level check passes (signer still pending at read time), but the
    // database trigger rejects the write because the last signature landed
    // first. The user gets a truthful failure, never a silent rewrite.
    state.opts.versionQueue = [{ ...VERSION, id: "v4", version_number: 4 }, { version_number: 4 }]
    state.opts.finalRow = { document_version_id: "v3" }
    state.opts.signerList = [{ status: "pending" }]
    state.opts.finalUpdateError = {
      message: "Executed final documents are immutable: re-pointing, swapping, or rolling back an executed final is not allowed",
    }
    await expect(
      finalizeDocument(AUDIT_ID, "00000000-0000-0000-0000-00000000dd04")
    ).rejects.toThrow(/Failed to finalize document: Executed final documents are immutable/)
    state.opts.finalUpdateError = null
  })
})

describe("getFinalDocuments", () => {
  it("returns finals with content, signers, and derived execution", async () => {
    state.opts.finalList = [{ id: "f1", document_type: "contract", document_version_id: VERSION_ID, finalized_at: "2026-01-01" }]
    state.opts.versionRow = { ...VERSION, content: "# Contract", generation_method: "assembled", created_at: "2026-01-01" }
    state.opts.signerList = [{ id: "s1", name: "A", email: "a@b.co", party_label: "buyer", status: "signed", signed_at: "2026-01-02" }]
    // version maybeSingle calls route through the queue when set.
    state.opts.versionQueue = [{ ...VERSION, content: "# Contract", generation_method: "assembled", created_at: "2026-01-01" }]
    const res = await getFinalDocuments(AUDIT_ID)
    expect(res.finals).toHaveLength(1)
    expect(res.finals[0].executed).toBe(true)
    expect(res.finals[0].content).toBe("# Contract")
    expect(res.versions).toEqual([])
  })
})

describe("completeDeal", () => {
  it("requires at least one final document", async () => {
    state.opts.finalList = []
    await expect(completeDeal(AUDIT_ID)).rejects.toThrow(/Finalize at least one/)
  })

  it("blocks on pending signatures bound to finals", async () => {
    state.opts.finalList = [{ document_type: "contract", document_version_id: VERSION_ID }]
    state.opts.signerList = [{ status: "signed" }, { status: "pending" }]
    await expect(completeDeal(AUDIT_ID)).rejects.toThrow(/Signing incomplete/)
  })

  it("completes when finals need no signatures or are fully signed", async () => {
    state.opts.finalList = [{ document_type: "contract", document_version_id: VERSION_ID }]
    state.opts.signerList = [{ status: "signed" }]
    const res = await completeDeal(AUDIT_ID)
    expect(res).toEqual({ success: true, status: "completed" })
    state.opts.signerList = []
    const res2 = await completeDeal(AUDIT_ID)
    expect(res2).toEqual({ success: true, status: "completed" })
  })

  it("is idempotent when already completed", async () => {
    state.opts.auditRow = { id: AUDIT_ID, status: "completed" }
    const res = await completeDeal(AUDIT_ID)
    expect(res).toEqual({ success: true, status: "completed" })
  })
})
