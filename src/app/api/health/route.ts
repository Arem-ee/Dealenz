import { NextResponse } from "next/server"
import { checkHealth } from "@/lib/health/checks"

export const dynamic = "force-dynamic"

export async function GET() {
  const health = await checkHealth()
  return NextResponse.json(health, { status: health.status === "down" ? 503 : 200 })
}
