"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { Copy, Check, FileText, Loader2, RefreshCw, Eye, Share2, ExternalLink } from "lucide-react"
import type { GeneratedDocument, DocumentType } from "@/lib/generate"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { renderMarkdown } from "@/lib/markdown"
import { PdfExport } from "@/components/audit/pdf-export"
import { LegalDisclaimer } from "@/components/legal-disclaimer"
import { AnimateIn } from "@/components/animate-in"
import { DraftBadge } from "@/components/draft-badge"
import { createShareToken, getShareStatus, logDocumentActivity, markDocumentReviewed, getDocumentReviewedStatus } from "@/app/audit/[id]/actions"

interface ShareInfo {
  id: string
  document_type: string
  token: string
  created_at: string
  revoked_at: string | null
  signature: { signed_by_name: string; signed_by_email: string; signed_at: string } | null
}

interface ProtectionPackageProps {
  documents: GeneratedDocument[]
  onRegenerate: () => Promise<void>
  regenerating: boolean
  riskScore?: number
  riskLevel?: string | null
  auditId: string
}

const tabs: { key: DocumentType; label: string }[] = [
  { key: "proposal", label: "Proposal" },
  { key: "sow", label: "Scope of Work" },
  { key: "contract", label: "Contract" },
  { key: "checklist", label: "Checklist" },
]

export function ProtectionPackage({
  documents,
  onRegenerate,
  regenerating,
  riskScore,
  riskLevel,
  auditId,
}: ProtectionPackageProps) {
  const [activeTab, setActiveTab] = useState<DocumentType>("proposal")
  const [copied, setCopied] = useState(false)
  const [reviewed, setReviewed] = useState<Set<DocumentType>>(new Set())
  const contentEndRef = useRef<HTMLDivElement>(null)
  const [shareInfo, setShareInfo] = useState<Record<string, ShareInfo>>({})
  const [sharing, setSharing] = useState(false)
  const [shareCopied, setShareCopied] = useState<string | null>(null)
  const hasMounted = useRef(false)
  const viewedTabsRef = useRef<Set<DocumentType>>(new Set())
  const reviewedTabsRef = useRef<Set<DocumentType>>(new Set())

  const activeDoc = documents.find((d) => d.type === activeTab) ?? documents[0]

  useEffect(() => {
    getShareStatus(auditId).then((res) => {
      if (res.success && res.tokens) {
        const active: Record<string, ShareInfo> = {}
        for (const t of res.tokens) {
          const existing = active[t.document_type]
          if (!existing || new Date(t.created_at) > new Date(existing.created_at)) {
            if (!t.revoked_at) {
              active[t.document_type] = t
            }
          }
        }
        setShareInfo(active)
      }
    })
    getDocumentReviewedStatus(auditId).then((types) => {
      if (types.length > 0) {
        setReviewed(new Set(types as DocumentType[]))
      }
    })
  }, [auditId])

  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true
      return
    }
    if (!activeDoc || viewedTabsRef.current.has(activeDoc.type)) return
    viewedTabsRef.current.add(activeDoc.type)
    logDocumentActivity(auditId, activeDoc.type, "document_viewed").catch(() => {
      viewedTabsRef.current.delete(activeDoc.type)
    })
  }, [activeDoc, auditId])

  const markReviewed = useCallback((documentType: DocumentType) => {
    setReviewed((prev) => new Set(prev).add(documentType))
    if (reviewedTabsRef.current.has(documentType)) return
    reviewedTabsRef.current.add(documentType)
    Promise.all([
      logDocumentActivity(auditId, documentType, "document_reviewed"),
      markDocumentReviewed(auditId, documentType),
    ]).catch(() => {
      reviewedTabsRef.current.delete(documentType)
    })
  }, [auditId])

  const handleCopy = useCallback(async () => {
    if (!activeDoc) return
    try {
      await navigator.clipboard.writeText(activeDoc.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API not available
    }
  }, [activeDoc])

  useEffect(() => {
    const el = contentEndRef.current
    if (!el || reviewed.has(activeTab)) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          markReviewed(activeTab)
          observer.disconnect()
        }
      },
      { rootMargin: "0px", threshold: 0.9 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [activeTab, markReviewed, reviewed])

  const handleTabChange = (key: DocumentType) => {
    setActiveTab(key)
  }

  const handleMarkReviewed = () => {
    markReviewed(activeTab)
  }

  const handleShare = async () => {
    setSharing(true)
    try {
      const res = await createShareToken(auditId, activeTab)
      if (res.success && res.shareUrl) {
        setShareInfo((prev) => ({
          ...prev,
          [activeTab]: {
            id: "",
            document_type: activeTab,
            token: res.token!,
            created_at: new Date().toISOString(),
            revoked_at: null,
            signature: null,
          },
        }))
        try {
          await navigator.clipboard.writeText(res.shareUrl)
          setShareCopied(activeTab)
          setTimeout(() => setShareCopied(null), 2000)
        } catch {
          // Clipboard not available
        }
      }
    } finally {
      setSharing(false)
    }
  }

  const currentShare = shareInfo[activeTab]

  return (
    <AnimateIn animation="fade-in-up">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Protection Package</h3>
            <DraftBadge state={documents.length > 0 ? "ai-draft" : "generating"} />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onRegenerate}
            disabled={regenerating}
          >
            {regenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Regenerate
          </Button>
        </div>

        <div className="flex gap-1 border-b">
          {tabs.map((tab) => {
            const info = shareInfo[tab.key]
            const isShared = info && !info.revoked_at
            const isSigned = info?.signature
            return (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={cn(
                  "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px relative",
                  activeTab === tab.key
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
                {isSigned && (
                  <span className="ml-1.5 inline-flex items-center rounded-full bg-success/10 px-1.5 py-0.5 text-[10px] font-medium text-success">
                    Signed
                  </span>
                )}
                {isShared && !isSigned && (
                  <span className="ml-1.5 inline-flex items-center rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                    Shared
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {activeDoc && (
          <AnimateIn animation="fade-in-up" key={activeTab}>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <p className="text-xs text-muted-foreground">
                    Generated {new Date(activeDoc.createdAt).toLocaleString()}
                  </p>
                  <DraftBadge
                    state={reviewed.has(activeTab) ? "reviewed" : "ai-draft"}
                  />
                </div>
                <div className="flex items-center gap-2">
                  {!reviewed.has(activeTab) && (
                    <Button variant="outline" size="sm" onClick={handleMarkReviewed}>
                      <Eye className="h-3.5 w-3.5" />
                      Mark reviewed
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleShare}
                    disabled={sharing || !!currentShare?.signature}
                  >
                    {sharing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Share2 className="h-3.5 w-3.5" />
                    )}
                    {currentShare?.signature ? "Signed" : currentShare ? "Reshare" : "Send to Client"}
                  </Button>
                  {currentShare && !currentShare.revoked_at && !currentShare.signature && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <ExternalLink className="h-3 w-3" />
                      {shareCopied === activeTab ? "Link copied!" : "Link ready"}
                    </span>
                  )}
                  <PdfExport documents={documents} riskScore={riskScore} riskLevel={riskLevel} />
                  <Button variant="ghost" size="sm" onClick={handleCopy}>
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-green-600" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div className="rounded-lg border bg-muted/30 p-6 prose prose-sm max-w-none animate-fade-in">
                {renderMarkdown(activeDoc.content)}
                <div ref={contentEndRef} />
              </div>
              <LegalDisclaimer compact />
            </div>
          </AnimateIn>
        )}
      </div>
    </AnimateIn>
  )
}
