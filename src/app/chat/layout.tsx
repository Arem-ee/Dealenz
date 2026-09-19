import { AppShell } from "@/components/app-shell"

export const dynamic = "force-dynamic"

// Chat threads share the authenticated shell. One-level-deep thread views
// additionally get the shell back bar (see BackBar).
export default async function ChatLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AppShell>{children}</AppShell>
}
