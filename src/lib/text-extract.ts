import mammoth from "mammoth"
import { sniffUploadMime } from "@/lib/validation/files"

// NOTE: pdf-parse (pdfjs-dist) must never be imported at module top level:
// it evaluates DOM-dependent code on import, which crashes server runtimes
// without a DOM (Vercel serverless: ReferenceError: DOMMatrix is not
// defined) and takes down every module that transitively imports this file.
// It is loaded lazily inside the PDF branch only.

const SUPPORTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]

const MAX_FILE_SIZE = 10 * 1024 * 1024

// Aggregate cap across all files in one analysis request: 10 files x 10MB
// must never mean 100MB resident per request.
export const MAX_TOTAL_UPLOAD_BYTES = 30 * 1024 * 1024

// Decompression guard: a small archive can expand enormously (zip bomb).
// Reject explicitly rather than silently truncating and analyzing a slice
// as if it were the whole document.
export const MAX_EXTRACTED_CHARS = 500_000

export function isSupportedFileType(mimeType: string): boolean {
  return SUPPORTED_TYPES.includes(mimeType)
}

export function isValidFileSize(size: number): boolean {
  return size > 0 && size <= MAX_FILE_SIZE
}

export async function extractTextFromBuffer(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  if (buffer.length === 0) {
    throw new Error("File is empty")
  }

  if (!isSupportedFileType(mimeType)) {
    throw new Error(`Unsupported file type: ${mimeType}`)
  }

  if (!isValidFileSize(buffer.length)) {
    throw new Error(`File exceeds maximum size of ${MAX_FILE_SIZE / 1024 / 1024}MB`)
  }

  // Never trust the client-supplied MIME or extension alone: the bytes must
  // recognizably match the declared type.
  const sniffed = sniffUploadMime(buffer)
  if (sniffed !== mimeType) {
    throw new Error("File content does not match its declared type")
  }

  let text: string
  switch (mimeType) {
    case "application/pdf": {
      const { PDFParse } = await import("pdf-parse")
      const parser = new PDFParse({ data: buffer, verbosity: 0 })
      const result = await parser.getText()
      text = result.text || ""
      break
    }

    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
      const result = await mammoth.extractRawText({ buffer })
      text = result.value || ""
      break
    }

    case "text/plain": {
      text = buffer.toString("utf-8")
      break
    }

    default:
      throw new Error(`Unsupported file type: ${mimeType}`)
  }

  if (text.length > MAX_EXTRACTED_CHARS) {
    throw new Error(
      `Extracted text exceeds the ${MAX_EXTRACTED_CHARS.toLocaleString()}-character limit; split the document and retry`
    )
  }
  return text
}
