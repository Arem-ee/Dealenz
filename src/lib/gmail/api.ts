// Live Gmail API layer (read + send). Server-side only: access tokens never
// reach the browser. Every call takes an explicit access token obtained
// from stored Gmail OAuth tokens (see ./tokens); refresh is the caller's
// responsibility via refreshAccessToken. Failures throw with actionable
// messages — never fabricated IDs, never silent success.

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me"

export interface GmailSendInput {
  to: string
  subject: string
  body: string
  threadId?: string | null
}

export interface GmailSendResult {
  id: string
  threadId: string | null
}

function rfc822(input: GmailSendInput): string {
  // Minimal RFC 822 message; headers are ASCII-safe here (subjects/bodies
  // pass through as UTF-8 bytes, which Gmail accepts).
  const lines = [
    `To: ${input.to}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    `Subject: ${input.subject}`,
    "",
    input.body,
  ]
  return Buffer.from(lines.join("\r\n"), "utf-8").toString("base64url")
}

async function gmailFetch(accessToken: string, path: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(`${GMAIL_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  })
  if (res.status === 401 || res.status === 403) {
    throw new Error("Gmail authorization failed — re-authorize Gmail")
  }
  if (res.status === 429) {
    throw new Error("Gmail rate limit reached — try again shortly")
  }
  if (!res.ok) {
    throw new Error(`Gmail request failed (HTTP ${res.status})`)
  }
  return res.json() as Promise<unknown>
}

export async function sendGmailMessage(accessToken: string, input: GmailSendInput): Promise<GmailSendResult> {
  if (!input.to.includes("@")) throw new Error("Invalid recipient")
  const body: Record<string, unknown> = { raw: rfc822(input) }
  if (input.threadId) body.threadId = input.threadId
  const data = (await gmailFetch(accessToken, "/messages/send", {
    method: "POST",
    body: JSON.stringify(body),
  })) as { id?: string; threadId?: string | null }
  if (!data || typeof data.id !== "string") throw new Error("Gmail send returned no message id")
  return { id: data.id, threadId: data.threadId ?? null }
}

export interface GmailThreadRef {
  id: string
  snippet?: string
}

export async function listGmailThreads(
  accessToken: string,
  input: { query?: string; maxResults?: number; pageToken?: string } = {}
): Promise<{ threads: GmailThreadRef[]; nextPageToken?: string; resultSizeEstimate?: number }> {
  const params = new URLSearchParams()
  if (input.query) params.set("q", input.query)
  params.set("maxResults", String(Math.min(Math.max(input.maxResults ?? 10, 1), 50)))
  if (input.pageToken) params.set("pageToken", input.pageToken)
  const data = (await gmailFetch(accessToken, `/threads?${params.toString()}`, { method: "GET" })) as {
    threads?: Array<{ id?: string; snippet?: string }>
    nextPageToken?: string
    resultSizeEstimate?: number
  }
  const threads = (data.threads ?? [])
    .filter((t) => typeof t.id === "string")
    .map((t) => ({ id: t.id as string, snippet: t.snippet }))
  return { threads, nextPageToken: data.nextPageToken, resultSizeEstimate: data.resultSizeEstimate }
}

export interface GmailMessage {
  id: string
  threadId: string
  subject: string | null
  from: string | null
  date: string | null
  snippet: string | null
  bodyText: string | null
}

export async function getGmailThread(accessToken: string, threadId: string): Promise<{ id: string; messageIds: string[] }> {
  if (!threadId) throw new Error("Invalid thread id")
  const data = (await gmailFetch(accessToken, `/threads/${encodeURIComponent(threadId)}?format=minimal`, { method: "GET" })) as {
    id?: string
    messages?: Array<{ id?: string }>
  }
  if (!data || typeof data.id !== "string") throw new Error("Gmail thread not found")
  return {
    id: data.id,
    messageIds: (data.messages ?? []).filter((m) => typeof m.id === "string").map((m) => m.id as string),
  }
}

function header(headers: Array<{ name?: string; value?: string }> | undefined, name: string): string | null {
  const found = (headers ?? []).find((h) => h.name?.toLowerCase() === name)
  return typeof found?.value === "string" ? found.value : null
}

function decodeBodyText(payload: unknown): string | null {
  // Walk MIME parts depth-first, preferring text/plain; base64url decode.
  const stack: unknown[] = [payload]
  let fallback: string | null = null
  while (stack.length > 0) {
    const part = stack.pop() as {
      mimeType?: string
      body?: { data?: string }
      parts?: unknown[]
    } | null
    if (!part || typeof part !== "object") continue
    if (Array.isArray(part.parts)) {
      for (let i = part.parts.length - 1; i >= 0; i--) stack.push(part.parts[i])
    }
    const data = part.body?.data
    if (typeof data !== "string" || data.length === 0) continue
    try {
      const text = Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8")
      if (part.mimeType === "text/plain") return text
      if (fallback === null) fallback = text
    } catch {
      // Undecodable part: keep walking, never fail the whole message.
    }
  }
  return fallback
}

export async function getGmailMessage(accessToken: string, messageId: string): Promise<GmailMessage> {
  if (!messageId) throw new Error("Invalid message id")
  const data = (await gmailFetch(accessToken, `/messages/${encodeURIComponent(messageId)}?format=full`, { method: "GET" })) as {
    id?: string
    threadId?: string
    snippet?: string
    payload?: { headers?: Array<{ name?: string; value?: string }> } & unknown
  }
  if (!data || typeof data.id !== "string") throw new Error("Gmail message not found")
  return {
    id: data.id,
    threadId: typeof data.threadId === "string" ? data.threadId : "",
    subject: header(data.payload?.headers, "subject"),
    from: header(data.payload?.headers, "from"),
    date: header(data.payload?.headers, "date"),
    snippet: typeof data.snippet === "string" ? data.snippet : null,
    bodyText: decodeBodyText(data.payload),
  }
}
