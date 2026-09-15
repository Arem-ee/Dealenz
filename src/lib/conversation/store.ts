// Conversation persistence (Phase 10).
//
// Smallest model that satisfies the prompt: conversations own messages,
// both scoped to user_id, RLS enforced, audit attachment re-validated
// server-side every turn. No second pipeline, no client-trusted state.

import type { SupabaseClient } from "@supabase/supabase-js"

export interface ConversationRow {
  id: string
  user_id: string
  title: string
  attached_audit_id: string | null
  created_at: string
  updated_at: string
}

export type MessageType = "message" | "consultation_turn" | "inline_confirmation"

export interface MessageRow {
  id: string
  conversation_id: string
  user_id: string
  role: "user" | "assistant"
  content: string
  operation: string | null
  intent: string | null
  objective: string | null
  message_type: MessageType
  metadata: Record<string, unknown>
  created_at: string
}

type Client = SupabaseClient

function titleFrom(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim().slice(0, 80)
  return normalized.length > 0 ? normalized : "New conversation"
}

export async function createConversation(
  client: Client,
  userId: string,
  input: { title?: string; attachedAuditId?: string | null; firstText: string }
): Promise<ConversationRow> {
  const title = titleFrom(input.title ?? input.firstText)
  const { data, error } = await client
    .from("conversations")
    .insert({
      user_id: userId,
      title,
      attached_audit_id: input.attachedAuditId ?? null,
    })
    .select("id, user_id, title, attached_audit_id, created_at, updated_at")
    .single()
  if (error || !data) throw new Error("Failed to create conversation")
  return data as ConversationRow
}

export async function listConversations(client: Client, userId: string): Promise<ConversationRow[]> {
  const { data, error } = await client
    .from("conversations")
    .select("id, user_id, title, attached_audit_id, created_at, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(30)
  if (error) throw new Error("Failed to list conversations")
  return (data ?? []) as ConversationRow[]
}

export async function getConversation(client: Client, userId: string, conversationId: string): Promise<ConversationRow | null> {
  const { data, error } = await client
    .from("conversations")
    .select("id, user_id, title, attached_audit_id, created_at, updated_at")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .maybeSingle()
  if (error) throw new Error("Failed to load conversation")
  return (data as ConversationRow | null) ?? null
}

export async function touchConversation(client: Client, userId: string, conversationId: string): Promise<void> {
  const { error } = await client
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId)
    .eq("user_id", userId)
  if (error) throw new Error("Failed to touch conversation")
}

export async function addMessage(
  client: Client,
  input: {
    conversationId: string
    userId: string
    role: "user" | "assistant"
    content: string
    operation?: string | null
    intent?: string | null
    objective?: string | null
    messageType?: MessageType
    metadata?: Record<string, unknown>
  }
): Promise<MessageRow> {
  const { data, error } = await client
    .from("conversation_messages")
    .insert({
      conversation_id: input.conversationId,
      user_id: input.userId,
      role: input.role,
      content: input.content.slice(0, 8000),
      operation: input.operation ?? null,
      intent: input.intent ?? null,
      objective: input.objective ?? null,
      message_type: input.messageType ?? "message",
      metadata: input.metadata ?? {},
    })
    .select("id, conversation_id, user_id, role, content, operation, intent, objective, message_type, metadata, created_at")
    .single()
  if (error || !data) throw new Error("Failed to store message")
  return data as MessageRow
}

export async function listMessages(client: Client, userId: string, conversationId: string, limit = 20): Promise<MessageRow[]> {
  const { data, error } = await client
    .from("conversation_messages")
    .select("id, conversation_id, user_id, role, content, operation, intent, objective, message_type, metadata, created_at")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(Math.min(Math.max(limit, 1), 50))
  if (error) throw new Error("Failed to list messages")
  return (data ?? []) as MessageRow[]
}
