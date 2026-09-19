import { AppShell } from "@/components/app-shell"

export const dynamic = "force-dynamic"

// Library shares the authenticated shell (sidebar + account menu on desktop,
// bottom tabs on mobile) instead of rendering chromeless.
export default async function LibraryLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AppShell>{children}</AppShell>
}
