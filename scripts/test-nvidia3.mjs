import fs from "fs"
import path from "path"
const envRaw = fs.readFileSync(path.resolve("C:/Users/USER/Documents/DEALENZ/.env.local"), "utf-8")
for (const line of envRaw.split("\n")) {
  const t=line.trim(); if(!t||t.startsWith("#"))continue; const eq=t.indexOf("="); if(eq===-1)continue; const k=t.slice(0,eq).trim(),v=t.slice(eq+1).trim(); if(!process.env[k]) process.env[k]=v
}
const baseUrl=(process.env.AI_BASE_URL||"https://integrate.api.nvidia.com/v1").replace(/\/+$/,"")
const url=`${baseUrl}/chat/completions`
const key=process.env.AI_API_KEY||process.env.GEMINI_API_KEY

const candidates=[
  "mistralai/mistral-7b-instruct-v0.3",
  "google/gemma-3-12b-it",
  "deepseek-ai/deepseek-v4-flash-0731",
  "nvidia/nemotron-3-nano-30b-a3b",
  "mistralai/mistral-large-2-instruct",
  "meta/llama-3.2-11b-vision-instruct",
  "deepseek-ai/deepseek-coder-6.7b-instruct",
  "google/gemma-2b",
  "nvidia/nemotron-3-super-120b-a12b",
]

async function testModel(model){
  console.log(`\n=== ${model} ===`)
  const controller=new AbortController()
  const to=setTimeout(()=>controller.abort(),15000)
  try{
    const body={model,messages:[{role:"system",content:"You are a test assistant. Reply exactly: HELLO_OK"},{role:"user",content:"Say hello."}],temperature:0,max_tokens:16}
    const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${key}`},body:JSON.stringify(body),signal:controller.signal})
    const t=await r.text()
    console.log(`HTTP ${r.status} ${t.slice(0,600)}`)
    if(r.ok){
      const j=JSON.parse(t)
      const c=j?.choices?.[0]?.message?.content
      if(c){ console.log("CONTENT:",JSON.stringify(c)); return true }
    }
    return false
  }catch(e){ console.log("ERROR:",e.message); return false } finally{clearTimeout(to)}
}
for(const m of candidates){
  const ok=await testModel(m)
  if(ok){ console.log(`\n>>> WINNER: ${m}`); break }
}
