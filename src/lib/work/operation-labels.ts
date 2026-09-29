const OPERATION_LABELS: Record<string, string> = {
  document_analysis: "Analyze the deal",
  proposal: "Draft the proposal",
  negotiation: "Prepare negotiation points",
  drafting: "Draft the document",
  comparison: "Compare the options",
  decision_support: "Weigh the decision",
  explanation: "Explain the findings",
  conversation: "Answer your question",
  validate_rows: "Check the spreadsheet rows",
  generate_draft: "Generate the drafts",
  send_email: "Send the emails",
  invite_counterparty: "Invite the counterparty",
}

export function friendlyOperation(operation: string): string {
  const known = OPERATION_LABELS[operation]
  if (known) return known
  return operation
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase())
}

const OBJECTIVE_LABELS: Record<string, string> = {
  deal_analysis: "Deal analysis",
}

export function friendlyObjective(kind: string): string {
  const known = OBJECTIVE_LABELS[kind]
  if (known) return known
  return kind
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase())
}
