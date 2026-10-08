import type { SupabaseClient } from "@supabase/supabase-js"

// Lapsed-invite flip: pending invitations past expiry become 'expired',
// and owners learn through the notification center. Idempotent: only
// pending rows match, each flips once. Best-effort notifications — the
// flip stands regardless.

const BATCH = 200

export async function expireLapsedInvites(svc: SupabaseClient): Promise<{ expired: number; notified: number }> {
  const { data: rows, error } = await svc
    .from("document_signers")
    .select("id, name, email, audit_id")
    .eq("status", "pending")
    .not("expires_at", "is", null)
    .lt("expires_at", new Date().toISOString())
    .limit(BATCH)
  if (error) throw new Error(error.message)
  const ids = ((rows ?? []) as Array<{ id: string }>).map((r) => String(r.id))
  if (ids.length === 0) return { expired: 0, notified: 0 }

  const { error: updateError } = await svc
    .from("document_signers")
    .update({ status: "expired" })
    .in("id", ids)
    .eq("status", "pending")
  if (updateError) throw new Error(updateError.message)

  let notified = 0
  try {
    const { notifyDealOwner } = await import("@/lib/notifications/notify")
    for (const r of ((rows ?? []) as Array<{ id: string; name: string; email: string; audit_id: string }>)) {
      try {
        await notifyDealOwner(svc, r.audit_id, {
          type: "signing",
          title: "Signing link expired",
          body: `${r.name || r.email || "An invitee"}'s invitation lapsed. Re-send or revoke it in Signing.`,
          link: "/signing",
          category: "deadline_digests",
        })
        notified += 1
      } catch {
        // One missed notification never blocks the rest.
      }
    }
  } catch {
    // Notification import failure never fails the pass.
  }
  return { expired: ids.length, notified }
}
