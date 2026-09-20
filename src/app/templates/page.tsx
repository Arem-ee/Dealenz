import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

/**
 * Removed per product strategy: the hardcoded template list was twelve
 * labels that all funneled into the identical flow (the template id only
 * set source_type) plus unsubstantiated "Vetted" trust claims. Deal entry
 * is the composer and /audit/new. Preserved in git history.
 */
export default async function TemplatesPage() {
  redirect("/dashboard")
}
