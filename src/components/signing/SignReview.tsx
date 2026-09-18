"use client"

interface SignReviewProps {
  version: { id: string; status: string; contentHash: string | null; version_number: number; document_type: string }
  parties: Array<{ name: string; role: string; email: string }>
  assumptions: string[]
  missing: string[]
  onApprove: () => void
  onCancel: () => void
  approving?: boolean
}

export function SignReview({ version, parties, assumptions, missing, onApprove, onCancel, approving }: SignReviewProps) {
  return (
    <div className="border rounded-lg p-4 bg-card">
      <h3 className="font-serif text-lg">What you are signing</h3>
      <p className="text-sm text-muted-foreground">Version {version.version_number} — {version.document_type} — hash {version.contentHash ?? "pending"}</p>
      <p className="text-sm mt-2">Status: {version.status}</p>
      <div className="mt-3">
        <h4 className="font-medium text-sm">Who signs</h4>
        <ul className="text-sm list-disc pl-5">
          {parties.map((p) => (
            <li key={p.email}>{p.role}: {p.name} ({p.email})</li>
          ))}
        </ul>
      </div>
      {missing.length > 0 && (
        <div className="mt-3">
          <h4 className="font-medium text-sm">Important unresolved items</h4>
          <ul className="text-sm list-disc pl-5 text-amber-700">
            {missing.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      )}
      {assumptions.length > 0 && (
        <div className="mt-3">
          <h4 className="font-medium text-sm">Assumptions</h4>
          <ul className="text-sm list-disc pl-5">
            {assumptions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-xs text-muted-foreground mt-3">Locking consequence: once fully signed, this version becomes locked and immutable. Changes require a new version/redraft.</p>
      <div className="flex gap-2 mt-4">
        <button onClick={onApprove} disabled={approving} className="px-4 py-2 bg-primary text-primary-foreground rounded">
          {approving ? "Signing…" : "Sign"}
        </button>
        <button onClick={onCancel} className="px-4 py-2 border rounded">
          Cancel
        </button>
      </div>
    </div>
  )
}
