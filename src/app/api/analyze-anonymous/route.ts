import { NextRequest, NextResponse } from "next/server"

import { extractAndValidate } from "@/lib/ai/extract"
import { analyzeRiskForDealType } from "@/lib/ai/risk-analysis"
import { isSupportedFileType, isValidFileSize, extractTextFromBuffer, MAX_TOTAL_UPLOAD_BYTES } from "@/lib/text-extract"
import { toAnonymousError } from "@/lib/safe-error"
import { normalizeAnonymousDealType } from "@/lib/deal-type"
import { getTrustedClientIp, checkAnonymousRateLimit } from "@/lib/rate-limit-anon"
import { createClient } from "@/lib/supabase/server"
import { reportAIFallback, reportError } from "@/lib/logger"
import { AIProviderError } from "@/lib/ai/errors"

const ANONYMOUS_LIMIT = 3
const ANONYMOUS_WINDOW_SECONDS = 60 * 60
const MAX_ANONYMOUS_INPUT_LENGTH = 100_000
const MAX_ANONYMOUS_FILES = 10
// Unbounded JSON bodies would let one request exhaust memory before any
// validation runs; legitimate prompts are far smaller than this.
const MAX_ANONYMOUS_JSON_CHARS = 500_000

function getAnonymousKey(req: NextRequest): string {
  // Platform-derived IP only. x-anonymous-fp is self-asserted and must not
  // be identity: rotating it previously minted fresh buckets.
  return `anon:${getTrustedClientIp(req.headers)}`
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
  const supabase = await createClient()

  // Cheap pre-parse gate: refuse absurd bodies before Next buffers them.
  // Slack above the aggregate file cap covers multipart framing overhead.
  const contentLength = Number(req.headers.get("content-length") ?? "0")
  if (Number.isFinite(contentLength) && contentLength > MAX_TOTAL_UPLOAD_BYTES + 1024 * 1024) {
    return NextResponse.json(
      { error: "Request body too large." },
      { status: 413 }
    )
  }

  const contentType = req.headers.get("content-type") || ""
  let prompt = ""
  let dealTypeInput = ""
  const files: Array<{ name: string; type: string; size: number; arrayBuffer: () => Promise<ArrayBuffer> }> = []

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
          size: file.size,
          arrayBuffer: () => file.arrayBuffer(),
        })
      }
    }
  } else {
    const text = await req.text()
    if (text.length > MAX_ANONYMOUS_JSON_CHARS) {
      return NextResponse.json(
        { error: "Request body too large." },
        { status: 413 }
      )
    }
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

  const declaredBytes = files.reduce((sum, f) => sum + f.size, 0)
  if (declaredBytes > MAX_TOTAL_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `Combined upload too large. Maximum ${MAX_TOTAL_UPLOAD_BYTES / 1024 / 1024}MB per analysis.` },
      { status: 413 }
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

  // The analysis window is bounded; report truncation explicitly instead of
  // silently treating a truncated slice as the original document.
  let truncated = false
  let originalLength = combinedInput.length
  if (combinedInput.length > MAX_ANONYMOUS_INPUT_LENGTH) {
    combinedInput = combinedInput.slice(0, MAX_ANONYMOUS_INPUT_LENGTH)
    truncated = true
  } else {
    originalLength = combinedInput.length
  }

  // Single durable check-and-consume for this well-formed attempt: after
  // all validation 400s/413s above, before any AI spend below. Fail-closed:
  // limiter errors deny rather than silently granting unlimited AI.
  const quota = await checkAnonymousRateLimit(supabase, key, ANONYMOUS_LIMIT, ANONYMOUS_WINDOW_SECONDS)
  if (!quota.allowed) {
    return NextResponse.json(
      { error: "Usage limit reached. Create an account to continue analyzing deals." },
      { status: 429 }
    )
  }

  try {
    // Quick Review stays on the lower-cost path and never touches the
    // authenticated Claude models, even when they are configured.
    const validation = await extractAndValidate(combinedInput, dealType, "quick_review")

    if (!validation.valid) {
      return insufficientInputResponse()
    }

    const riskResult = await analyzeRiskForDealType(validation.extractedData!, dealType, "quick_review")

    if (riskResult.usedFallback) {
      // Durable degradation record; the user-facing payload is unchanged.
      await reportAIFallback(supabase, {
        surface: "quick_review",
        provider: "risk-analysis",
        operation: "document_analysis",
        servedByFallback: true,
      })
    }

    const response: {
      success: boolean
      data: typeof validation.extractedData
      riskReport: typeof riskResult.report
      usedFallback: boolean
      truncated: boolean
      originalLength: number
    } = {
      success: true,
      data: validation.extractedData!,
      riskReport: riskResult.report,
      usedFallback: riskResult.usedFallback,
      truncated,
      originalLength,
    }

    return NextResponse.json(response, { status: 200 })
  } catch (err) {
    // Provider failures become durable warn/error records with metadata
    // only; users still receive the fixed safe-error string.
    if (err instanceof AIProviderError) {
      await reportAIFallback(supabase, {
        surface: "quick_review",
        provider: err.provider,
        category: err.category,
        operation: "document_analysis",
        servedByFallback: false,
      })
    } else {
      await reportError(supabase, {
        phase: "anonymous_analysis",
        error: err,
        severity: "error",
      })
    }
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
