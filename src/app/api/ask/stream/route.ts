import { NextRequest } from "next/server"
import { answerQuestion } from "@/lib/conversation/request"
import { STANDARD_CREDIT_POLICY } from "@/lib/credits/pricing"
import { publicErrorMessage } from "@/lib/safe-error"
import { buildAskPorts, persistAskAssistant, prepareAskTurn, type AskInput } from "@/app/ask/actions"

export const dynamic = "force-dynamic"

type StreamEvent =
  | { type: "started"; conversationId: string }
  | { type: "stage"; label: string }
  | { type: "token"; delta: string }
  | { type: "done"; response: unknown; conversationId: string; replaced: boolean }
  | { type: "error"; error: string }

function encodeEvent(event: StreamEvent): Uint8Array {
  const kind = event.type
  return new TextEncoder().encode(`event: ${kind}\ndata: ${JSON.stringify(event)}\n\n`)
}

/**
 * Streaming twin of the ask server action: identical gating, ports, ledger,
 * and persistence (via the shared prepare/ports/persist helpers), but the
 * model's answer tokens flow as SSE while they generate instead of arriving
 * in one block at the end.
 *
 * Credit safety is unchanged: the pipeline reserves before the model call
 * and finalizes after it; a mid-stream provider failure voids the
 * reservation exactly like a buffered failure. The client keeps partial
 * tokens plus the error, same as any other failed attempt (nothing charged).
 */
export async function POST(req: NextRequest): Promise<Response> {
  let input: AskInput
  try {
    const body = (await req.json()) as Partial<AskInput>
    input = {
      text: typeof body.text === "string" ? body.text : "",
      auditId: typeof body.auditId === "string" ? body.auditId : undefined,
      conversationId: typeof body.conversationId === "string" ? body.conversationId : undefined,
      history: Array.isArray(body.history) ? body.history : undefined,
      idempotencyKey: typeof body.idempotencyKey === "string" ? body.idempotencyKey : undefined,
    }
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: StreamEvent) => controller.enqueue(encodeEvent(event))
      const fail = (error: string) => {
        send({ type: "error", error })
        controller.close()
      }
      let prepared: Awaited<ReturnType<typeof prepareAskTurn>>
      try {
        prepared = await prepareAskTurn(input)
      } catch (err) {
        const message = err instanceof Error ? err.message : "Something went wrong. Please try again."
        fail(message === "CONSENT_REQUIRED" ? message : publicErrorMessage(err, "I couldn't prepare your answer. Please try again — nothing was charged for this attempt."))
        return
      }
      if ("early" in prepared) {
        send({ type: "done", response: prepared.early, conversationId: prepared.early.conversationId ?? "", replaced: false })
        controller.close()
        return
      }
      const { supabase, user, conversation, ledger, serverHistory } = prepared.ready
      // Commit notice first: the conversation row and user turn already exist
      // (prepare persists them), so a client that loses the stream mid-flight
      // can resume against this id instead of re-running turn setup (which
      // would orphan a duplicate conversation and user row).
      send({ type: "started", conversationId: conversation.id })
      let streamed = ""
      const sendToken = (delta: string) => {
        streamed += delta
        send({ type: "token", delta })
      }
      try {
        const ports = await buildAskPorts(supabase, user, ledger)
        // Stage narration wraps the context ports: each emits only when it
        // actually runs (audit-attached turns), so unattached questions skip
        // straight to thinking.
        const staged = {
          ...ports,
          loadContext: async (auditId: string) => {
            send({ type: "stage", label: "Reading your deal…" })
            return ports.loadContext(auditId)
          },
          loadFacts: async (auditId: string) => {
            send({ type: "stage", label: "Pulling the findings…" })
            return ports.loadFacts(auditId)
          },
          loadKnowledge: async (envelope: Parameters<typeof ports.loadKnowledge>[0]) => {
            send({ type: "stage", label: "Checking standing rules…" })
            return ports.loadKnowledge(envelope)
          },
        }
        send({ type: "stage", label: "Thinking…" })
        const response = await answerQuestion({
          text: input.text,
          auditId: conversation.attached_audit_id ?? input.auditId,
          userId: user.id,
          history: serverHistory,
          idempotencyKey: input.idempotencyKey,
          onToken: sendToken,
          ports: { ...staged, ledger, policy: STANDARD_CREDIT_POLICY },
        })
        await persistAskAssistant(supabase, user.id, conversation.id, response)
        send({
          type: "done",
          response,
          conversationId: conversation.id,
          // Repair path replaces streamed attempt-1 text with the final
          // answer: the client swaps the bubble instead of appending.
          replaced: response.type === "answer" && streamed.length > 0 && response.text !== streamed,
        })
        controller.close()
      } catch (err) {
        fail(publicErrorMessage(err, "I couldn't prepare your answer. Please try again — nothing was charged for this attempt."))
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}
