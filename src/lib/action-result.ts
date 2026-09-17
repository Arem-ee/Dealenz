// Server-action error contract (Phase 5: no swallowed or minified errors).
//
// Production redacts every message thrown across the Server Action boundary
// into an opaque digest, which the client surfaces as "Minified React error
// #441". Actions invoked from client event handlers must therefore NEVER
// throw expected failures: catch them and return them as data using the
// shapes below, so the real message reaches the UI. Redirects are control
// flow, not failures, and are always rethrown untouched.

import { isRedirectError } from "next/dist/client/components/redirect-error"
import { publicErrorMessage } from "./safe-error"

/** Failure half of the `{ ok: true; ... } | { ok: false; error }` union. */
export interface ActionFailure {
  ok: false
  error: string
}

/**
 * Map an unexpected throw to an ActionFailure. Curated product messages pass
 * through verbatim; provider/infrastructure details collapse to the fallback.
 * The raw error is written to server logs (never the client) for diagnosis.
 */
export function toActionFailure(err: unknown, fallback: string): ActionFailure {
  if (isRedirectError(err)) throw err
  try {
    // Server logs only — keeps the diagnosis without leaking internals.
    console.error("[server-action]", err instanceof Error ? (err.stack ?? err.message) : err)
  } catch {
    // Logging must never break the failure path itself.
  }
  return { ok: false, error: publicErrorMessage(err, fallback) }
}
