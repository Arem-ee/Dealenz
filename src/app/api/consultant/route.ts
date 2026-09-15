import { NextRequest, NextResponse } from "next/server"
import { handleConsultantTurn } from "@/lib/consultant/handler"
import { createClient } from "@/lib/supabase/server"
import { callAISurface } from "@/lib/ai/client"
import { STANDARD_CREDIT_POLICY } from "@/lib/credits/pricing"

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const { text, conversationId, jurisdiction, idempotencyKey } = body as Record<string, unknown>
  if (typeof text !== "string" || text.trim().length === 0) {
    return NextResponse.json({ error: "A message is required" }, { status: 400 })
  }
  const supabase = await createClient()
  const ledger = {
    rpc: async (functionName: string, args: Record<string, unknown> = {}) => {
      const result = await (supabase.rpc as unknown as (fn: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>)(functionName, args)
      return { data: result.data, error: result.error }
    },
  }
  try {
    const result = await handleConsultantTurn(
      {
        text,
        conversationId: typeof conversationId === "string" ? conversationId : undefined,
        jurisdiction: typeof jurisdiction === "string" ? jurisdiction : null,
        idempotencyKey: typeof idempotencyKey === "string" ? idempotencyKey : undefined,
      },
      {
        aiCaller: async ({ systemPrompt, userContent, maxTokens }) => {
          const { text: responseText, meta } = await callAISurface("authenticated", { systemPrompt, userContent, temperature: 0.4, maxTokens })
          return { text: responseText, usage: meta.usage, provider: meta.primary.provider, model: meta.primary.model }
        },
        ledger,
        policy: STANDARD_CREDIT_POLICY,
      }
    )
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Consultant failed"
    if (message.includes("signed in") || message.includes("verify your email")) {
      return NextResponse.json({ error: message }, { status: 401 })
    }
    if (message.includes("Conversation not found")) {
      return NextResponse.json({ error: message }, { status: 404 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
