import fs from "fs"
import path from "path"
import React from "react"
import { renderToString } from "react-dom/server"
const envRaw = fs.readFileSync(path.resolve("C:/Users/USER/Documents/DEALENZ/.env.local"), "utf-8")
for (const line of envRaw.split("\n")) {
  const t=line.trim(); if(!t||t.startsWith("#"))continue; const eq=t.indexOf("="); if(eq===-1)continue; const k=t.slice(0,eq).trim(),v=t.slice(eq+1).trim(); if(!process.env[k]) process.env[k]=v
}
const { renderMarkdown } = await import("../src/lib/markdown.ts")

const payloads = [
  "# Hello\n<script>alert('XSS')</script>",
  "Hello <img src=x onerror=alert(1)> world",
  "Normal **bold** text",
  "[click](javascript:alert(1))",
  "<svg onload=alert(1)>",
]

for (const md of payloads) {
  const nodes = renderMarkdown(md)
  const html = renderToString(React.createElement(React.Fragment, null, ...nodes))
  console.log("INPUT:", JSON.stringify(md))
  console.log("OUTPUT HTML:", html.slice(0,500))
  const hasScriptTag = html.includes("<script") || html.includes("onerror") && html.includes("<img") && !html.includes("&lt;img")
  const hasExecutable = html.includes("<script>alert") || html.includes('onerror="alert')
  console.log("Contains executable script tag:", hasExecutable, "Contains escaped:", html.includes("&lt;script") || html.includes("&lt;img"))
  console.log("---")
}
console.log("If payloads show escaped &lt;script and no <script>alert, sanitization is inert via React escaping at src/lib/markdown.ts:126-132")
