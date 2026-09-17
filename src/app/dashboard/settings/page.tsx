import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

/**
 * Consolidated into the top-level Settings container (/settings). Kept as a
 * redirect so any bookmarked or in-app /dashboard/settings link lands on the
 * single Settings destination instead of a duplicate screen.
 */
export default async function SettingsPage() {
  redirect("/settings")
}
