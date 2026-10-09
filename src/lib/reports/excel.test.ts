import { describe, expect, it } from "vitest"
import ExcelJS from "exceljs"
import { metricToExcel } from "./excel"

describe("metricToExcel", () => {
  it("round-trips headers, types, and rows", async () => {
    const buffer = await metricToExcel("Fallback acceptance", {
      columns: [
        { key: "clause", label: "Clause" },
        { key: "offered", label: "Offered", numeric: true },
      ],
      rows: [
        { clause: "liability-cap", offered: 4 },
        { clause: "net-60", offered: 2 },
      ],
      truncated: false,
    })
    expect(buffer.length).toBeGreaterThan(1000)
    // PK zip signature: a real workbook, not renamed text.
    expect(buffer.subarray(0, 2).toString("hex")).toBe("504b")
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer)
    const sheet = workbook.worksheets[0]!
    expect(sheet.getRow(1).getCell(1).value).toBe("Clause")
    expect(sheet.getRow(2).getCell(2).value).toBe(4)
    expect(sheet.rowCount).toBe(3)
  })
})
