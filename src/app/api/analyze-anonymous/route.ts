import { NextRequest, NextResponse } from "next/server"

import { extractAndValidate } from "@/lib/ai/extract"
import { analyzeRiskForDealType } from "@/lib/ai/risk-analysis"
import { isSupportedFileType, isValidFileSize, extractTextFromBuffer } from "@/lib/text-extract"
import { toAnonymousError } from "@/lib/safe-error"

const ANONYMOUS_LIMIT = 3
const ANONYMOUS_WINDOW_MS = 60 * 60 * 1000
const MAX_ANONYMOUS_INPUT_LENGTH = 100_000
const MAX_ANONYMOUS_FILES = 10

interface RateEntry {
  count: number
  resetAt: number
}

const anonymousRateLimits = new Map<string, RateEntry>()

function getAnonymousKey(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  const ip = xff || req.headers.get("x-real-ip") || "unknown-ip"
  const fingerprint = req.headers.get("x-anonymous-fp") || "no-fp"
  return `${ip}:${fingerprint}`
}

function normalizeAnonymousDealType(input?: string): "freelance" | "generic" | "lease" {
  if (input === "freelance") return "freelance"
  if (input === "lease") return "lease"
  // Unknown or absent input takes the adaptive generic path, never a
  // specialized vertical. The landing UI always sends an explicit value.
  return "generic"
}

function insufficientInputResponse() {
  return NextResponse.json({
    success: false,
    insufficientInput: true,
    message: "That doesn't look like a deal yet. Paste a client email, contract clause, lease terms, or describe the agreement in your own words. The more detail you give, the better the analysis.",
  }, { status: 200 })
}

export async function POST(req: NextRequest) {
  const key = getAnonymousKey(req)
  const now = Date.now()
  const existing = anonymousRateLimits.get(key)
  if (existing && existing.resetAt > now) {
    if (existing.count >= ANONYMOUS_LIMIT) {
      return NextResponse.json(
        { error: "Usage limit reached. Create an account to continue analyzing deals." },
        { status: 429 }
      )
    }
  } else {
    anonymousRateLimits.set(key, { count: 0, resetAt: now + ANONYMOUS_WINDOW_MS })
  }

  const contentType = req.headers.get("content-type") || ""
  let prompt = ""
  let dealTypeInput = ""
  const files: Array<{ name: string; type: string; arrayBuffer: () => Promise<ArrayBuffer> }> = []

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData()
    prompt = formData.get("prompt")?.toString() ?? ""
    dealTypeInput = formData.get("dealType")?.toString() ?? ""
    for (const fileEntry of Array.from(formData.entries())) {
      const [, file] = fileEntry
      if (file instanceof File && file.size > 0 && fileEntry[0].toString().startsWith("files")) {
        files.push({
          name: file.name,
          type: file.type,
          arrayBuffer: () => file.arrayBuffer(),
        })
      }
    }
  } else {
    const text = await req.text()
    let body: { prompt?: string; dealType?: string } = {}
    try {
      body = JSON.parse(text)
    } catch {
      body = {}
    }
    prompt = body.prompt ?? ""
    dealTypeInput = body.dealType ?? ""
  }

  const dealType = normalizeAnonymousDealType(dealTypeInput)

  if (files.length > MAX_ANONYMOUS_FILES) {
    return NextResponse.json(
      { error: `Too many files. Maximum ${MAX_ANONYMOUS_FILES} files per analysis.` },
      { status: 400 }
    )
  }

  const inputParts: string[] = []

  if (prompt.trim().length > 0) {
    inputParts.push(prompt.trim())
  }

  for (const file of files) {
    if (!isSupportedFileType(file.type)) {
      continue
    }
    const buffer = Buffer.from(await file.arrayBuffer())
    if (!isValidFileSize(buffer.length)) {
      return NextResponse.json(
        { error: `File ${file.name} exceeds maximum size of 10MB` },
        { status: 400 }
      )
    }
    try {
      const text = await extractTextFromBuffer(buffer, file.type)
      if (text.trim()) inputParts.push(text.trim())
    } catch {
    }
  }

  let combinedInput = inputParts.join("\n\n---\n\n")

  if (combinedInput.trim().length === 0) {
    return NextResponse.json(
      { error: "No content to analyze. Provide text or upload a PDF, DOCX, or TXT file." },
      { status: 400 }
    )
  }

  if (combinedInput.length > MAX_ANONYMOUS_INPUT_LENGTH) {
    combinedInput = combinedInput.slice(0, MAX_ANONYMOUS_INPUT_LENGTH)
  }

  if (!anonymousRateLimits.has(key) || anonymousRateLimits.get(key)!.resetAt <= now) {
    anonymousRateLimits.set(key, { count: 1, resetAt: now + ANONYMOUS_WINDOW_MS })
  } else {
    const entry = anonymousRateLimits.get(key)!
    entry.count += 1
    anonymousRateLimits.set(key, entry)
  }

  try {
    // Quick Review stays on the lower-cost path and never touches the
    // authenticated Claude models, even when they are configured.
    const validation = await extractAndValidate(combinedInput, dealType, "quick_review")

    if (!validation.valid) {
      return insufficientInputResponse()
    }

    const riskResult = await analyzeRiskForDealType(validation.extractedData!, dealType, "quick_review")

    const response: {
      success: boolean
      data: typeof validation.extractedData
      riskReport: typeof riskResult.report
      usedFallback: boolean
    } = {
      success: true,
      data: validation.extractedData!,
      riskReport: riskResult.report,
      usedFallback: riskResult.usedFallback,
    }

    return NextResponse.json(response, { status: 200 })
  } catch (err) {
    const { publicMessage } = toAnonymousError(err)
    return NextResponse.json({ error: publicMessage }, { status: 500 })
  }
}

async function safeParseJSON(req: NextRequest): Promise<{ prompt?: string; dealType?: string }> {
  try {
    return await req.json()
  } catch {
    return {}
  }
}

export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed. Use POST." },
    { status: 405 }
  )
}
