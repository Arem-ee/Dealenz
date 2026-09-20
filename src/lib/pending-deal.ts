// Pending anonymous deal text: typed on the landing page before an account
// exists, resumed in the dashboard composer after signup/signin.
// sessionStorage (reload-safe across the OAuth round-trip), in-memory
// fallback outside the browser. Plain text only, capped, never sensitive
// beyond what the user typed for analysis anyway.

const KEY = "dealenz.pending-deal"
const MAX_CHARS = 20000

let memoryFallback: string | null = null

function storage(): Storage | null {
  try {
    if (typeof window === "undefined" || !window.sessionStorage) return null
    return window.sessionStorage
  } catch {
    return null
  }
}

export function setPendingDeal(text: string | null) {
  const value = typeof text === "string" && text.trim().length > 0 ? text.slice(0, MAX_CHARS) : null
  memoryFallback = value
  try {
    const store = storage()
    if (!store) return
    if (value === null) store.removeItem(KEY)
    else store.setItem(KEY, value)
  } catch {
    // Storage unavailable (private mode): memory fallback still holds it
    // for the session.
  }
}

export function getPendingDeal(): string | null {
  try {
    const store = storage()
    if (store) {
      const value = store.getItem(KEY)
      if (value !== null) return value
    }
  } catch {
    // Fall through to memory.
  }
  return memoryFallback
}

export function clearPendingDeal() {
  memoryFallback = null
  try {
    storage()?.removeItem(KEY)
  } catch {
    // Memory already cleared; nothing else to do.
  }
}
