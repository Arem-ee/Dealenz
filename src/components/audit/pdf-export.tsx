"use client"

import { useState } from "react"
import { FileDown, Loader2 } from "lucide-react"
import { PDFDownloadLink } from "@react-pdf/renderer"
import { AuditPdfDocument } from "@/components/audit/pdf-documents"
import { Button } from "@/components/ui/button"
import type { GeneratedDocument, DocumentType } from "@/lib/generate"

interface PdfExportProps {
  documents: GeneratedDocument[]
  riskScore?: number
  riskLevel?: string | null
}

const exportLabels: Record<DocumentType, string> = {
  proposal: "Proposal",
  sow: "Scope of Work",
  contract: "Contract",
  checklist: "Checklist",
}

export function PdfExport({ documents, riskScore, riskLevel }: PdfExportProps) {
  const [timestamp] = useState(() => Date.now())

  return (
    <div className="flex flex-wrap gap-2">
      {documents.map((doc) => (
        <PDFDownloadLink
          key={doc.id}
          document={
            <AuditPdfDocument
              document={doc}
              riskScore={riskScore}
              riskLevel={riskLevel}
            />
          }
          fileName={`dealenz-${doc.type}-${timestamp}.pdf`}
        >
          {({ loading }) => (
            <Button variant="outline" size="sm" disabled={loading}>
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileDown className="h-3.5 w-3.5" />
              )}
              Export {exportLabels[doc.type]}
            </Button>
          )}
        </PDFDownloadLink>
      ))}
    </div>
  )
}
