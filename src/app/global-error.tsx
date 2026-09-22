"use client"

import { useEffect } from "react"

// Root error boundary (Next.js App Router convention): renders a safe
// fallback and reports a bounded, redacted client error to
// /api/client-errors. Must include <html>/<body> — it replaces the root
// layout when it renders. Never sends deal content or documents.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    try {
      const payload = JSON.stringify({
        message: String(error?.message ?? "Unknown client error").slice(0, 500),
        stack: typeof error?.stack === "string" ? error.stack.slice(0, 2000) : null,
        url: typeof window !== "undefined" ? window.location.pathname.slice(0, 500) : null,
      })
      void fetch("/api/client-errors", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch(() => {})
    } catch {
      // Reporting must never break the fallback UI.
    }
  }, [error])

  return (
    <html>
      <body>
        <div style={{ maxWidth: 560, margin: "10vh auto", padding: 24, fontFamily: "'Mona Sans Variable', system-ui, sans-serif", color: "var(--foreground)", background: "var(--background)" }}>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>{error?.message ? String(error.message).slice(0, 300) : "An unexpected error occurred"}</h1>
          <p style={{ marginTop: 8, color: "var(--muted-foreground)" }}>
            Your data is safe — try again, and contact support if it keeps happening.
          </p>
          <button
            onClick={() => reset()}
            style={{ marginTop: 16, padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", cursor: "pointer" }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
