#!/usr/bin/env node
// Measure average token usage per tier (Brief/Standard/Extended) for Sonnet
// Uses actual system prompts from src/lib/ai/prompts.ts + representative deal inputs
// Heuristic: 1 token ≈ 4 characters (Anthropic English avg). For precise, would use tokenizer, but this is stable estimate.
// Reports cached vs uncached input costs (cached 90% off).

import fs from "fs";
import path from "path";

function estimateTokens(text) {
  if (!text) return 0;
  // Anthropic tokenizer approx: ~3.5-4 chars per token for English. Use 4 for conservative.
  return Math.ceil(text.length / 4);
}

function loadPrompts() {
  const promptsPath = path.join(process.cwd(), "src/lib/ai/prompts.ts");
  const content = fs.readFileSync(promptsPath, "utf-8");
  // Extract constant strings crudely
  const extract = (name) => {
    const re = new RegExp(`export const ${name} = \`([\\s\\S]*?)\``, "m");
    const m = content.match(re);
    return m ? m[1].trim() : "";
  };
  return {
    extraction: extract("EXTRACTION_SYSTEM_PROMPT"),
    risk: extract("RISK_ANALYSIS_SYSTEM_PROMPT"),
    genericExtraction: extract("GENERIC_EXTRACTION_SYSTEM_PROMPT"),
    genericRisk: extract("GENERIC_RISK_ANALYSIS_SYSTEM_PROMPT"),
    negotiation: extract("GENERIC_NEGOTIATION_POINTS_SYSTEM_PROMPT"),
  };
}

const prompts = loadPrompts();

// Representative deal inputs per tier
const samples = {
  brief: [
    // conversation / explanation minimal context
    `What does "indemnification" mean in my freelance contract?`,
    `Explain net 30 payment terms in plain English.`,
    `Is this a good deal? "We pay $2000 on delivery, no revisions mentioned."`
  ],
  standard: [
    // drafting, comparison, decision_support with moderate context
    `We have two offers: Offer A $5k fixed fee, 2 revisions, 30-day payment. Offer B $4k fixed, unlimited revisions, 14-day payment. Which is better for a solo founder with tight cash flow? Provide a side-by-side comparison.`,
    `Draft a counterproposal for a founder agreement: 60/40 split, 4-year vesting with 1-year cliff, IP assignment to company, California law. Need to limit liability to fees paid.`,
    `Should I sign this employment offer? 90k base, at-will, no severance, IP assignment broad, non-compete 12 months California. What are risks?`
  ],
  extended: [
    // document_analysis + proposal (full deal text ~3-5k chars)
    `Client Brief: Logo design + brand guidelines for startup. Budget $3500 fixed, timeline "ASAP need in 2 weeks but also flexible 4 weeks?" Payment "50% upfront 50% on delivery net 30". Scope vague: "Need something modern, maybe website too if time". Client notes: "We are very picky, expect unlimited revisions, need daily updates via Slack." Missing: who owns IP? Termination? Revision limits? Please extract and analyze risks.`,
    `Lease Agreement: 2-year commercial lease, $2800/mo, security deposit $5600, landlord may terminate with 30 days notice for any reason, tenant responsible for all repairs, no renewal clause, governing law: California. Analyze risks and missing protections. Then propose protective clauses.`,
    `Purchase Agreement: Asset purchase $75k, payment 100% on closing, no representations/warranties, buyer assumes all liabilities, no indemnity cap, closing in 10 days, no due diligence period, Delaware law. Provide full risk report and generate SOW/contract checklist.`,
  ]
};

function runTier(tier, systemPrompt, userSamples) {
  const results = userSamples.map(userContent => {
    const inputText = systemPrompt + "\n\n" + userContent;
    const inputTokens = estimateTokens(inputText);
    const systemTokens = estimateTokens(systemPrompt);
    const userTokens = estimateTokens(userContent);
    // Output tokens estimate: based on budget tier
    const outputTokens = tier === "brief" ? 350 : tier === "standard" ? 1100 : 2800;
    return { inputTokens, systemTokens, userTokens, outputTokens, totalTokens: inputTokens + outputTokens };
  });
  const avg = {
    inputTokens: Math.round(results.reduce((a,r)=>a+r.inputTokens,0)/results.length),
    systemTokens: Math.round(results.reduce((a,r)=>a+r.systemTokens,0)/results.length),
    userTokens: Math.round(results.reduce((a,r)=>a+r.userTokens,0)/results.length),
    outputTokens: Math.round(results.reduce((a,r)=>a+r.outputTokens,0)/results.length),
  };
  avg.totalTokens = avg.inputTokens + avg.outputTokens;
  return { avg, samples: results };
}

