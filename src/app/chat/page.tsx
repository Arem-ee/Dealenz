import { Composer } from "@/components/chat/Composer"

export const dynamic = "force-dynamic"

export default function ChatNewPage() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-3xl flex-col px-4 py-8">
      <div className="flex-1">
        <h1 className="text-2xl font-semibold tracking-tight">Start a new conversation</h1>
        <p className="mt-1 text-sm text-muted-foreground">Ask a question, paste a deal, or drop a file. We will route it correctly.</p>
      </div>
      <div className="mt-8">
        <Composer />
      </div>
    </div>
  )
}
