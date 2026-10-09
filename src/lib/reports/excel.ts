// Excel export for metric results (delivery D1).
//
// Real workbooks, not renamed CSVs: typed columns (numbers stay numeric),
// styled header row, frozen panes, autofilter, one worksheet per result
// with the metric title as the sheet name. exceljs is MIT — no licensing
// trap. Bounded by the analytics row cap upstream.

import ExcelJS from "exceljs"
import type { MetricResult } from "@/lib/analytics/catalog"

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF064E3B" },
}

const HEADER_FONT: Partial<ExcelJS.Font> = {
  color: { argb: "FFFFFFFF" },
  bold: true,
  size: 11,
}

function sheetName(title: string): string {
  const clean = title.replace(/[\\/?*[\]:]/g, "").trim().slice(0, 28)
  return clean.length > 0 ? clean : "Report"
}

/** Builds a formatted .xlsx buffer from one metric result. */
export async function metricToExcel(title: string, result: MetricResult): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "Dealenz"
  workbook.created = new Date()
  const sheet = workbook.addWorksheet(sheetName(title))
  sheet.columns = result.columns.map((c) => ({
    header: c.label,
    key: c.key,
    width: Math.max(12, Math.min(48, c.label.length + 4)),
  }))
  for (const row of result.rows) {
    const values: Record<string, string | number> = {}
    for (const c of result.columns) {
      const v = row[c.key]
      if (c.numeric && typeof v !== "number") {
        values[c.key] = Number(v) || 0
      } else if (typeof v === "string" && /^[=+\-@\t\r]/.test(v)) {
        // Formula-injection guard: leading apostrophe forces text treatment.
        values[c.key] = `'${v}`
      } else {
        values[c.key] = (v ?? "") as string | number
      }
    }
    sheet.addRow(values)
  }
  const header = sheet.getRow(1)
  header.font = HEADER_FONT
  header.fill = HEADER_FILL
  header.alignment = { vertical: "middle" }
  sheet.views = [{ state: "frozen", ySplit: 1 }]
  if (result.rows.length > 0) {
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: result.columns.length },
    }
  }
  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
