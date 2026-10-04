import { describe, expect, it } from "vitest"
import { formatDealValue, isDealCurrency, parseDealValue, sumByCurrency } from "./value"

describe("parseDealValue", () => {
  it("parses human amounts to minor units and rejects garbage", () => {
    expect(parseDealValue({ amount: "48,500.00", currency: "USD" })).toEqual({ minor: 4850000, currency: "USD" })
    expect(parseDealValue({ amount: "100", currency: "NGN" })).toEqual({ minor: 10000, currency: "NGN" })
    expect(parseDealValue({ amount: "0", currency: "USD" })).toMatchObject({ error: expect.stringContaining("positive") })
    expect(parseDealValue({ amount: "10.999", currency: "USD" })).toMatchObject({ error: expect.stringContaining("decimals") })
    expect(parseDealValue({ amount: "abc", currency: "USD" })).toMatchObject({ error: expect.stringContaining("number") })
    expect(parseDealValue({ amount: "10", currency: "JPY" })).toMatchObject({ error: expect.stringContaining("Currency") })
    expect(isDealCurrency("EUR")).toBe(true)
    expect(isDealCurrency("eur")).toBe(false)
  })
})

describe("formatDealValue/sumByCurrency", () => {
  it("formats per currency and sums with NULL rows excluded", () => {
    expect(formatDealValue(4850000, "USD")).toContain("48,500")
    expect(formatDealValue(10000, "NGN")).toContain("NGN")
    expect(
      sumByCurrency([
        { minor: 10000, currency: "USD" },
        { minor: null, currency: null },
        { minor: 5000, currency: "USD" },
        { minor: 7000, currency: "EUR" },
      ])
    ).toEqual([
      { currency: "USD", total: 15000, deals: 2 },
      { currency: "EUR", total: 7000, deals: 1 },
    ])
  })
})
