"use client"

import { useState } from "react"
import { FileText, Loader2, Upload } from "lucide-react"
import { getGuestContent, uploadStagedRedline, type GuestPortalState } from "@/app/guest/[token]/actions"

// Guest portal island: version reading for every grant, redline upload for
// the primary owner. Uploads stage outside version control — the owner
// accepts them into new versions or rejects them.
export function GuestPortalView({ token, portal }: { token: string; portal: GuestPortalState }) {
  const [openId, setOpenId] = useState<string | null>(portal.versions[0]?.id ?? null)
  const [content, setContent] = useState<Record<string, string>>({})
  const [contentError, setContentError] = useState<string | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploaded, setUploaded] = useState(false)

  const canUpload = portal.scope === "uploader" && portal.isPrimaryOwner

  async function open(id: string) {
    if (openId === id) {
      setOpenId(null)
      return
    }
    setOpenId(id)
    if (content[id] !== undefined) return
    setLoadingId(id)
    setContentError(null)
    try {
      const res = await getGuestContent(token, id)
      if (!res.ok) throw new Error(res.error)
      setContent((prev) => ({
        ...prev,
        [id]: res.content + (res.truncated ? "\n\n[Truncated for portal viewing — request the full text from the sender.]" : ""),
      }))
    } catch (err) {
      setContentError(err instanceof Error ? err.message : "Couldn't load that document.")
    } finally {
      setLoadingId(null)
    }
  }

  async function upload(formData: FormData) {
    if (uploading) return
    setUploading(true)
    setUploadError(null)
    try {
      const res = await uploadStagedRedline(token, formData)
      if (!res.ok) throw new Error(res.error)
      setUploaded(true)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed.")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="mt-6 space-y-4">
      <section aria-label="Shared documents">
        <h2 className="text-sm font-semibold">Documents</h2>
        {portal.versions.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">No documents shared yet.</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {portal.versions.map((v) => (
              <li key={v.id} className="border border-border">
                <button
                  type="button"
                  onClick={() => void open(v.id)}
                  aria-expanded={openId === v.id}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="truncate text-[13px] font-medium">
                      {v.documentType.replace(/-/g, " ")} · v{v.versionNumber}
                    </span>
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{v.status ?? ""}</span>
                </button>
                {openId === v.id ? (
                  <div className="border-t border-border px-3 py-2.5">
                    {loadingId === v.id ? (
                      <p className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
                      </p>
                    ) : content[v.id] !== undefined ? (
                      <p className="max-h-96 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed">{content[v.id]}</p>
                    ) : (
                      <p role="alert" className="text-xs text-destructive">{contentError ?? "Couldn't load that document."}</p>
                    )}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {canUpload ? (
        <section aria-label="Upload redlines" className="border border-border p-4">
          <h2 className="text-sm font-semibold">Upload your redlines</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            PDF, DOCX, or TXT up to 10MB. Files stage for the owner — nothing changes until they accept.
          </p>
          {uploaded ? (
            <p role="status" className="mt-2 text-xs font-medium text-green-700">
              Staged — the owner will accept it into a new version or reject it.
            </p>
          ) : (
            <form
              className="mt-2 flex flex-wrap items-center gap-2"
              action={(formData) => void upload(formData)}
            >
              <input
                type="file"
                name="file"
                accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                aria-label="Redline file"
                className="min-w-0 flex-1 text-xs text-muted-foreground"
              />
              <button
                type="submit"
                disabled={uploading}
                className="inline-flex h-8 items-center gap-1.5 bg-primary px-3 text-[11px] font-semibold text-primary-foreground disabled:opacity-40"
              >
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {uploading ? "Staging." : "Stage file"}
              </button>
            </form>
          )}
          {uploadError ? <p role="alert" className="mt-2 text-xs text-destructive">{uploadError}</p> : null}
        </section>
      ) : null}
    </div>
  )
}
