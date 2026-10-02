// Draft kind mapping for the Drafts tab filter chips. Pure: family id in,
// Agreements / Terms / Schedules out. New family ids default to Terms.

export type DraftKind = "Agreements" | "Terms" | "Schedules"

export function kindOfFamily(familyId: string): DraftKind {
  const id = familyId.toLowerCase()
  if (id.endsWith("-agreement") || id === "contract") return "Agreements"
  if (id.includes("schedule")) return "Schedules"
  return "Terms"
}
