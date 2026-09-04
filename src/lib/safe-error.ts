export const ANONYMOUS_ANALYSIS_FAILURE =
  "Analysis failed. Please try again with more detail about your deal."

export function toAnonymousError(err: unknown): { publicMessage: string } {
  console.error(
    "[analyze-anonymous] failure:",
    err instanceof Error ? err.name : typeof err
  )
  return { publicMessage: ANONYMOUS_ANALYSIS_FAILURE }
}
