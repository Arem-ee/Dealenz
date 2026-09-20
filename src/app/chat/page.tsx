import { Composer } from "@/components/chat/Composer"

export const dynamic = "force-dynamic"

export default function ChatNewPage() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-3xl flex-col px-4 py-8">
      <div className="flex-1">
        <h1 className="font-serif text-2xl font-semibold tracking-tight">Send us their contract.</h1>
        <p className="mt-1 text-sm text-muted-foreground">Paste it, drop the file, or describe the deal. We will route it correctly.</p>
      </div>
      <div className="mt-8">
        <Composer />
      </div>
    </div>
  )
}
