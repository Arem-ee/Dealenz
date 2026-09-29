import { createHash } from "node:crypto"

export interface ChainableRow {
  id: string
  createdAt: string
  eventType: string
  payload: unknown
}

export interface ChainedEntry extends ChainableRow {
  chainHash: string
}

// Tamper-evident chain: chainHash[i] = sha256(chainHash[i-1] + id +
// createdAt + eventType + JSON(payload)), seeded with GENESIS. Recomputing
// from the export detects any gap or edit: every later hash breaks.
export function chainEntries(rows: ChainableRow[]): { entries: ChainedEntry[]; headHash: string | null } {
  let prev = "GENESIS"
  const entries: ChainedEntry[] = []
  for (const r of rows) {
    const hash = createHash("sha256")
      .update(`${prev}|${r.id}|${r.createdAt}|${r.eventType}|${JSON.stringify(r.payload ?? {})}`, "utf8")
      .digest("hex")
    entries.push({ ...r, chainHash: hash })
    prev = hash
  }
  return { entries, headHash: entries.length > 0 ? prev : null }
}

export function verifyChain(entries: Array<Pick<ChainedEntry, "id" | "createdAt" | "eventType" | "payload" | "chainHash">>): boolean {
  let prev = "GENESIS"
  for (const e of entries) {
    const hash = createHash("sha256")
      .update(`${prev}|${e.id}|${e.createdAt}|${e.eventType}|${JSON.stringify(e.payload ?? {})}`, "utf8")
      .digest("hex")
    if (hash !== e.chainHash) return false
    prev = hash
  }
  return true
}
