import React from "react"
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer"
import type { GeneratedDocument, DocumentType } from "@/lib/generate"
import { DISCLAIMER_PDF_TEXT } from "@/components/legal-disclaimer"

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 11,
    fontFamily: "Helvetica",
    lineHeight: 1.5,
    color: "#1a1a1a",
  },
  header: {
    marginBottom: 24,
    borderBottomWidth: 2,
    borderBottomColor: "#1a1a1a",
    paddingBottom: 12,
  },
  brand: {
    fontSize: 18,
    fontWeight: 700,
    color: "#1a1a1a",
  },
  docTitle: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
  heading1: {
    fontSize: 16,
    fontWeight: 700,
    marginTop: 16,
    marginBottom: 8,
  },
  heading2: {
    fontSize: 13,
    fontWeight: 700,
    marginTop: 12,
    marginBottom: 6,
  },
  heading3: {
    fontSize: 11,
    fontWeight: 700,
    marginTop: 10,
    marginBottom: 4,
  },
  paragraph: {
    marginBottom: 8,
  },
  listItem: {
    marginBottom: 3,
    paddingLeft: 12,
  },
  hr: {
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
    marginVertical: 12,
  },
  bullet: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#1a1a1a",
    marginRight: 8,
    marginTop: 6,
  },
  listRow: {
    flexDirection: "row",
    marginBottom: 3,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: "#ccc",
    paddingTop: 8,
    fontSize: 8,
    color: "#999",
  },
  disclaimer: {
    fontSize: 7,
    color: "#aaa",
    marginTop: 4,
  },
  tag: {
    fontSize: 9,
    color: "#666",
    backgroundColor: "#f0f0f0",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    marginBottom: 4,
  },
})

// Pure markdown block model: the PDF renderer maps every source line to a
// block, so completeness is provable (no silent truncation, no dropped
// sections). There is intentionally no page cap: @react-pdf flows blocks
// across as many pages as the content requires.
export type PdfBlock =
  | { kind: "hr" }
  | { kind: "h1" | "h2" | "h3" | "paragraph"; text: string }
  | { kind: "ul" | "ol"; items: string[]; startNum: number }

export function parsePdfBlocks(content: string): PdfBlock[] {
  const lines = content.split("\n")
  const blocks: PdfBlock[] = []

  let i = 0
  while (i < lines.length) {
    const line = lines[i].trim()

    if (line === "") {
      i++
      continue
    }

    if (line === "---") {
      blocks.push({ kind: "hr" })
      i++
      continue
    }

    const h1 = line.match(/^# (.+)$/)
    if (h1) {
      blocks.push({ kind: "h1", text: h1[1] })
      i++
      continue
    }

    const h2 = line.match(/^## (.+)$/)
    if (h2) {
      blocks.push({ kind: "h2", text: h2[1] })
      i++
      continue
    }

    const h3 = line.match(/^### (.+)$/)
    if (h3) {
      blocks.push({ kind: "h3", text: h3[1] })
      i++
      continue
    }

    if (line.startsWith("- ")) {
      const items: string[] = []
      while (i < lines.length && lines[i].trimStart().startsWith("- ")) {
        items.push(lines[i].trimStart().slice(2))
        i++
      }
      blocks.push({ kind: "ul", items, startNum: 0 })
      continue
    }

    const ol = line.match(/^\d+\.\s+(.+)$/)
    if (ol) {
      const items: string[] = []
      const startNum = parseInt(line.match(/^(\d+)/)![1])
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ""))
        i++
      }
      blocks.push({ kind: "ol", items, startNum })
      continue
    }

    const paraLines: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].match(/^#{1,3}\s/) &&
      !lines[i].trimStart().startsWith("- ") &&
      !/^\d+\.\s+/.test(lines[i]) &&
      lines[i].trim() !== "---"
    ) {
      paraLines.push(lines[i].trim())
      i++
    }
    if (paraLines.length > 0) {
      blocks.push({ kind: "paragraph", text: paraLines.join(" ") })
    }
  }

  return blocks
}

interface PdfContentProps {
  content: string
}

