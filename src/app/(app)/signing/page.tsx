import { SigningView } from "@/components/signing/signing-view"

export const dynamic = "force-dynamic"

export default async function SigningPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <SigningView />
    </div>
  )
}
