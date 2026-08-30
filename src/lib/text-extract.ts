import { PDFParse } from "pdf-parse"
import mammoth from "mammoth"

const SUPPORTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]

const MAX_FILE_SIZE = 10 * 1024 * 1024

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

  switch (mimeType) {
    case "application/pdf": {
      const parser = new PDFParse({ data: buffer, verbosity: 0 })
      const result = await parser.getText()
      return result.text || ""
    }

    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
      const result = await mammoth.extractRawText({ buffer })
      return result.value || ""
    }

    case "text/plain": {
      return buffer.toString("utf-8")
    }

    default:
      throw new Error(`Unsupported file type: ${mimeType}`)
  }
}
