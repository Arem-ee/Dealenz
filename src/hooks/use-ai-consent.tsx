"use client"

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"
import { getAiConsentStatus, grantAiConsent } from "@/lib/ai-consent"
import { createClient } from "@/lib/supabase/client"

type ConsentState = boolean | null

let globalConsented: ConsentState = null
let globalUserId: string | null = null
let globalFetching = false
let globalFetchPromise: Promise<boolean> | null = null
const listeners = new Set<() => void>()
let channel: BroadcastChannel | null = null
let channelUserId: string | null = null

function storageKey(userId: string | null) {
  return userId ? `dealenz:ai-consent:${userId}` : "dealenz:ai-consent"
}

function channelName(userId: string | null) {
  return userId ? `ai-consent:${userId}` : "ai-consent"
}

function getChannel(userId: string | null = globalUserId): BroadcastChannel | null {
  if (typeof window === "undefined") return null
  const name = channelName(userId)
  if (channel && channelUserId === userId) return channel
  try {
    if (channel) {
      try { channel.close() } catch {}
      channel = null
      channelUserId = null
    }
  } catch {}
  try {
    channel = new BroadcastChannel(name)
    channelUserId = userId
  } catch {
    channel = null
    channelUserId = null
  }
  return channel
}

function notifyAll() {
  for (const l of listeners) l()
  try {
    getChannel()?.postMessage({ type: "ai-consent-granted", userId: globalUserId })
  } catch {}
  try {
    if (globalUserId) {
      localStorage.setItem(storageKey(globalUserId), globalConsented ? "1" : "0")
    }
  } catch {}
}

function clearConsentCache(userId: string | null = globalUserId) {
  globalConsented = null
  globalFetching = false
  globalFetchPromise = null
  try {
    if (userId) localStorage.removeItem(storageKey(userId))
    else localStorage.removeItem("dealenz:ai-consent")
  } catch {}
  try {
    if (channel) {
      try { channel.close() } catch {}
      channel = null
      channelUserId = null
    }
  } catch {}
  for (const l of listeners) l()
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

function getSnapshot(): ConsentState {
  return globalConsented
}

async function resolveUserId(): Promise<string | null> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    return user?.id ?? null
  } catch {
    return null
  }
}

function fetchOnce(): Promise<boolean> {
  if (globalFetchPromise) return globalFetchPromise
  globalFetching = true
  globalFetchPromise = (async () => {
    const uid = await resolveUserId()
    if (uid !== globalUserId) {
      globalUserId = uid
      getChannel(uid)
    }
    if (!uid) {
      globalConsented = false
      notifyAll()
      return false
    }
    try {
      const v = await getAiConsentStatus()
      globalConsented = v
      globalUserId = uid
      getChannel(uid)
      notifyAll()
      return v
    } catch {
      globalConsented = false
      notifyAll()
      return false
    }
  })().finally(() => {
    globalFetching = false
    globalFetchPromise = null
  })
  return globalFetchPromise
}

if (typeof window !== "undefined") {
  try {
    getChannel()?.addEventListener("message", (e: MessageEvent) => {
      if (e.data?.type === "ai-consent-granted" && e.data?.userId === globalUserId) {
        globalConsented = true
        for (const l of listeners) l()
      }
    })
  } catch {}
  try {
    window.addEventListener("storage", (e) => {
      if (!globalUserId) return
      if (e.key === storageKey(globalUserId) && e.newValue === "1" && globalConsented !== true) {
        globalConsented = true
        for (const l of listeners) l()
      }
    })
  } catch {}
  try {
    const supabase = createClient()
    supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        clearConsentCache(globalUserId)
        globalUserId = null
      }
      if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        void resolveUserId().then((uid) => {
          if (uid && uid !== globalUserId) {
            globalUserId = uid
            globalConsented = null
            getChannel(uid)
            for (const l of listeners) l()
            void fetchOnce()
          }
        })
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
