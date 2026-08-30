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

interface PdfContentProps {
  content: string
}

function PdfContent({ content }: PdfContentProps) {
  const lines = content.split("\n")
  const elements: React.ReactElement[] = []

  let i = 0
  while (i < lines.length) {
    const line = lines[i].trim()

    if (line === "") {
      i++
      continue
    }

    if (line === "---") {
      elements.push(<View key={`hr-${i}`} style={styles.hr} />)
      i++
      continue
    }

    const h1 = line.match(/^# (.+)$/)
    if (h1) {
      elements.push(<Text key={`h1-${i}`} style={styles.heading1}>{h1[1]}</Text>)
      i++
      continue
    }

    const h2 = line.match(/^## (.+)$/)
    if (h2) {
      elements.push(<Text key={`h2-${i}`} style={styles.heading2}>{h2[1]}</Text>)
      i++
      continue
    }

    const h3 = line.match(/^### (.+)$/)
    if (h3) {
      elements.push(<Text key={`h3-${i}`} style={styles.heading3}>{h3[1]}</Text>)
      i++
      continue
    }

    if (line.startsWith("- ")) {
      const items: string[] = []
      while (i < lines.length && lines[i].trimStart().startsWith("- ")) {
        items.push(lines[i].trimStart().slice(2))
        i++
      }
      elements.push(
        <View key={`ul-${i}`} style={{ marginBottom: 6 }}>
          {items.map((item, idx) => (
            <View key={idx} style={styles.listRow}>
              <Text style={styles.bullet}>{" "}</Text>
              <Text style={{ flex: 1 }}>{item}</Text>
            </View>
          ))}
        </View>
      )
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
      elements.push(
        <View key={`ol-${i}`} style={{ marginBottom: 6 }}>
          {items.map((item, idx) => (
            <View key={idx} style={styles.listRow}>
              <Text style={{ width: 20, fontSize: 11 }}>{startNum + idx}.</Text>
              <Text style={{ flex: 1 }}>{item}</Text>
            </View>
          ))}
        </View>
      )
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
      const text = paraLines.join(" ")
      elements.push(
        <Text key={`p-${i}`} style={styles.paragraph}>{text}</Text>
      )
    }
  }

  return <>{elements}</>
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
