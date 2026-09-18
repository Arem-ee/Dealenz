"use client"

import { useState } from "react"
import { FileText, Check, Loader2, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/toast"
import { renderMarkdown } from "@/lib/markdown"
import { signInviteeDocument, declineInviteeDocument, type SignerView } from "@/app/sign/[token]/actions"

// Public invitee signing surface. No account, no deal access: everything is
// token-scoped server-side. This component collects intent only; the RPC
// decides. Enforceability is NOT claimed here (see product scope).
export function InviteeSignView({ token, initial }: { token: string; initial: SignerView }) {
  const [view, setView] = useState(initial)
  const [name, setName] = useState(initial.signerName)
  const [email, setEmail] = useState(initial.signerEmail)
  const [busy, setBusy] = useState(false)
  const [declined, setDeclined] = useState(false)
  const { showError, showSuccess } = useToast()

  async function handleSign() {
    setBusy(true)
    try {
      const res = await signInviteeDocument(token, name, email)
      if (!res.success) {
        showError(res.error ?? "Signing failed")
        return
      }
      showSuccess("Your signature was recorded.", "Signed")
      setView({ ...view, signStatus: "signed", signedAt: new Date().toISOString() })
    } catch (e) {
      showError(e instanceof Error ? e.message : "Signing failed")
    } finally {
      setBusy(false)
    }
  }

  async function handleDecline() {
    setBusy(true)
    try {
      const res = await declineInviteeDocument(token)
      if (!res.success) {
        showError(res.error ?? "Request failed")
        return
      }
      setDeclined(true)
    } catch (e) {
      showError(e instanceof Error ? e.message : "Request failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-4xl px-4 py-4 flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <span className="font-semibold">Dealenz signing</span>
          <span className="text-xs text-muted-foreground">· {view.partyLabel} · version {view.versionNumber}</span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 space-y-6">
        {view.superseded && view.signStatus === "pending" && (
          <div className="flex items-start gap-2 rounded-lg bg-warning/10 border border-warning/25 p-3 text-xs text-warning-foreground">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>A newer version of this document exists. Signing is paused until the new version is reviewed — ask the sender for a fresh invitation.</span>
          </div>
        )}

        <div className="rounded-lg border bg-muted/30 p-6 prose prose-sm max-w-none">
          {renderMarkdown(view.content)}
        </div>

        {view.signStatus === "signed" ? (
          <div className="space-y-2">
            <div className="flex items-center gap-3 text-success">
              <div className="rounded-full bg-success/10 p-2">
                <Check className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium">Your signature: complete{view.signedAt ? ` on ${new Date(view.signedAt).toLocaleDateString()}` : ""}.</p>
            </div>
            <p className="text-xs text-muted-foreground">
              {view.signedSigners >= view.totalSigners && view.totalSigners > 0
                ? "All required signatures complete. Document executed."
                : `Other required signatures: ${view.signedSigners} of ${view.totalSigners} complete. Execution: waiting for remaining signatures.`}
            </p>
          </div>
        ) : declined || view.signStatus === "declined" ? (
          <p className="text-sm text-muted-foreground">You declined this signing invitation.</p>
        ) : view.signStatus === "revoked" ? (
          <p className="text-sm text-muted-foreground">This invitation was revoked by the sender.</p>
        ) : (
          <div className="rounded-lg border bg-card p-6 space-y-4">
            <p className="text-sm font-medium">Sign as {view.signerName} ({view.partyLabel})</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="sign-name">Full name</Label>
                <Input id="sign-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sign-email">Email</Label>
                <Input id="sign-email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => void handleSign()} disabled={busy}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Sign document
              </Button>
              <Button variant="outline" onClick={() => void handleDecline()} disabled={busy}>
                Decline
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              This records your signature for this exact document version in the deal audit trail. It is a workflow record, not a legal determination of enforceability.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
