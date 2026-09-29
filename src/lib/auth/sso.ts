// Enterprise SSO (SAML/OIDC via the Supabase Auth SSO provider).
// Pure input handling and error mapping: the actual redirect runs through
// supabase.auth.signInWithSSO on the login page, and the IdP returns to the
// existing /auth/callback code-exchange route. SSO providers are configured
// in the Supabase dashboard (Auth > SSO), never in code: an unconfigured
// domain fails closed here with an honest message instead of a redirect.

export function parseSsoDomain(input: string): string | null {
  const raw = input.trim().toLowerCase()
  if (!raw) return null
  const host = raw.includes("@") ? (raw.split("@")[1] ?? "") : raw
  const domain = host.trim().replace(/\/+$/, "")
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(domain)) return null
  if (domain.length > 253) return null
  return domain
}

export function ssoErrorMessage(raw: string): string {
  const msg = (raw ?? "").toLowerCase()
  if (!msg) return "We couldn't start SSO sign-in. Please try again."
  if (msg.includes("sso") && (msg.includes("not found") || msg.includes("no sso") || msg.includes("identity provider"))) {
    return "SSO isn't set up for this domain yet. Ask your workspace admin or continue with email sign-in."
  }
  if (msg.includes("saml") || msg.includes("identity provider") || msg.includes("idp")) {
    return "Your identity provider refused the request. Check with your IT admin and try again."
  }
  return "We couldn't start SSO sign-in. Please try again."
}
