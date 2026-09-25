import { AppShell } from "@/components/app-shell"

export const dynamic = "force-dynamic"

// Settings shares the authenticated shell instead of rendering chromeless.
export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AppShell bare>{children}</AppShell>
}
