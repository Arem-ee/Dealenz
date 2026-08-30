import fs from "fs"
import path from "path"
const envRaw = fs.readFileSync(path.resolve("C:/Users/USER/Documents/DEALENZ/.env.local"), "utf-8")
for (const line of envRaw.split("\n")) {
  const t=line.trim(); if(!t||t.startsWith("#"))continue; const eq=t.indexOf("="); if(eq===-1)continue; const k=t.slice(0,eq).trim(),v=t.slice(eq+1).trim(); if(!process.env[k]) process.env[k]=v
}
console.log("Env:", process.env.AI_PROVIDER, process.env.AI_MODEL, process.env.AI_BASE_URL, (process.env.AI_API_KEY||"").slice(0,10))

const { extractProjectData } = await import("../src/lib/ai/extract.ts")
const { analyzeRisk } = await import("../src/lib/ai/risk-analysis.ts")

const brief = "Client wants a brand identity for a coffee shop: logo, brand guidelines, menu design. Timeline 3 weeks. Budget $4500. Client said ASAP and unlimited revisions included. Also mentioned tight budget and want work-for-hire IP transfer."

console.log("\n--- extractProjectData (real prompt) ---")
const data = await extractProjectData(brief)
console.log("extracted:", JSON.stringify(data,null,2))
console.log("\n--- analyzeRisk (real prompt) ---")
const { report, usedFallback } = await analyzeRisk(data)
console.log("usedFallback:", usedFallback)
console.log("overallScore:", report.overallScore, "riskLevel:", report.riskLevel)
console.log("summary:", report.summary.slice(0,200))
console.log("categories keys:", Object.keys(report.categories))
console.log("scopeRisk score:", report.categories.scopeRisk.score, "severity", report.categories.scopeRisk.severity)
console.log("\nE2E SUCCESS: both extraction and risk via callAI/NVIDIA worked")
