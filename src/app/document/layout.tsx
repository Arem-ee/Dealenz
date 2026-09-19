import { AppShell } from "@/components/app-shell"

export const dynamic = "force-dynamic"

// The document reader keeps its own thread-aware back links and gains the
// shared sidebar + account menu from the authenticated shell.
export default async function DocumentLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AppShell>{children}</AppShell>
}