function PdfContent({ content }: PdfContentProps) {
  const blocks = parsePdfBlocks(content)
  return (
    <>
      {blocks.map((block, i) => {
        switch (block.kind) {
          case "hr":
            return <View key={`hr-${i}`} style={styles.hr} />
          case "h1":
            return <Text key={`h1-${i}`} style={styles.heading1}>{block.text}</Text>
          case "h2":
            return <Text key={`h2-${i}`} style={styles.heading2}>{block.text}</Text>
          case "h3":
            return <Text key={`h3-${i}`} style={styles.heading3}>{block.text}</Text>
          case "ul":
            return (
              <View key={`ul-${i}`} style={{ marginBottom: 6 }}>
                {block.items.map((item, idx) => (
                  <View key={idx} style={styles.listRow}>
                    <Text style={styles.bullet}>{" "}</Text>
                    <Text style={{ flex: 1 }}>{item}</Text>
                  </View>
                ))}
              </View>
            )
          case "ol":
            return (
              <View key={`ol-${i}`} style={{ marginBottom: 6 }}>
                {block.items.map((item, idx) => (
                  <View key={idx} style={styles.listRow}>
                    <Text style={{ width: 20, fontSize: 11 }}>{block.startNum + idx}.</Text>
                    <Text style={{ flex: 1 }}>{item}</Text>
                  </View>
                ))}
              </View>
            )
          case "paragraph":
            return <Text key={`p-${i}`} style={styles.paragraph}>{block.text}</Text>
        }
      })}
    </>
  )
}

export interface VersionSignature {
  name: string
  partyLabel: string
  status: string
  signedAt: string | null
}

/**
 * Signature manifest lines for an executed PDF. Pure and tested: every
 * bound signer is listed with their server-side status — the manifest
 * reflects the audit trail, it does not create it. Visual marks carry no
 * legal significance beyond the recorded workflow state.
 */
export function buildSignatureManifest(
  signers: VersionSignature[],
  executed: boolean
): string[] {
  const lines = [
    executed ? "Execution status: fully executed" : "Execution status: not yet complete",
  ]
  for (const s of signers) {
    const when = s.status === "signed" && s.signedAt ? ` on ${new Date(s.signedAt).toLocaleDateString()}` : ""
    const mark = s.status === "signed" ? "✓ Signed" : s.status
    lines.push(`${s.name} (${s.partyLabel}) — ${mark}${when}`)
  }
  return lines
}

export function VersionPdfDocument({
  title,
  subtitle,
  content,
  generatedAt,
  signatures,
  executed,
}: {
  title: string
  subtitle?: string | null
  content: string
  generatedAt: string
  signatures: VersionSignature[]
  executed: boolean
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header} fixed>
          <Text style={styles.brand}>dealenz</Text>
          <Text style={styles.docTitle}>{title}</Text>
          {subtitle ? <Text style={styles.tag}>{subtitle}</Text> : null}
        </View>

        <PdfContent content={content} />

        {signatures.length > 0 && (
          <View style={{ marginTop: 16 }}>
            <Text style={styles.heading2}>Signatures</Text>
            {buildSignatureManifest(signatures, executed).map((line, idx) => (
              <Text key={idx} style={styles.paragraph}>{line}</Text>
            ))}
            <Text style={styles.disclaimer}>
              Workflow record of the Dealenz signing process for this exact document version. Not a determination of legal enforceability.
            </Text>
          </View>
        )}

        <View style={styles.footer} fixed>
          <Text>Exported {new Date(generatedAt).toLocaleDateString()} by Dealenz</Text>
          <Text style={styles.disclaimer}>{DISCLAIMER_PDF_TEXT}</Text>
        </View>
      </Page>
    </Document>
  )
}

export function AuditPdfDocument({
  document,
  riskScore,
  riskLevel,
}: {
  document: GeneratedDocument
  riskScore?: number
  riskLevel?: string | null
}) {
  const typeLabel: Record<DocumentType, string> = {
    proposal: "Proposal",
    sow: "Scope of Work",
    contract: "Contract",
    checklist: "Deliverables Checklist",
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header} fixed>
          <Text style={styles.brand}>dealenz</Text>
          <Text style={styles.docTitle}>{typeLabel[document.type]}</Text>
          {riskScore !== undefined && (
            <Text style={styles.tag}>
              Risk Score: {riskScore}/100 ({riskLevel ?? "N/A"})
            </Text>
          )}
        </View>

        <PdfContent content={document.content} />

        <View style={styles.footer} fixed>
          <Text>Generated {new Date(document.createdAt).toLocaleDateString()} by Dealenz</Text>
          <Text style={styles.disclaimer}>{DISCLAIMER_PDF_TEXT}</Text>
        </View>
      </Page>
    </Document>
  )
}
