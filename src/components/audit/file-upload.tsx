"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { FileText, Loader2, Trash2, Upload, X } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { sanitizeFilename } from "@/lib/validation/files"
import { attachFileMetadata, removeFileMetadata, logAuditEvent } from "@/app/audit/[id]/actions"

const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".txt"]
const MAX_FILE_SIZE = 10 * 1024 * 1024

interface UploadedFile {
  name: string
  size: number
  type: string
  path: string
  uploaded_at: string
}

interface FileUploadProps {
  auditId: string
  userId: string
  initialFiles: UploadedFile[]
}

export function FileUpload({ auditId, userId, initialFiles }: FileUploadProps) {
  const router = useRouter()
  const supabase = createClient()
  const [files, setFiles] = useState<UploadedFile[]>(initialFiles)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const validateFile = (file: File): string | null => {
    const ext = "." + file.name.split(".").pop()?.toLowerCase()
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return `Invalid file type. Allowed: PDF, DOCX, TXT`
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File too large. Max size: 10MB`
    }
    return null
  }

  const uploadFile = useCallback(async (file: File) => {
    const validationError = validateFile(file)
    if (validationError) {
      setError(validationError)
      return
    }

    setError(null)
    setUploading(true)
    setProgress(0)

    try {
      // Sanitize before storage so the stored key can never contain path
      // traversal, control characters, or oversized names. The server
      // re-validates and rejects anything that is not exactly this form.
      const safeName = sanitizeFilename(file.name)
      const filePath = `${userId}/${auditId}/${safeName}`
      const storagePath = `audit-files/${filePath}`

      const { error: uploadError } = await supabase.storage
        .from("audit-files")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        })

      if (uploadError) throw new Error(uploadError.message)

      setProgress(100)

      const updatedFiles = await attachFileMetadata(auditId, {
        name: safeName,
        size: file.size,
        type: file.type,
        path: storagePath,
      })

      setFiles(updatedFiles as unknown as UploadedFile[])
      router.refresh()
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed"
      setError(msg)
      logAuditEvent(auditId, userId, "storage_upload", "failure", msg)
    } finally {
      setUploading(false)
      setProgress(0)
    }
  }, [auditId, userId, supabase, router])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) uploadFile(droppedFile)
  }, [uploadFile])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) uploadFile(selected)
    e.target.value = ""
  }, [uploadFile])

  const handleRemove = useCallback(async (file: UploadedFile) => {
    try {
      const storagePath = file.path.replace("audit-files/", "")
      await supabase.storage.from("audit-files").remove([storagePath])
      await removeFileMetadata(auditId, file.path)
      setFiles((prev) => prev.filter((f) => f.path !== file.path))
      router.refresh()
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to remove file"
      setError(msg)
      logAuditEvent(auditId, userId, "storage_delete", "failure", msg)
    }
  }, [auditId, supabase, router])

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="text-sm font-medium">Upload files</label>
        <p className="text-xs text-muted-foreground">PDF, DOCX, or TXT up to 10MB</p>
      </div>

      <div
        className={cn(
          "relative flex flex-col items-center gap-2 rounded-lg border-2 border-dashed p-8 transition-colors",
          dragOver ? "border-primary bg-primary/5" : "border-border",
          uploading && "pointer-events-none opacity-50"
        )}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <Upload className="h-6 w-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Drag & drop a file here, or click to browse
        </p>
        <Button variant="outline" size="sm" disabled={uploading} asChild>
          <label>
            <FileText className="h-4 w-4" />
            Browse files
            <input
              type="file"
              className="hidden"
              accept=".pdf,.docx,.txt"
              onChange={handleFileSelect}
              disabled={uploading}
            />
          </label>
        </Button>

        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-lg">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Uploading... {progress}%</span>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          <X className="h-4 w-4 shrink-0" />
          {error}
          <button className="ml-auto font-medium hover:underline" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}

      {files.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Uploaded files ({files.length})
          </p>
          {files.map((file) => (
            <div
              key={file.path}
              className="flex items-center gap-3 rounded-md border p-3"
            >
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">{formatSize(file.size)}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => handleRemove(file)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {files.length === 0 && !uploading && (
        <div className="flex flex-col items-center gap-2 py-8 text-center border border-dashed rounded-lg">
          <FileText className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No files uploaded</p>
          <p className="text-xs text-muted-foreground">
            Upload PDF, DOCX, or TXT files to include in your audit
          </p>
        </div>
      )}
    </div>
  )
}
