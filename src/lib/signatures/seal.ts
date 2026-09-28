import { createHash } from "node:crypto"

export interface SealClient {
  from(table: string): any // eslint-disable-line @typescript-eslint/no-explicit-any
}

export interface VersionSeal {
  hash: string
  sealedAt: string | null
  tampered: boolean
}

/** SHA-256 over the exact version content. Pure and deterministic. */
export function hashVersionContent(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex")
}

/**
 * Ensures a tamper seal for an executed version (first-writer-wins) and
 * verifies current content against it. Ownership is checked before any
 * read: a version outside the caller's audits yields null, never a seal.
 *
 * Returns null when the version is missing, foreign, or seal infrastructure
 * is unavailable — callers treat null as "no seal to show" (today's UI),
 * never as tampered. Tampered is true only on positive hash mismatch.
 */
export async function ensureVersionSeal(
  client: SealClient,
  input: { auditId: string; versionId: string; userId: string }
): Promise<VersionSeal | null> {
  try {
    const { data: version } = await client
      .from("document_versions")
      .select("id, content, seal_hash, sealed_at")
      .eq("id", input.versionId)
      .eq("audit_id", input.auditId)
      .eq("user_id", input.userId)
      .maybeSingle()
    const row = version as { id: string; content: string; seal_hash: string | null; sealed_at: string | null } | null
    if (!row || typeof row.content !== "string") return null
    const current = hashVersionContent(row.content)
    if (row.seal_hash) {
      return { hash: row.seal_hash, sealedAt: row.sealed_at, tampered: row.seal_hash !== current }
    }
    const sealedAt = new Date().toISOString()
    const { data: updated } = await client
      .from("document_versions")
      .update({ seal_hash: current, sealed_at: sealedAt })
      .eq("id", input.versionId)
      .is("seal_hash", null)
      .select("seal_hash, sealed_at")
    const won = (Array.isArray(updated) ? updated[0] : updated) as { seal_hash: string; sealed_at: string } | null
    if (won?.seal_hash) return { hash: won.seal_hash, sealedAt: won.sealed_at, tampered: false }
    // Lost the race: someone sealed first — reread their seal.
    const { data: reread } = await client
      .from("document_versions")
      .select("seal_hash, sealed_at")
      .eq("id", input.versionId)
      .maybeSingle()
    const fresh = reread as { seal_hash: string; sealed_at: string } | null
    if (!fresh?.seal_hash) return null
    return { hash: fresh.seal_hash, sealedAt: fresh.sealed_at, tampered: fresh.seal_hash !== current }
  } catch {
    return null
  }
}
