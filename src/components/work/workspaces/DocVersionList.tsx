"use client"

import type { DocVersion } from "./types"

const METHOD_LABEL: Record<string, string> = {
  ai: "AI draft",
  template: "Template",
  assembled: "Assembled",
  lawyer_revision: "Lawyer revision",
}

function methodLabel(method: string | null): string {
  if (!method) return "Draft"
  return METHOD_LABEL[method] ?? method
}

// Version history for one document family: current version first, previous
// versions below. Provenance is the row itself (method, status, timestamp).
export function DocVersionList({ versions, previewChars = 280 }: {
  versions: DocVersion[]
  previewChars?: number
}) {
  if (versions.length === 0) return null
  const [current, ...previous] = versions
  return (
    <div className="space-y-2">
      <article className="rounded-xl border bg-card p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Current version {current.version_number}</span>
          <span className="rounded-full border px-2 py-0.5">{methodLabel(current.generation_method)}</span>
          {current.status && current.status !== "draft" && (
            <span className="rounded-full border px-2 py-0.5 capitalize">{current.status.replaceAll("_", " ")}</span>
          )}
          {current.created_at && <span>{new Date(current.created_at).toLocaleDateString()}</span>}
        </div>
        {current.content && (
          <p className="mt-2 font-serif text-sm leading-relaxed whitespace-pre-wrap">
            {current.content.slice(0, previewChars)}{current.content.length > previewChars ? "…" : ""}
          </p>
        )}
      </article>
      {previous.length > 0 && (
        <details className="rounded-xl border px-4 py-2">
          <summary className="cursor-pointer py-1 text-xs font-medium text-muted-foreground">
            Previous versions ({previous.length})
          </summary>
          <div className="space-y-2 py-2">
            {previous.map((v) => (
              <div key={v.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">v{v.version_number}</span>
                <span className="rounded-full border px-2 py-0.5">{methodLabel(v.generation_method)}</span>
                {v.status && v.status !== "draft" && <span className="capitalize">{v.status.replaceAll("_", " ")}</span>}
                {v.created_at && <span>{new Date(v.created_at).toLocaleDateString()}</span>}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
