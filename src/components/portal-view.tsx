"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { renderMarkdown } from "@/lib/markdown"
import { FileText, Check, Loader2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

interface SharedDocument {
  content: string
  audit_id: string
  document_type: string
  business_name: string
  signed: boolean
  signed_by_name: string
  signed_by_email: string
  signed_at: string | null
}

const docLabels: Record<string, string> = {
  proposal: "Proposal",
  sow: "Scope of Work",
  contract: "Contract",
  checklist: "Checklist",
}

interface PortalViewProps {
  document: SharedDocument
  token: string
}

export function PortalView({ document: doc, token }: PortalViewProps) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [signing, setSigning] = useState(false)
  const [signError, setSignError] = useState<string | null>(null)
  const [signed, setSigned] = useState(doc.signed)
  const [signatureInfo, setSignatureInfo] = useState(
    doc.signed
      ? { name: doc.signed_by_name, email: doc.signed_by_email, at: doc.signed_at }
      : null
  )

  const handleSign = async () => {
    if (!name.trim() || !email.trim()) return
    setSigning(true)
    setSignError(null)

    try {
      const supabase = createClient()
      const { data, error } = await supabase.rpc("sign_shared_document", {
        p_token: token,
        p_name: name.trim(),
        p_email: email.trim(),
      })

      if (error) {
        setSignError(error.message)
        return
      }

      const result = data as Array<{ success: boolean; message: string }>
      if (!result?.[0]?.success) {
        setSignError(result?.[0]?.message ?? "Signing failed")
        return
      }

      setSigned(true)
      setSignatureInfo({
        name: name.trim(),
        email: email.trim(),
        at: new Date().toISOString(),
      })
    } catch {
      setSignError("An unexpected error occurred")
    } finally {
      setSigning(false)
    }
  }

  const label = docLabels[doc.document_type] ?? doc.document_type

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-4xl px-4 py-4 flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <span className="font-semibold">Dealenz</span>
          {doc.business_name && (
            <>
              <span className="text-muted-foreground mx-1">/</span>
              <span className="text-sm text-muted-foreground">
                Shared by {doc.business_name}
              </span>
            </>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold">{label}</h1>
        </div>

        <div className="rounded-lg border bg-muted/30 p-6 prose prose-sm max-w-none">
          {renderMarkdown(doc.content)}
        </div>

        <div className="rounded-lg border bg-card p-6">
          {signed && signatureInfo ? (
            <div className="flex items-center gap-3 text-green-600">
              <div className="rounded-full bg-green-100 p-2">
                <Check className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium">Signed by {signatureInfo.name}</p>
                <p className="text-sm text-muted-foreground">
                  {signatureInfo.email} &mdash; {new Date(signatureInfo.at!).toLocaleDateString()}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <h3 className="font-semibold">Sign this document</h3>
              <p className="text-sm text-muted-foreground">
                By signing, you acknowledge receipt and acceptance of this {label.toLowerCase()}.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="sign-name" className="block text-sm font-medium mb-1">
                    Full name
                  </label>
                  <input
                    id="sign-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="Your full name"
                  />
                </div>
                <div>
                  <label htmlFor="sign-email" className="block text-sm font-medium mb-1">
                    Email address
                  </label>
                  <input
                    id="sign-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="your@email.com"
                    autoComplete="email"
                  />
                </div>
              </div>
              {signError && (
                <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {signError}
                </div>
              )}
              <Button
                onClick={handleSign}
                disabled={signing || !name.trim() || !email.trim()}
              >
                {signing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Signing...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Sign & Accept
                  </>
                )}
              </Button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Powered by Dealenz &mdash; AI audit and protection package generator
        </p>
      </main>
    </div>
  )
}
