import fs from "fs"
import path from "path"
// load .env.local manually (we will override AI_MODEL to winner)
const envRaw = fs.readFileSync(path.resolve("C:/Users/USER/Documents/DEALENZ/.env.local"), "utf-8")
for (const line of envRaw.split("\n")) {
  const t=line.trim(); if(!t||t.startsWith("#"))continue; const eq=t.indexOf("="); if(eq===-1)continue; const k=t.slice(0,eq).trim(),v=t.slice(eq+1).trim(); if(!process.env[k]) process.env[k]=v
}
// force winner model for this test
process.env.AI_MODEL = "nvidia/nemotron-3-nano-30b-a3b"
process.env.AI_PROVIDER = "openai_compatible"
process.env.AI_BASE_URL = "https://integrate.api.nvidia.com/v1"

console.log("Testing callAI wrapper with:")
console.log("  AI_PROVIDER=", process.env.AI_PROVIDER)
console.log("  AI_MODEL   =", process.env.AI_MODEL)
console.log("  AI_BASE_URL=", process.env.AI_BASE_URL)
console.log("  AI_API_KEY =", (process.env.AI_API_KEY||"").slice(0,10)+"...")

// Need tsx to import TS files with aliases; register tsx
// Use dynamic import via file URL handling
// We'll import the compiled provider directly by re-implementing wrapper logic here but also test actual client.ts via transpilation
// Simpler: directly import client.ts via node's ESM loader with tsx
import { createRequire } from "module"
let callAI
try {
  // Try using tsx loader
  const { callAI: ca } = await import("../src/lib/ai/client.ts")
  callAI = ca
  console.log("Imported callAI from src/lib/ai/client.ts successfully")
} catch (e) {
  console.error("Failed to import client.ts:", e.message)
  console.log("Falling back to direct provider test")
}

if (callAI) {
  const EXTRACTION_SYSTEM_PROMPT = `You are an expert project analyst. Extract structured information from the following client brief, project description, or deal context.

Return a JSON object with exactly these fields:
{
  "goals": ["list of project goals identified"],
  "deliverables": ["list of deliverables mentioned"],
  "timeline": "mentioned timeline or null",
  "budget": "mentioned budget or null",
  "projectType": "type of project or null",
  "clientSignals": ["notable signals about client behavior, expectations, or red flags"],
  "missingInformation": ["important information that is not provided but would be needed"],
  "confidence": 0.85
}

Rules:
- goals: Extract explicit and implicit goals. 1-5 items.
- deliverables: Extract specific deliverables mentioned. 1-10 items.
- timeline: Exact quote or paraphrase. null if not mentioned.
- budget: Exact quote or paraphrase. null if not mentioned.
- projectType: Categorize the project. null if unclear.
- clientSignals: Include both positive and negative signals.
- missingInformation: List critical missing information for a complete project scope.
- confidence: Number 0-1 indicating extraction confidence.

Return ONLY valid JSON. No markdown formatting or code blocks.`

  const userBrief = "Client wants a brand identity for a coffee shop: logo, brand guidelines, menu design. Timeline 3 weeks. Budget $4500. Client said ASAP and unlimited revisions included. Need to flag risks."

  console.log("\n--- Calling callAI with EXTRACTION_SYSTEM_PROMPT ---")
  const raw = await callAI({ systemPrompt: EXTRACTION_SYSTEM_PROMPT, userContent: userBrief, temperature: 0.2, maxTokens: 1000 })
  console.log("\nRAW response (first 2000 chars):\n", raw.slice(0, 2000))
  console.log("\n--- Testing extractJson + parse ---")
  // replicate extractJson from extract.ts
  function extractJson(text){
    const trimmed=text.trim()
    const stripped=trimmed.replace(/^```(?:json)?\s*/i,"").replace(/\s*```\s*$/i,"").trim()
    if(stripped.startsWith("{")) return stripped
    const start=text.indexOf("{"), end=text.lastIndexOf("}")
    if(start!==-1 && end!==-1 && end>start) return text.slice(start,end+1)
    throw new Error("No JSON object found")
  }
  try{
    const cleaned=extractJson(raw)
    console.log("Cleaned JSON (first 800):", cleaned.slice(0,800))
    const parsed=JSON.parse(cleaned)
    console.log("\nPARSED SUCCESS: goals=", parsed.goals, " deliverables=", parsed.deliverables, " confidence=", parsed.confidence)
    console.log("clientSignals=", parsed.clientSignals)
    console.log("missingInformation=", parsed.missingInformation)
    console.log("JSON extraction SUCCEEDED")
  }catch(e){ console.error("JSON extraction FAILED:", e.message) }

  // Test document generation style prompt too
  console.log("\n--- Calling callAI for Proposal-style generation (markdown) ---")
  const proposalPrompt = `You are a professional proposal writer for a creative/tech agency. Write a compelling project proposal in markdown based on the following extracted project data.

EXTRACTED PROJECT DATA:
${JSON.stringify({goals:["Create brand identity"],deliverables:["Logo","Guidelines"],timeline:"3 weeks",budget:"$4500",projectType:"Brand Identity"},null,2)}

Write a professional proposal in markdown format with Project Overview, Goals, Deliverables sections. Use proper markdown.`
  const raw2 = await callAI({ systemPrompt: proposalPrompt, userContent: "Generate proposal now.", temperature: 0.4, maxTokens: 800 })
  console.log("\nRAW proposal (first 1000):\n", raw2.slice(0,1000))
  console.log("\nProposal generation:", raw2.includes("# Proposal") || raw2.includes("Proposal") ? "looks valid markdown" : "unexpected")
}
