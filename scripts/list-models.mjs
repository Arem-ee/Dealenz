import fs from "fs"
import path from "path"
const envRaw = fs.readFileSync(path.resolve("C:/Users/USER/Documents/DEALENZ/.env.local"), "utf-8")
for (const line of envRaw.split("\n")) {
  const t = line.trim()
  if (!t || t.startsWith("#")) continue
  const eq = t.indexOf("=")
  if (eq===-1) continue
  const k=t.slice(0,eq).trim(), v=t.slice(eq+1).trim()
  if(!process.env[k]) process.env[k]=v
}
const baseUrl=(process.env.AI_BASE_URL||"https://integrate.api.nvidia.com/v1").replace(/\/+$/,"")
const key=process.env.AI_API_KEY||process.env.GEMINI_API_KEY
const r=await fetch(`${baseUrl}/models`,{headers:{Authorization:`Bearer ${key}`}})
const j=await r.json()
console.log(`HTTP ${r.status}, total models: ${j.data.length}`)
for (const m of j.data) {
  if (/llama|nemotron|mistral|qwen|deepseek|gemma|phi/i.test(m.id)) console.log(m.id)
}
console.log("--- ALL ids (first 40) ---")
j.data.slice(0,40).forEach(m=>console.log(m.id))
