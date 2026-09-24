import { AppShell } from "@/components/app-shell"

export const dynamic = "force-dynamic"

export default async function WelcomeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AppShell>{children}</AppShell>
}
