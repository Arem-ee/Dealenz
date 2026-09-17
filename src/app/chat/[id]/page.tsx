import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { ChatThread } from "@/components/chat/ChatThread"
import { getConversation, listMessages } from "@/lib/conversation/store"
import { toThreadMessage } from "@/lib/chat/types"

export const dynamic = "force-dynamic"

export default async function ChatThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  const conv = await getConversation(supabase as never, user.id, id)
  if (!conv) {
    // Try as audit id fallback (legacy deals without conversation)
    const { data: audit } = await supabase.from("audits").select("id, title").eq("id", id).eq("user_id", user.id).maybeSingle()
    if (audit) {
      return <ChatThread threadId={id} auditId={id} initialMessages={[]} />
    }
    redirect("/chat")
  }
  const rows = await listMessages(supabase as never, user.id, id, 50)
  const messages = rows.map((r) => toThreadMessage(r as never))
  return <ChatThread threadId={id} auditId={conv.attached_audit_id} initialMessages={messages} />
}
