import { NewDealComposer } from "@/components/chat/NewDealComposer"

export const dynamic = "force-dynamic"

export default function ChatNewPage() {
  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col overflow-y-auto px-4 py-8">
      <div className="flex-1">
        <h1 className=" text-2xl font-semibold tracking-tight">Send us their contract.</h1>
        <p className="mt-1 text-sm text-muted-foreground">Paste it, drop the file, or describe the deal. We will route it correctly.</p>
      </div>
      <div className="mt-8">
        <NewDealComposer />
      </div>
    </div>
  )
}
