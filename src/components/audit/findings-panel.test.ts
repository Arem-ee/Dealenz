import { describe, it, expect } from "vitest"
import { parsePersistedFindings } from "./findings-panel"

describe("parsePersistedFindings", () => {
  it("accepts valid persisted results and preserves evidence", () => {
    const raw = [
      {
        ruleKey: "lease-rent-terms-missing",
        ruleVersion: "v1",
        status: "FAIL",
        finding: {
          ruleKey: "lease-rent-terms-missing",
          ruleVersion: 1,
          summary: "No rent found.",
          severity: "attention",
          authority: { kind: "product_policy", note: "n" },
          evidence: [
            {
              id: "ev_12345678",
              sourceType: "audit_input",
              sourceId: "audit-1",
              sourceVersion: null,
              location: { kind: "approximate", section: "raw_input" },
              quote: "shop lease",
              observationKey: "facts.lease.rent",
              method: "pattern_observation",
              confidence: 0.8,
              inspectable: true,
            },
          ],
        },
        reason: "Rule fired.",
        authority: { kind: "product_policy", note: "n" },
        evaluatedAt: "2026-09-04T00:00:00.000Z",
      },
    ]
    const parsed = parsePersistedFindings(raw)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].finding?.evidence?.[0].id).toBe("ev_12345678")
  })

  it("drops malformed entries instead of rendering them", () => {
    expect(parsePersistedFindings(null)).toEqual([])
    expect(parsePersistedFindings({})).toEqual([])
    expect(parsePersistedFindings([{ nope: true }, null, "x"])).toEqual([])
    expect(
      parsePersistedFindings([{ ruleKey: "a", status: "BOGUS" }])
    ).toEqual([])
  })

  it("keeps findings without evidence valid", () => {
    const parsed = parsePersistedFindings([
      {
        ruleKey: "lease-deposit-missing",
        ruleVersion: "v1",
        status: "FAIL",
        finding: {
          ruleKey: "lease-deposit-missing",
          ruleVersion: 1,
          summary: "No deposit found.",
          severity: "informational",
          authority: { kind: "product_policy", note: "n" },
        },
        reason: "Rule fired.",
        authority: { kind: "product_policy", note: "n" },
        evaluatedAt: "2026-09-04T00:00:00.000Z",
      },
    ])
    expect(parsed).toHaveLength(1)
    expect(parsed[0].finding?.evidence).toBeUndefined()
  })
})
