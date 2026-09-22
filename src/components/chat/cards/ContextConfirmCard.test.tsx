import { describe, it, expect } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { ContextConfirmCard } from "./ContextConfirmCard"

const FIELDS = [
  { key: "userRole", label: "Your role", value: "", confidence: 0.4, options: ["freelancer", "client", "other"] },
  { key: "jurisdiction", label: "Jurisdiction", value: "Texas", confidence: 0.5, options: null },
]

describe("ContextConfirmCard stepped flow", () => {
  it("asks exactly one question at a time with progress", () => {
    const html = renderToStaticMarkup(
      <ContextConfirmCard payload={{ fields: FIELDS }} onConfirm={() => {}} />
    )
    expect(html).toContain("Your role")
    expect(html).not.toContain("Jurisdiction")
    expect(html).toContain("1 of 2")
  })

  it("renders native option buttons for closed-vocabulary fields", () => {
    const html = renderToStaticMarkup(
      <ContextConfirmCard payload={{ fields: FIELDS }} onConfirm={() => {}} />
    )
    expect(html).toContain("Freelancer")
    expect(html).toContain("Client")
    expect(html).toContain("None of these")
  })

  it("keeps the complete-context card untouched", () => {
    const html = renderToStaticMarkup(
      <ContextConfirmCard payload={{ fields: [] }} onConfirm={() => {}} />
    )
    expect(html).toContain("Context looks complete")
    expect(html).not.toContain("of 0")
  })

  it("shows the guessed value when the field was inferred", () => {
    const html = renderToStaticMarkup(
      <ContextConfirmCard
        payload={{ fields: [{ key: "jurisdiction", label: "Jurisdiction", value: "Texas", confidence: 0.5, options: null }] }}
        onConfirm={() => {}}
      />
    )
    expect(html).toContain("We guessed: Texas")
  })
})
