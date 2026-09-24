"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"

export type ThemeChoice = "light" | "dark" | "system"
export type ResolvedTheme = "light" | "dark"

const STORAGE_KEY = "dealenz.theme"

function resolveTheme(choice: ThemeChoice): ResolvedTheme {
  if (choice === "dark") return "dark"
  if (choice === "light") return "light"
  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
  }
  return "light"
}

function readStored(): ThemeChoice {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === "light" || raw === "dark" || raw === "system") return raw
  } catch {
    // Private mode: fall through to default.
  }
  return "light"
}

function applyTheme(resolved: ResolvedTheme) {
  const root = document.documentElement
  root.classList.toggle("dark", resolved === "dark")
  root.style.colorScheme = resolved === "dark" ? "dark" : "light"
}

/**
 * Pre-paint theme bootstrap, inlined in <head> by the root layout so the
 * first paint already matches the stored choice (no light flash). Must stay
 * in sync with readStored/resolveTheme above.
 */
export const THEME_BOOTSTRAP_SCRIPT = `(function(){try{var t=localStorage.getItem("${STORAGE_KEY}")||"light";var d=t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);if(d){document.documentElement.classList.add("dark");document.documentElement.style.colorScheme="dark";}}catch(e){}})();`

interface ThemeContextValue {
  choice: ThemeChoice
  resolved: ResolvedTheme
  setChoice: (choice: ThemeChoice) => void
}

const ThemeContext = createContext<ThemeContextValue>({ choice: "light", resolved: "light", setChoice: () => {} })

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [choice, setChoiceState] = useState<ThemeChoice>("light")
  const [resolved, setResolved] = useState<ResolvedTheme>("light")

  useEffect(() => {
    // Intentional post-mount sync (not derived state): storage is unreadable
    // during SSR, so the first render must match the server HTML and correct
    // after mount. See the pre-paint bootstrap for first-paint correctness.
    /* eslint-disable react-hooks/set-state-in-effect */
    const stored = readStored()
    setChoiceState(stored)
    setResolved(resolveTheme(stored))
    /* eslint-enable react-hooks/set-state-in-effect */
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const onChange = () => {
      // Only follow the OS when the user explicitly chose System.
      // No stored choice means the light default: never go dark unasked.
      try {
        if ((window.localStorage.getItem(STORAGE_KEY) ?? "light") === "system") {
          setResolved(media.matches ? "dark" : "light")
        }
      } catch {
        setResolved("light")
      }
    }
    media.addEventListener("change", onChange)
    return () => media.removeEventListener("change", onChange)
  }, [])

  useEffect(() => {
    applyTheme(resolved)
  }, [resolved])

  const setChoice = useCallback((next: ThemeChoice) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Preference simply does not persist.
    }
    setChoiceState(next)
    setResolved(resolveTheme(next))
  }, [])

  const value = useMemo(() => ({ choice, resolved, setChoice }), [choice, resolved, setChoice])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext)
}
