import {
  ENTITY_TYPE_VALUES,
  INDUSTRY_VALUES,
  INTENT_VALUES,
  ROLE_VALUES,
  STAGE_VALUES,
  STRUCTURE_VALUES,
  type DealType,
} from "./schema"

// Native option buttons for confirm-a-question fields. Only keys with a
// closed, schema-validated vocabulary get options; everything else stays
// free text. Selections are guaranteed to pass parseContextEnvelope, which
// today's free-typing cannot promise for enum fields.
const DEAL_TYPE_VALUES: readonly DealType[] = [
  "freelance",
  "generic",
  "lease",
  "purchase_sale",
  "employment",
  "founder",
  "partnership",
]

const OPTIONS_BY_KEY: Record<string, readonly string[]> = {
  dealType: DEAL_TYPE_VALUES,
  intent: INTENT_VALUES,
  userRole: ROLE_VALUES,
  counterpartyRole: ROLE_VALUES,
  industry: INDUSTRY_VALUES,
  transactionStructure: STRUCTURE_VALUES,
  transactionStage: STAGE_VALUES,
  entityTypes: ENTITY_TYPE_VALUES,
}

export function optionsForContextKey(key: string): string[] | null {
  const values = OPTIONS_BY_KEY[key]
  return values ? [...values] : null
}

export function optionLabel(value: string): string {
  const words = value.split("_").filter((w) => w.length > 0)
  if (words.length === 0) return value
  return [words[0][0].toUpperCase() + words[0].slice(1), ...words.slice(1)].join(" ")
}
