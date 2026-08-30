import fs from "fs"
import path from "path"

const envPath = path.resolve("C:/Users/USER/Documents/DEALENZ/.env.local")
const envRaw = fs.readFileSync(envPath, "utf-8")
for (const line of envRaw.split("\n")) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith("#")) continue
  const eq = trimmed.indexOf("=")
  if (eq === -1) continue
  const k = trimmed.slice(0, eq).trim()
  const v = trimmed.slice(eq + 1).trim()
  if (!process.env[k]) process.env[k] = v
}

console.log("Env loaded:")
console.log("  AI_PROVIDER =", process.env.AI_PROVIDER)
console.log("  AI_MODEL    =", process.env.AI_MODEL || process.env.GEMINI_MODEL)
console.log("  AI_BASE_URL =", process.env.AI_BASE_URL)
console.log("  AI_API_KEY  =", (process.env.AI_API_KEY || "").slice(0, 12) + "..." + (process.env.AI_API_KEY || "").slice(-6))

const model = process.env.AI_MODEL || "meta/llama-3.3-70b-instruct"
const baseUrl = (process.env.AI_BASE_URL || "https://integrate.api.nvidia.com/v1").replace(/\/+$/, "")
const url = baseUrl.endsWith("/chat/completions") ? baseUrl : `${baseUrl}/chat/completions`
const key = process.env.AI_API_KEY || process.env.GEMINI_API_KEY

// --- Step 1: list models (diagnostic, non-fatal) ---
console.log("\n--- Step 1: GET /v1/models (diagnostic) ---")
try {
  const listUrl = `${baseUrl}/models`
  const r = await fetch(listUrl, { headers: { Authorization: `Bearer ${key}` } })
  const t = await r.text()
  console.log(`GET ${listUrl} -> HTTP ${r.status}`)
  console.log(t.slice(0, 800))
} catch (e) {
  console.error("models list failed:", e.message)
}

// --- Step 2: minimal chat completion ---
console.log("\n--- Step 2: POST /v1/chat/completions (minimal hello) ---")
try {
  const body = {
    model,
    messages: [
      { role: "system", content: "You are a test assistant. Reply with exactly: HELLO_FROM_NVIDIA" },
      { role: "user", content: "Say hello." },
    ],
    temperature: 0,
    max_tokens: 20,
  }
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  })
  const t = await r.text()
  console.log(`POST ${url} model=${model} -> HTTP ${r.status}`)
  console.log(t.slice(0, 1200))
  if (!r.ok) {
    console.error("Minimal chat failed — will try fallback model")
    throw new Error(`HTTP ${r.status}`)
  }
  const j = JSON.parse(t)
  console.log("Extracted content:", j?.choices?.[0]?.message?.content)
} catch (e) {
  console.error("Minimal chat error:", e.message)
}

// --- Step 3: real extraction prompt ---
console.log("\n--- Step 3: Real EXTRACTION_SYSTEM_PROMPT via NVIDIA ---")
import { EXTRACTION_SYSTEM_PROMPT } from "../src/lib/ai/prompts.ts" // will fail in plain mjs — load manually