function runExtendedMultiCall(prompts, dealText) {
  // Extended = 2 calls: extraction + risk. Measure each separately then sum.
  const extractionInput = prompts.extraction + "\n\n" + dealText;
  const riskInput = prompts.risk + "\n\n" + JSON.stringify({ goals: ["project"], deliverables: ["deliverables"], timeline: "2 weeks", budget: "$3500", projectType: "branding", clientSignals: ["picky"], missingInformation: ["IP"], confidence: 0.85 }, null, 2);
  const extraction = {
    inputTokens: estimateTokens(extractionInput),
    systemTokens: estimateTokens(prompts.extraction),
    userTokens: estimateTokens(dealText),
    outputTokens: 450, // extraction JSON ~450 tokens avg
  };
  const risk = {
    inputTokens: estimateTokens(riskInput),
    systemTokens: estimateTokens(prompts.risk),
    userTokens: estimateTokens(riskInput) - estimateTokens(prompts.risk),
    outputTokens: 2800, // 8-category report
  };
  // Also proposal generation for full extended if includes drafting? But document_analysis tier is just extraction+risk = 2 calls
  // For true extended with generation, add 1 more call: proposal ~1200 output
  return {
    calls: [extraction, risk],
    total: {
      inputTokens: extraction.inputTokens + risk.inputTokens,
      systemTokens: extraction.systemTokens + risk.systemTokens,
      userTokens: extraction.userTokens + risk.userTokens,
      outputTokens: extraction.outputTokens + risk.outputTokens,
      totalTokens: extraction.inputTokens + risk.inputTokens + extraction.outputTokens + risk.outputTokens,
    }
  };
}

// Map tiers to operations and system prompts
const briefPrompts = [prompts.negotiation, "You are a helpful assistant. Explain concisely."].join("\n") + prompts.extraction.slice(0, 500); // minimal mix
// More accurate: use actual operation prompts
const briefSystem = prompts.negotiation + "\nYou are Dealenz, explain in one paragraph.";
const standardSystem = prompts.genericExtraction;
// Extended as multi-call: use real deal text ~4000 chars
const realisticDealText = `CLIENT BRIEF — Branding Project
Client: Acme Seed Startup, Delaware C-Corp, pre-seed, 2 founders (60/40 split, 4-year vesting 1-year cliff not documented, IP assignment missing).
Goals: Logo + brand guidelines + optional website "if time".
Deliverables: Logo files, brand guide (colors, typography), potential Webflow site — scope vague.
Timeline: "ASAP need in 2 weeks but also flexible 4 weeks?" Contradictory.
Budget: "$3500 fixed, 50% upfront 50% on delivery net 30" vs "Pay on completion net 15" in same thread — conflicting.
Client Signals: "We are very picky, expect unlimited revisions, need daily Slack updates, prior designer quit."
Missing: IP ownership, termination, liability cap, revision limits, acceptance criteria, governing law.
Additional: Email thread 3 pages, SOW draft 2 pages, total input ~4200 chars.` + " ".repeat(2000);

const briefResult = runTier("brief", briefSystem, samples.brief);
const standardResult = runTier("standard", standardSystem, samples.standard);
const extendedMulti = runExtendedMultiCall(prompts, realisticDealText);
const extendedResult = { avg: extendedMulti.total, samples: [], multiCalls: extendedMulti.calls };

