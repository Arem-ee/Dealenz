import { NextRequest, NextResponse } from "next/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { verifyStripeSignature, verifyPaystackSignature } from "@/lib/payments/verify"
import { calculateRevenueShare } from "@/lib/payments/revenue"

export async function POST(req: NextRequest) {
  const body = await req.text()
  const provider = (req.headers.get("x-provider") ?? "stripe").toLowerCase() as "stripe" | "paystack"
  const signature = req.headers.get("x-signature") ?? req.headers.get("stripe-signature") ?? req.headers.get("x-paystack-signature") ?? ""

  const secret = provider === "stripe" ? process.env.STRIPE_WEBHOOK_SECRET ?? "" : process.env.PAYSTACK_WEBHOOK_SECRET ?? ""
  if (!secret) return NextResponse.json({ error: "Webhook not configured" }, { status: 500 })

  let verified = false
  if (provider === "stripe") verified = verifyStripeSignature(body, signature, secret)
  else verified = verifyPaystackSignature(body, signature, secret)

  if (!verified) return NextResponse.json({ error: "Invalid signature" }, { status: 400 })

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const providerEventId = (payload.id as string) ?? (payload.event_id as string) ?? ""
  if (!providerEventId) return NextResponse.json({ error: "Missing event id" }, { status: 400 })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return NextResponse.json({ error: "Service not configured" }, { status: 500 })

  const svc = createServiceClient(url, key)

  // Idempotency: provider_webhook_events unique (provider, provider_event_id)
  const { error: insertErr } = await svc.from("provider_webhook_events").insert({ provider, provider_event_id: providerEventId, payload, status: "received" })
  if (insertErr && insertErr.message.includes("duplicate")) {
    return NextResponse.json({ ok: true, duplicate: true })
  }
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

  // Extract service_order_id from custom metadata (payload.metadata.service_order_id)
  const meta = (payload.metadata as Record<string, unknown>) ?? (payload.data as Record<string, unknown>)?.metadata as Record<string, unknown> ?? {}
  const serviceOrderId = (meta.service_order_id as string) ?? (payload.service_order_id as string) ?? null
  const amountMinor = typeof (payload.amount as number) === "number" ? (payload.amount as number) : typeof (payload.data as Record<string, unknown>)?.amount === "number" ? ((payload.data as Record<string, unknown>).amount as number) : null
  const currency = (payload.currency as string) ?? ((payload.data as Record<string, unknown>)?.currency as string) ?? "USD"

  if (serviceOrderId && amountMinor) {
    try {
      const { platformFeeMinor, lawyerPayoutMinor } = calculateRevenueShare(amountMinor)
      // Update service_orders to paid (requires verified signature flag)
      await svc.from("service_orders").update({ status: "paid", provider, provider_reference: providerEventId, provider_event_id: providerEventId, provider_signature_verified: true, amount_minor: amountMinor, platform_fee_minor: platformFeeMinor, lawyer_payout_minor: lawyerPayoutMinor, status_updated_at: new Date().toISOString() }).eq("id", serviceOrderId)
      // Insert service_payments audit row
      const { data: order } = await svc.from("service_orders").select("audit_id, user_id, consultation_request_id").eq("id", serviceOrderId).maybeSingle()
      if (order) {
        const o = order as { audit_id: string; user_id: string; consultation_request_id: string }
        const { data: cr } = await svc.from("consultation_requests").select("lawyer_id").eq("id", o.consultation_request_id).maybeSingle()
        const lawyerId = (cr as { lawyer_id: string | null } | null)?.lawyer_id ?? null
        await svc.from("service_payments").insert({
          service_order_id: serviceOrderId,
          audit_id: o.audit_id,
          user_id: o.user_id,
          lawyer_id: lawyerId,
          provider,
          provider_reference: providerEventId,
          provider_event_id: providerEventId,
          amount_minor: amountMinor,
          currency,
          platform_fee_minor: platformFeeMinor,
          lawyer_payout_minor: lawyerPayoutMinor,
          status: "succeeded",
          idempotency_key: `payment:${provider}:${providerEventId}`,
          provider_payload: payload,
        })
        await svc.from("provider_webhook_events").update({ status: "processed" }).eq("provider", provider).eq("provider_event_id", providerEventId)
      }
    } catch (e) {
      await svc.from("provider_webhook_events").update({ status: "failed" }).eq("provider", provider).eq("provider_event_id", providerEventId)
      return NextResponse.json({ error: e instanceof Error ? e.message : "Processing failed" }, { status: 500 })
    }
  } else {
    await svc.from("provider_webhook_events").update({ status: "processed" }).eq("provider", provider).eq("provider_event_id", providerEventId)
  }

  return NextResponse.json({ ok: true })
}
