import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { getGmailMessage, getGmailThread, listGmailThreads, sendGmailMessage } from "./api"

// Live Gmail API layer, tested against stubbed fetch: real endpoints,
// real parsing, honest failures. No fabricated provider IDs anywhere.

const fetchMock = vi.fn()

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function b64url(text: string): string {
  return Buffer.from(text, "utf-8").toString("base64url")
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("gmail api", () => {
  it("sends RFC822 base64url and returns the provider id", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { id: "msg_1", threadId: "thr_1" }))
    const res = await sendGmailMessage("at", { to: "a@b.co", subject: "Hi", body: "Hello" })
    expect(res).toEqual({ id: "msg_1", threadId: "thr_1" })
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect((init.method as string)).toBe("POST")
    const payload = JSON.parse(String(init.body)) as { raw: string }
    expect(typeof payload.raw).toBe("string")
  })

  it("rejects bad recipients before any network call", async () => {
    await expect(sendGmailMessage("at", { to: "not-an-email", subject: "Hi", body: "x" })).rejects.toThrow(/Invalid recipient/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("maps 401 to re-authorize and throws on missing ids", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { error: "x" }))
    await expect(sendGmailMessage("bad", { to: "a@b.co", subject: "Hi", body: "x" })).rejects.toThrow(/re-authorize/)
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {}))
    await expect(sendGmailMessage("at", { to: "a@b.co", subject: "Hi", body: "x" })).rejects.toThrow(/no message id/)
  })

  it("lists threads with bounds and mapping", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { threads: [{ id: "t1", snippet: "s" }, { noid: true }], nextPageToken: "n", resultSizeEstimate: 2 })
    )
    const res = await listGmailThreads("at", { query: "newer_than:7d", maxResults: 99 })
    expect(res.threads).toEqual([{ id: "t1", snippet: "s" }])
    expect(res.nextPageToken).toBe("n")
    const [url] = fetchMock.mock.calls[0] as [string]
    expect(url).toContain("maxResults=50")
    expect(url).toContain("q=newer_than")
  })

  it("reads message headers and prefers text/plain bodies", async () => {
    const payload = {
      headers: [
        { name: "Subject", value: "Renewal" },
        { name: "From", value: "them@co.test" },
        { name: "Date", value: "Mon, 01 Jan 2024 00:00:00 +0000" },
      ],
      parts: [
        { mimeType: "text/html", body: { data: b64url("<b>hi</b>") } },
        { mimeType: "text/plain", body: { data: b64url("plain renewal 2027-03-01") } },
      ],
    }
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { id: "m1", threadId: "t1", snippet: "sn", payload }))
    const msg = await getGmailMessage("at", "m1")
    expect(msg.subject).toBe("Renewal")
    expect(msg.from).toBe("them@co.test")
    expect(msg.bodyText).toBe("plain renewal 2027-03-01")
  })

  it("reads thread message ids for reply observation", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { id: "t1", messages: [{ id: "m1" }, { id: "m2" }] }))
    const thread = await getGmailThread("at", "t1")
    expect(thread).toEqual({ id: "t1", messageIds: ["m1", "m2"] })
    fetchMock.mockResolvedValueOnce(jsonResponse(404, {}))
    await expect(getGmailThread("at", "missing")).rejects.toThrow()
  })
})
