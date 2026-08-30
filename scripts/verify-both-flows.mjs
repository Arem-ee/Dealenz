import fs from "fs"
import path from "path"
const envRaw = fs.readFileSync(path.resolve("C:/Users/USER/Documents/DEALENZ/.env.local"), "utf-8")
for (const line of envRaw.split("\n")) {
  const t=line.trim(); if(!t||t.startsWith("#"))continue; const eq=t.indexOf("="); if(eq===-1)continue; const k=t.slice(0,eq).trim(),v=t.slice(eq+1).trim(); if(!process.env[k]) process.env[k]=v
}
console.log("Provider:", process.env.AI_PROVIDER, "Model:", process.env.AI_MODEL)

const { extractProjectData } = await import("../src/lib/ai/extract.ts")
const { analyzeRisk, analyzeGenericRiskWithVisibleFailure } = await import("../src/lib/ai/risk-analysis.ts")
const { generateNegotiationPoints } = await import("../src/lib/ai/negotiation.ts")

const genericBrief = `Lease Agreement Clause: Landlord rents 2-bedroom apartment at 123 Main St to Tenant for 12 months. Rent is $2000 per month due on the 1st. Security deposit $4000 non-refundable. Tenant responsible for all repairs and maintenance including plumbing and HVAC. Landlord may enter premises with 24 hours notice for any reason. Early termination fee equals 3 months rent. Utilities not mentioned. No cap on rent increases after term. Tenant waives right to jury trial.`

console.log("\n========== GENERIC DEAL TYPE ==========")
console.log("Input:", genericBrief.slice(0,200))
const genericExtracted = await extractProjectData(genericBrief, "generic")
console.log("\n--- ExtractedData (generic) ---")
console.log(JSON.stringify(genericExtracted,null,2))
const genericRiskResult = await analyzeGenericRiskWithVisibleFailure(genericExtracted)
console.log("\n--- GenericRiskReport ---")
console.log(JSON.stringify(genericRiskResult.report,null,2))
console.log("\nusedFallback:", genericRiskResult.usedFallback)
const points = await generateNegotiationPoints(genericExtracted, genericRiskResult.report)
console.log("\n--- Negotiation Points ---")
console.log(JSON.stringify(points,null,2))

const freelanceBrief = `Client wants a brand identity for a coffee shop: logo, brand guidelines, menu design. Timeline 3 weeks. Budget $4500. Client said ASAP and unlimited revisions included. Need to flag risks.`

console.log("\n========== FREELANCE DEAL TYPE ==========")
console.log("Input:", freelanceBrief.slice(0,200))
const freelanceExtracted = await extractProjectData(freelanceBrief, "freelance")
console.log("\n--- ExtractedData (freelance) ---")
console.log(JSON.stringify(freelanceExtracted,null,2))
const freelanceRiskResult = await analyzeRisk(freelanceExtracted)
console.log("\n--- RiskReport (freelance, 8 categories) ---")
console.log(JSON.stringify(freelanceRiskResult.report,null,2))
console.log("\nusedFallback:", freelanceRiskResult.usedFallback)
console.log("Categories:", Object.keys(freelanceRiskResult.report.categories).join(", "))
console.log("\nRegression check: freelance still uses 8 fixed categories and rule-engine fallback at src/lib/ai/risk-analysis.ts:124-133 and src/lib/risk/engine.ts:529")
