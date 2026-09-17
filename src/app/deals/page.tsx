import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

/**
 * Folded into Home. The thread list now lives on /dashboard (chat-first
 * landing: composer + recent threads), so there is a single Deals surface
 * instead of two names for the same list. The old grid implementation is
 * preserved in git history.
 */
export default async function DealsPage() {
  redirect("/dashboard")
}
