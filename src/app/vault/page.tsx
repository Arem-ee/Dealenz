import { redirect } from "next/navigation"

// Vault was renamed to Library. This redirect preserves old links.
export default function VaultRedirect() {
  redirect("/library")
}
