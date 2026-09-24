// Business-profile merge for generated documents (shared by the inline
// protection-package path and plan-based single-document generation).
// Prepends a Business Profile section when the user filled anything in;
// returns content untouched when no profile exists, so drafts never carry
// empty headers.

export interface BusinessProfileForDocuments {
  business_name: string | null
  legal_entity: string | null
  address: string | null
  city: string | null
  country: string | null
  email: string | null
  phone: string | null
  website: string | null
  default_currency: string | null
  default_payment_terms: string | null
  standard_rate: number | null
  rate_unit: string | null
}

export function addBusinessProfileToDocument(content: string, profile: BusinessProfileForDocuments | null): string {
  if (!profile) return content

  const lines: string[] = []
  if (profile.business_name) lines.push(`Service Provider: ${profile.business_name}`)
  if (profile.legal_entity) lines.push(`Legal Entity: ${profile.legal_entity}`)
  const location = [profile.address, profile.city, profile.country].filter(Boolean).join(", ")
  if (location) lines.push(`Address: ${location}`)
  if (profile.email) lines.push(`Email: ${profile.email}`)
  if (profile.phone) lines.push(`Phone: ${profile.phone}`)
  if (profile.website) lines.push(`Website: ${profile.website}`)
  if (profile.default_currency) lines.push(`Currency: ${profile.default_currency}`)
  if (profile.default_payment_terms) lines.push(`Payment Terms: ${profile.default_payment_terms}`)
  if (profile.standard_rate) {
    lines.push(`Standard Rate: ${profile.standard_rate}${profile.rate_unit ? ` / ${profile.rate_unit}` : ""}`)
  }

  if (lines.length === 0) return content
  return `## Business Profile\n${lines.join("\n")}\n\n${content}`
}
