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
const candidates = [
  "nvidia/llama-3.1-nemotron-70b-instruct",
  "nvidia/llama-3.1-nemotron-ultra-253b-v1",
  "meta/llama-3.2-90b-vision-instruct",
  "mistralai/mistral-large-2-instruct",
  "nvidia/nemotron-3-nano-30b-a3b",
]
const baseUrl=(process.env.AI_BASE_URL||"https://integrate.api.nvidia.com/v1").replace(/\/+$/,"")
const url = `${baseUrl}/chat/completions`
const key=process.env.AI_API_KEY||process.env.GEMINI_API_KEY
for (const model of candidates) {
  console.log(`\n=== Testing model: ${model} ===`)
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
    console.log(`HTTP ${r.status}`)
    console.log(t.slice(0, 800))
    if (r.ok) {
      const j = JSON.parse(t)
      console.log(" -> content:", JSON.stringify(j?.choices?.[0]?.message?.content))
      console.log("SUCCESS with", model)
      // test JSON extraction prompt as well
      const extractBody = {
        model,
        messages: [
          { role: "system", content: `You are an expert project analyst. Extract structured information.\nReturn a JSON object with exactly these fields:\n{\n  "goals": ["list of project goals identified"],\n  "deliverables": ["list of deliverables mentioned"],\n  "timeline": "mentioned timeline or null",\n  "budget": "mentioned budget or null",\n  "projectType": "type of project or null",\n  "clientSignals": ["notable signals"],\n  "missingInformation": ["important missing info"],\n  "confidence": 0.85\n}\nReturn ONLY valid JSON. No markdown formatting or code blocks.` },
          { role: "user", content: "Client wants a brand identity for a coffee shop: logo, brand guidelines, menu design. Timeline 3 weeks. Budget $4500. Client said ASAP and unlimited revisions included." },
        ],
        temperature: 0.2,
        max_tokens: 800,
      }
      const r2 = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify(extractBody),
      })
      const t2 = await r2.text()
      console.log(`JSON extraction HTTP ${r2.status}`)
      console.log(t2.slice(0, 1500))
      if (r2.ok) {
        const j2 = JSON.parse(t2)
        const raw = j2?.choices?.[0]?.message?.content || ""
        console.log("\nRAW extraction text:", raw.slice(0, 1000))
        try {
          let cleaned = raw.trim()
          const stripped = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim()
          let candidate = stripped.startsWith("{") ? stripped : (() => {
            const s = raw.indexOf("{"), e = raw.lastIndexOf("}")
            return s!==-1 && e!==-1 && e>s ? raw.slice(s,e+1) : stripped
          })()
          const parsed = JSON.parse(candidate)
          console.log("\nPARSED goals:", parsed.goals)
          console.log("PARSED deliverables:", parsed.deliverables)
          console.log("PARSED confidence:", parsed.confidence)
          console.log("JSON EXTRACTION SUCCESS")
        } catch (e) {
          console.error("JSON extraction parse FAIL:", e.message)
        }
      }
      break
    }
  } catch (e) {
    console.error(e.message)
  }
}
