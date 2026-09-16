"use client"

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"
import { getAiConsentStatus, grantAiConsent } from "@/lib/ai-consent"

type ConsentState = boolean | null

let globalConsented: ConsentState = null
let globalFetching = false
let globalFetchPromise: Promise<boolean> | null = null
const listeners = new Set<() => void>()
let channel: BroadcastChannel | null = null

function getChannel(): BroadcastChannel | null {
  if (typeof window === "undefined") return null
  if (channel) return channel
  try {
    channel = new BroadcastChannel("ai-consent")
  } catch {
    channel = null
  }
  return channel
}

function notifyAll() {
  for (const l of listeners) l()
  try {
    getChannel()?.postMessage({ type: "ai-consent-granted" })
  } catch {}
  try {
    localStorage.setItem("dealenz:ai-consent", globalConsented ? "1" : "0")
  } catch {}
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

function getSnapshot(): ConsentState {
  return globalConsented
}

function fetchOnce(): Promise<boolean> {
  if (globalFetchPromise) return globalFetchPromise
  globalFetching = true
  globalFetchPromise = getAiConsentStatus()
    .then((v) => {
      globalConsented = v
      notifyAll()
      return v
    })
    .catch(() => {
      globalConsented = false
      notifyAll()
      return false
    })
    .finally(() => {
      globalFetching = false
      globalFetchPromise = null
    })
  return globalFetchPromise
}

if (typeof window !== "undefined") {
  try {
    getChannel()?.addEventListener("message", (e: MessageEvent) => {
      if (e.data?.type === "ai-consent-granted") {
        globalConsented = true
        for (const l of listeners) l()
      }
    })
  } catch {}
  try {
    window.addEventListener("storage", (e) => {
      if (e.key === "dealenz:ai-consent" && e.newValue === "1" && globalConsented !== true) {
        globalConsented = true
        for (const l of listeners) l()
      }
    })
  } catch {}
}

export function useAiConsent() {
  const consented = useSyncExternalStore(subscribe, getSnapshot, () => null)
  const [consenting, setConsenting] = useState(false)
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true
    if (globalConsented === null && !globalFetching) {
      void fetchOnce()
    }
  }, [])

  const refresh = useCallback(async () => {
    const v = await fetchOnce()
    return v
  }, [])

  const grant = useCallback(async (): Promise<boolean> => {
    setConsenting(true)
    try {
      const res = await grantAiConsent()
      if (!res.success) return false
      globalConsented = true
      notifyAll()
      return true
    } finally {
      setConsenting(false)
    }
  }, [])

  const ensureConsented = useCallback(
    async (text?: string): Promise<boolean> => {
      const { isGreeting } = await import("@/lib/conversation/classify")
      if (text !== undefined && isGreeting(text)) return true
      if (globalConsented === true) return true
      if (globalConsented === false) return false
      const fresh = await fetchOnce()
      return fresh === true
    },
    []
  )

  return { consented, consenting, grant, refresh, ensureConsented }
}
