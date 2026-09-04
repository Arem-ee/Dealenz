// Knowledge storage access + ingestion boundary (Phase 5C).
//
// Reads go through RLS-governed queries (published rows are world-readable,
// drafts are admin-visible only — see migration 00022). Writes are
// admin-gated inside these functions via the caller's session metadata (same
// is_admin convention as the lawyer verification flow), so no entry point can
// accidentally expose privileged writes. There is no browser-facing ingestion
// UI in this phase; these functions serve tests, future ops tooling, and a
// future admin surface.

import { parseKnowledgeItem, type KnowledgeItem, type KnowledgeStatus } from "./schema"

// Minimal structural client surface. Both the real Supabase client and test
// doubles satisfy this; every result is validated before use.
export interface KnowledgeStoreClient {
  auth: {
    getUser(): Promise<{
      data: { user: { id: string; user_metadata?: Record<string, unknown> | null } | null }
    }>
  }
  from(table: string): any // eslint-disable-line @typescript-eslint/no-explicit-any
}

type AnyClient = KnowledgeStoreClient

async function requireAdmin(client: AnyClient) {
  const { data: { user } } = await client.auth.getUser()
  if (!user) throw new Error("You must be signed in")
  const isAdmin = (user.user_metadata as Record<string, unknown> | null)?.is_admin === true
  if (!isAdmin) throw new Error("Knowledge ingestion requires administrator access")
  return user
}

function toRow(item: KnowledgeItem): Record<string, unknown> {
  return {
    id: item.id,
    item_key: item.itemKey,
    version: item.version,
    title: item.title,
    kind: item.kind,
    authority: item.authority,
    jurisdiction_scope: item.jurisdiction.scope,
    jurisdiction_code: item.jurisdiction.code,
    source_name: item.provenance.source,
    source_reference: item.provenance.sourceReference,
    source_authority: item.provenance.sourceAuthority,
    retrieved_at: item.provenance.retrievedAt,
    publisher: item.provenance.publisher,
    original_uri: item.provenance.originalUri,
    checksum: item.provenance.checksum,
    effective_from: item.effectiveFrom,
    effective_to: item.effectiveTo,
    status: item.status,
    content: item.content,
    applicability: JSON.parse(JSON.stringify(item.applicability)) as unknown,
    superseded_by_version: item.supersededByVersion,
  }
}

function fromRow(row: Record<string, unknown>): KnowledgeItem {
  return parseKnowledgeItem({
    id: row.id,
    itemKey: row.item_key,
    version: row.version,
    title: row.title,
    kind: row.kind,
    authority: row.authority,
    jurisdiction: { scope: row.jurisdiction_scope, code: row.jurisdiction_code },
    provenance: {
      source: row.source_name,
      sourceReference: row.source_reference,
      sourceAuthority: row.source_authority,
      retrievedAt: row.retrieved_at,
      publisher: row.publisher,
      originalUri: row.original_uri,
      checksum: row.checksum,
    },
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    status: row.status,
    content: row.content,
    applicability: row.applicability ?? {},
    supersededByVersion: row.superseded_by_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })
}

// Lists one page of published items for resolution. Never throws for missing
// tables or query failures: resolution degrades to an empty candidate set.
export async function fetchPublishedKnowledge(
  client: AnyClient,
  limit = 200
): Promise<KnowledgeItem[]> {
  try {
    const { data, error } = await client
      .from("knowledge_items")
      .select("*")
      .eq("status", "published")
      .order("updated_at", { ascending: false })
      .limit(Math.min(Math.max(limit, 1), 500))
    if (error || !Array.isArray(data)) return []
    const items: KnowledgeItem[] = []
    for (const row of data) {
      try {
        items.push(fromRow(row as Record<string, unknown>))
      } catch {
        // Skip malformed rows rather than breaking resolution.
      }
    }
    return items
  } catch {
    return []
  }
}

// Full version history for an item key, newest first. Recoverability for
// superseded and withdrawn knowledge.
export async function listItemVersions(client: AnyClient, itemKey: string): Promise<KnowledgeItem[]> {
  const { data, error } = await client
    .from("knowledge_items")
    .select("*")
    .eq("item_key", itemKey)
    .order("version", { ascending: false })
  if (error || !Array.isArray(data)) throw new Error("Failed to load knowledge versions")
  return (data as Record<string, unknown>[]).map(fromRow)
}