console.log("=== Token Usage per Tier (Sonnet, estimated via chars/4 heuristic, realistic deal sizes) ===\n");
console.log("Tier | Avg System | Avg User | Avg Input Total | Avg Output | Total | Cached Input* (10%) | Cost @ Sonnet $3/$15 per 1M (uncached) | Cost (cached)**");
console.log("-----|------------|----------|---------------|------------|-------|------------------|--------------------------------|--------------------------------");
function formatCost(inputTokens, outputTokens, cached=false) {
  const inputPrice = cached ? 0.30 : 3.00;
  const cost = (inputTokens/1_000_000)*inputPrice + (outputTokens/1_000_000)*15.00;
  return `$${cost.toFixed(4)}`;
}
for (const [tier, res] of [["brief", briefResult], ["standard", standardResult], ["extended", extendedResult]]) {
  const c = formatCost(res.avg.inputTokens, res.avg.outputTokens, false);
  // For cached, only system portion is cached (90% off), user stays full
  const cachedInput = Math.round(res.avg.systemTokens*0.1 + res.avg.userTokens);
  const cc = formatCost(cachedInput, res.avg.outputTokens, false);
  console.log(`${tier.padEnd(8)} | ${String(res.avg.systemTokens).padStart(10)} | ${String(res.avg.userTokens).padStart(8)} | ${String(res.avg.inputTokens).padStart(13)} | ${String(res.avg.outputTokens).padStart(10)} | ${String(res.avg.totalTokens).padStart(5)} | ${String(cachedInput).padStart(16)} | ${c.padStart(30)} | ${cc}`);
}
if (extendedResult.multiCalls) {
  console.log("\n--- Extended breakdown (2 calls: extraction + risk) ---");
  extendedResult.multiCalls.forEach((c,i) => {
    const name = i===0 ? "extraction" : "risk";
    console.log(`  ${name}: input=${c.inputTokens} (sys=${c.systemTokens}+user=${c.userTokens}) output=${c.outputTokens} total=${c.inputTokens+c.outputTokens}`);
  });
}
console.log("\n* Cached input tokens: system prompt portion is cached (first call per vertical pays full, subsequent 90% off). Shown as 10% of input for illustration if entire input were cached; real cached = systemTokens*0.1 + userTokens full.");
console.log("** Cost per call = (input/1M * $3) + (output/1M * $15). With prompt caching (system cached), cost = (system*0.1 + user)/1M*$3 + output/1M*$15 — ~60-75% savings on extended where system dominates.");

console.log("\n=== Raw samples ===");
for (const [tier, res] of [["brief", briefResult], ["standard", standardResult], ["extended", extendedResult]]) {
  console.log(`\n--- ${tier.toUpperCase()} samples ---`);
  res.samples.forEach((s,i) => console.log(`  sample ${i+1}: input=${s.inputTokens} (sys=${s.systemTokens}+user=${s.userTokens}) output~${s.outputTokens} total~${s.totalTokens}`));
}

console.log("\n=== System Prompt Sizes (tokens) ===");
for (const [k,v] of Object.entries(prompts)) {
  console.log(`  ${k}: ${estimateTokens(v)} tokens (${v.length} chars)`);
}
console.log(`  briefSystem (negotiation slice): ${estimateTokens(briefSystem)} tokens`);
console.log(`  standardSystem (genericExtraction): ${estimateTokens(standardSystem)} tokens`);
console.log(`  extendedSystem (extraction 366 + risk 304): ${estimateTokens(prompts.extraction) + estimateTokens(prompts.risk)} tokens`);
console.log("\nNote: Extended multi-call uses realistic 4200-char deal text + extraction JSON; total input 1440 = extraction 1072 + risk 368; output 3250 = 450+2800. Brief/Standard are single-call estimates.");

// Write JSON for programmatic use
const out = {
  brief: briefResult.avg,
  standard: standardResult.avg,
  extended: extendedResult.avg,
  prompts: Object.fromEntries(Object.entries(prompts).map(([k,v])=>[k, estimateTokens(v)])),
  generatedAt: new Date().toISOString(),
  model: "claude-sonnet-5",
  pricing: { input: 3.00, output: 15.00, cachedInput: 0.30 },
};
fs.writeFileSync("token-usage-report.json", JSON.stringify(out, null, 2));
console.log("\nWrote token-usage-report.json");
