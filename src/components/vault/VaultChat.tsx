"use client"

import { useState, useRef, useEffect } from "react"
import { Send, Archive } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { vaultChatAction } from "@/app/vault/actions"
import Link from "next/link"

interface VaultMessage {
  id: string
  role: "user" | "assistant"
  content: string
}

export function VaultChat() {
  const [messages, setMessages] = useState<VaultMessage[]>([])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages, sending])

  async function handleSend() {
    const text = input.trim()
    if (!text || sending) return
    setError(null)
    const userMsg: VaultMessage = { id: `${Date.now()}-u`, role: "user", content: text }
    setMessages((m) => [...m, userMsg])
    setInput("")
    setSending(true)
    try {
      const res = await vaultChatAction({ text })
      if (!res.ok) {
        const msg = res.error
        setError(msg)
        setMessages((m) => [...m, { id: `${Date.now()}-e`, role: "assistant", content: msg }])
        return
      }
      const assistantMsg: VaultMessage = { id: `${Date.now()}-a`, role: "assistant", content: res.content }
      setMessages((m) => [...m, assistantMsg])
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e) || "Vault query failed"
      setError(msg)
      setMessages((m) => [...m, { id: `${Date.now()}-e`, role: "assistant", content: msg }])
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-3xl space-y-4">
          {messages.length === 0 && (
            <div className="rounded-xl border bg-card p-6 text-center">
              <Archive className="mx-auto h-6 w-6 text-muted-foreground/60" />
              <p className="mt-2 text-sm font-medium">Ask about your whole vault</p>
              <p className="mt-1 text-xs text-muted-foreground">Try “which of my deals had an uncapped liability clause” or “open the contract I flagged last week”</p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {["which of my deals had an uncapped liability clause", "open the contract I flagged last week", "show me recent deals"].map((ex) => (
                  <button key={ex} onClick={() => setInput(ex)} className="rounded-full border bg-muted px-3 py-1 text-xs hover:bg-muted/80">
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                {m.content.split("\n").map((line, i) => {
                  const chatMatch = line.match(/\/chat\/([a-f0-9-]+)/)
                  if (chatMatch) {
                    const id = chatMatch[1]
                    return (
                      <span key={i}>
                        {line.split(chatMatch[0])[0]}
                        <Link href={`/chat/${id}`} className="underline font-medium">Open</Link>
                        {line.split(chatMatch[0])[1]}
                        {i < m.content.split("\n").length - 1 && <br />}
                      </span>
                    )
                  }
                  return <span key={i}>{line}{i < m.content.split("\n").length - 1 && <br />}</span>
                })}
              </div>
            </div>
          ))}
          {sending && <div className="flex justify-start"><div className="rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground">Thinking…</div></div>}
          {error && <div className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">Error: {error}</div>}
          <div ref={bottomRef} />
        </div>
      </div>
      <div className="border-t bg-background p-4">
        <div className="mx-auto max-w-3xl flex items-end gap-2">
          <Textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleSend() } }} placeholder="Ask about your vault..." rows={2} className="min-h-[52px] resize-none" aria-label="Vault question" />
          <Button onClick={() => void handleSend()} disabled={sending || !input.trim()} size="icon" aria-label="Send"><Send className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  )
}