export interface IngestInput {
  itemKey: string
  title: string
  kind: KnowledgeItem["kind"]
  authority: KnowledgeItem["authority"]
  jurisdiction: KnowledgeItem["jurisdiction"]
  provenance: KnowledgeItem["provenance"]
  effectiveFrom: string
  effectiveTo?: string | null
  content: string
  applicability?: KnowledgeItem["applicability"]
}

// Validates and inserts the next version of an item. New versions start as
// draft unless explicitly published; publishing while another version is
// published is rejected (supersede first). Never overwrites history.
export async function ingestKnowledgeItem(
  client: AnyClient,
  input: IngestInput,
  initialStatus: KnowledgeStatus = "draft"
): Promise<KnowledgeItem> {
  const user = await requireAdmin(client)
  if (!["draft", "verified", "published"].includes(initialStatus)) {
    throw new Error("New knowledge versions must start as draft, verified, or published")
  }
  const { data: existing, error: readError } = await client
    .from("knowledge_items")
    .select("version,status")
    .eq("item_key", input.itemKey)
    .order("version", { ascending: false })
  if (readError) throw new Error("Failed to check knowledge version history")
  const rows = (Array.isArray(existing) ? existing : []) as Array<{ version: number; status: string }>
  const nextVersion = rows.length === 0 ? 1 : Math.max(...rows.map((r) => r.version)) + 1
  if (initialStatus === "published" && rows.some((r) => r.status === "published")) {
    throw new Error("Another published version exists — supersede it before publishing")
  }
  const now = new Date().toISOString()
  const item = parseKnowledgeItem({
    id: `pending`,
    itemKey: input.itemKey,
    version: nextVersion,
    title: input.title,
    kind: input.kind,
    authority: input.authority,
    jurisdiction: input.jurisdiction,
    provenance: { ...input.provenance, retrievedAt: input.provenance.retrievedAt || now },
    effectiveFrom: input.effectiveFrom,
    effectiveTo: input.effectiveTo ?? null,
    status: initialStatus,
    content: input.content,
    applicability: input.applicability ?? {},
    supersededByVersion: null,
    createdAt: now,
    updatedAt: now,
  })
  const row = toRow(item)
  delete row.id
  const { data: inserted, error: insertError } = await client
    .from("knowledge_items")
    .insert({ ...row, created_by: user.id })
    .select("*")
    .single()
  if (insertError || !inserted) throw new Error("Failed to store knowledge item")
  return fromRow(inserted as Record<string, unknown>)
}

const ALLOWED_TRANSITIONS: Record<KnowledgeStatus, KnowledgeStatus[]> = {
  draft: ["verified", "withdrawn"],
  verified: ["published", "withdrawn"],
  published: ["superseded", "withdrawn"],
  superseded: ["withdrawn"],
  withdrawn: [],
}

// Moves an item through its lifecycle. Superseding requires pointing at the
// newer version; history rows are updated in place only for status bookkeeping,
// never rewritten.
export async function transitionKnowledgeStatus(
  client: AnyClient,
  id: string,
  to: KnowledgeStatus,
  supersededByVersion?: number
): Promise<KnowledgeItem> {
  await requireAdmin(client)
  const { data, error } = await client.from("knowledge_items").select("*").eq("id", id).single()
  if (error || !data) throw new Error("Knowledge item not found")
  const current = fromRow(data as Record<string, unknown>)
  if (!ALLOWED_TRANSITIONS[current.status].includes(to)) {
    throw new Error(`Cannot transition knowledge from ${current.status} to ${to}`)
  }
  if (to === "superseded") {
    if (
      typeof supersededByVersion !== "number" ||
      !Number.isInteger(supersededByVersion) ||
      supersededByVersion <= current.version
    ) {
      throw new Error("Superseding requires a newer version number")
    }
  }
  if (to === "published") {
    const { data: siblings } = await client
      .from("knowledge_items")
      .select("id")
      .eq("item_key", current.itemKey)
      .eq("status", "published")
    const others = (Array.isArray(siblings) ? siblings : []).filter(
      (r) => (r as Record<string, unknown>).id !== current.id
    )
    if (others.length > 0) {
      throw new Error("Another published version exists — supersede it before publishing")
    }
  }
  const patch: Record<string, unknown> = { status: to, updated_at: new Date().toISOString() }
  if (to === "superseded") patch.superseded_by_version = supersededByVersion
  const { data: updated, error: updateError } = await client
    .from("knowledge_items")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single()
  if (updateError || !updated) throw new Error("Failed to update knowledge status")
  return fromRow(updated as Record<string, unknown>)
}
