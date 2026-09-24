// PDF artifact renderer — the file behind the Download button.
//
// Renders from the SAME markdown AST as the screen (parseMarkdown), so the
// downloaded file cannot drift from what the user read. Built-in PDF fonts
// only (Times for body, Helvetica for letterhead/footer): no font files to
// ship, no registration to fail, and the artifact reads like a real
// professional document rather than AI chat output.

import { createElement } from "react"
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer"
import { parseMarkdown, type Block, type InlineNode } from "@/lib/markdown"

export interface PdfLetterhead {
  name: string
  lines: string[]
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 64,
    paddingHorizontal: 56,
    fontFamily: "Times-Roman",
    fontSize: 11,
    lineHeight: 1.6,
    color: "#1C1917",
  },
  letterheadName: {
    fontFamily: "Helvetica-Bold",
    fontSize: 13,
    color: "#1C1917",
  },
  letterheadLine: {
    fontFamily: "Helvetica",
    fontSize: 8,
    color: "#6B6660",
    marginTop: 2,
  },
  letterheadRule: {
    borderBottomWidth: 1,
    borderBottomColor: "#D6D1CB",
    marginTop: 10,
    marginBottom: 18,
  },
  h1: {
    fontFamily: "Times-Bold",
    fontSize: 20,
    marginTop: 4,
    marginBottom: 12,
  },
  h2: {
    fontFamily: "Times-Bold",
    fontSize: 13,
    marginTop: 18,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#E4E0DA",
    paddingBottom: 4,
  },
  h3: {
    fontFamily: "Times-Bold",
    fontSize: 11,
    marginTop: 12,
    marginBottom: 4,
  },
  paragraph: {
    marginBottom: 8,
  },
  bold: {
    fontFamily: "Times-Bold",
  },
  blank: {
    backgroundColor: "#FEF3C7",
    color: "#92400E",
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
  },
  listItem: {
    flexDirection: "row",
    marginBottom: 3,
  },
  marker: {
    width: 18,
    color: "#6B6660",
  },
  itemBody: {
    flex: 1,
  },
  hr: {
    borderBottomWidth: 1,
    borderBottomColor: "#D6D1CB",
    marginVertical: 18,
  },
  table: {
    marginBottom: 10,
  },
  tableHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 2,
    borderBottomColor: "#1C1917",
  },
  tableHeaderCell: {
    flex: 1,
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    paddingHorizontal: 6,
    paddingVertical: 5,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E4E0DA",
  },
  tableCell: {
    flex: 1,
    fontSize: 10,
    paddingHorizontal: 6,
    paddingVertical: 5,
  },
  quote: {
    marginBottom: 8,
    paddingLeft: 10,
    borderLeftWidth: 2,
    borderLeftColor: "#D6D1CB",
    color: "#57534E",
    fontFamily: "Times-Italic",
  },
  footer: {
    position: "absolute",
    bottom: 32,
    left: 56,
    right: 56,
    flexDirection: "row",
    justifyContent: "space-between",
    fontFamily: "Helvetica",
    fontSize: 8,
    color: "#8A847D",
  },
})

function PdfInline({ nodes }: { nodes: InlineNode[] }) {
  return (
    <Text>
      {nodes.map((node, i) => {
        if (node.type === "bold") {
          return (
            <Text key={i} style={styles.bold}>
              {node.text}
            </Text>
          )
        }
        if (node.type === "var") {
          return (
            <Text key={i} style={styles.blank}>
              {`[ ${node.name || "to complete"} ]`}
            </Text>
          )
        }
        return <Text key={i}>{node.text}</Text>
      })}
    </Text>
  )
}

function PdfBlock({ block, index }: { block: Block; index: number }) {
  switch (block.type) {
    case "heading":
      return (
        <Text key={index} style={block.level === 1 ? styles.h1 : block.level === 2 ? styles.h2 : styles.h3}>
          <PdfInline nodes={block.children} />
        </Text>
      )
    case "paragraph":
      return (
        <View key={index} style={styles.paragraph}>
          <PdfInline nodes={block.children} />
        </View>
      )
    case "list":
      return (
        <View key={index} style={styles.paragraph}>
          {block.items.map((item, j) => (
            <View key={j} style={styles.listItem}>
              <Text style={styles.marker}>{block.ordered ? `${j + 1}.` : "•"}</Text>
              <View style={styles.itemBody}>
                <PdfInline nodes={item} />
              </View>
            </View>
          ))}
        </View>
      )
    case "hr":
      return <View key={index} style={styles.hr} />
    case "table": {
      const align = (a: "left" | "center" | "right") =>
        a === "center" ? "center" : a === "right" ? "right" : "left";
      return (
        <View key={index} style={styles.table}>
          <View style={styles.tableHeaderRow}>
            {block.headers.map((h, hi) => (
              <Text key={hi} style={[styles.tableHeaderCell, { textAlign: align(block.aligns[hi] ?? "left") }]}>
                <PdfInline nodes={h} />
              </Text>
            ))}
          </View>
          {block.rows.map((row, ri) => (
            <View key={ri} style={styles.tableRow}>
              {row.map((cell, ci) => (
                <Text key={ci} style={[styles.tableCell, { textAlign: align(block.aligns[ci] ?? "left") }]}>
                  <PdfInline nodes={cell} />
                </Text>
              ))}
            </View>
          ))}
        </View>
      )
    }
    case "quote":
      return (
        <View key={index} style={styles.quote}>
          {block.children.map((child, ci) =>
            child.type === "paragraph" ? (
              <View key={ci}>
                <PdfInline nodes={child.children} />
              </View>
            ) : null
          )}
        </View>
      )
    default:
      return null
  }
}

export interface DealenzDocumentProps {
  letterhead: PdfLetterhead | null
  content: string
  footerNote: string
}

function DealenzPage({ letterhead, content, footerNote }: DealenzDocumentProps) {
  const blocks = parseMarkdown(content)
  return (
    <Page size="A4" style={styles.page}>
      {letterhead && (
        <View>
          <Text style={styles.letterheadName}>{letterhead.name}</Text>
          {letterhead.lines.map((line, i) => (
            <Text key={i} style={styles.letterheadLine}>
              {line}
            </Text>
          ))}
          <View style={styles.letterheadRule} />
        </View>
      )}
      {blocks.map((block, i) => (
        <PdfBlock key={i} block={block} index={i} />
      ))}
      <View style={styles.footer} fixed>
        <Text>{footerNote}</Text>
        <Text
          render={({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
            `${pageNumber} / ${totalPages}`
          }
        />
      </View>
    </Page>
  )
}

export function DealenzDocument(props: DealenzDocumentProps) {
  return (
    <Document>
      <DealenzPage {...props} />
    </Document>
  )
}

/** Rendered PDF bytes for a document. The single entry point (route + tests)
 * so renderToBuffer's Document-root requirement lives in one place. */
export function renderDealenzPdf(props: DealenzDocumentProps): Promise<Buffer> {
  return renderToBuffer(createElement(Document, null, createElement(DealenzPage, props)))
}
