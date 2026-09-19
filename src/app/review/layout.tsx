import { AppShell } from "@/components/app-shell"

export const dynamic = "force-dynamic"

// Lawyer review keeps its own back links and split pane, and gains the
// shared sidebar + account menu from the authenticated shell.
export default async function ReviewLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AppShell>{children}</AppShell>
}
