"use server"

import { randomUUID } from "node:crypto"
import { createClient } from "@/lib/supabase/server"
import { callAIForSurface } from "@/lib/ai/providers"
import { logAIUsage, toUsageRecord } from "@/lib/ai/usage"
import { authorizeOperation, completeOperation } from "@/lib/credits/policy"
import { STANDARD_CREDIT_POLICY } from "@/lib/credits/pricing"
import { checkRateLimit } from "@/lib/rate-limit"
import {
  extractPromptVariables,
  MAX_COMMIT_MESSAGE,
  MAX_EVAL_NOTE,
  MAX_PROMPT_DESCRIPTION,
  MAX_SYSTEM_TEXT,
  MAX_USER_TEMPLATE,
  normalizePromptName,
  renderPromptTemplate,
} from "@/lib/prompts/variables"

export interface LabTemplate {
  id: string
  name: string
  description: string
  currentVersion: number
  prodVersion: number | null
  stagingVersion: number | null
  updatedAt: string
}

export interface LabVersion {
  id: string
  version: number
  systemText: string
  userTemplate: string
  model: string
  temperature: number
  maxTokens: number
  commitMessage: string
  variables: string[]
  createdAt: string
}

export interface LabRun {
  id: string
  version: number
  input: Record<string, string>
  output: string
  modelServed: string
  promptTokens: number | null
  completionTokens: number | null
  latencyMs: number | null
  status: "success" | "failure"
  evalScore: number | null
  evalNote: string
  createdAt: string
}

type ActionOk<T> = { ok: true } & T
type ActionFail = { ok: false; error: string }

const VERSION_COLUMNS = "id, version, system_text, user_template, model, temperature, max_tokens, commit_message, created_at"
const RUN_COLUMNS = "id, version, input, output, model_served, prompt_tokens, completion_tokens, latency_ms, status, eval_score, eval_note, created_at"

function toVersion(row: Record<string, unknown>): LabVersion | null {
  if (typeof row.id !== "string" || typeof row.version !== "number") return null
  if (typeof row.user_template !== "string") return null
  return {
    id: row.id,
    version: row.version,
    systemText: typeof row.system_text === "string" ? row.system_text : "",
    userTemplate: row.user_template,
    model: typeof row.model === "string" ? row.model : "",
    temperature: typeof row.temperature === "number" ? row.temperature : 0.7,
    maxTokens: typeof row.max_tokens === "number" ? row.max_tokens : 1024,
    commitMessage: typeof row.commit_message === "string" ? row.commit_message : "",
    variables: extractPromptVariables(row.user_template),
    createdAt: typeof row.created_at === "string" ? row.created_at : "",
  }
}

function toRun(row: Record<string, unknown>): LabRun | null {
  if (typeof row.id !== "string" || typeof row.version !== "number") return null
  const status = row.status
  if (status !== "success" && status !== "failure") return null
  const rawInput = row.input
  const input: Record<string, string> = {}
  if (rawInput && typeof rawInput === "object" && !Array.isArray(rawInput)) {
    for (const [k, v] of Object.entries(rawInput as Record<string, unknown>)) {
      if (typeof v === "string") input[k] = v;
    }
  }
  return {
    id: row.id,
    version: row.version,
    input,
    output: typeof row.output === "string" ? row.output : "",
    modelServed: typeof row.model_served === "string" ? row.model_served : "",
    promptTokens: typeof row.prompt_tokens === "number" ? row.prompt_tokens : null,
    completionTokens: typeof row.completion_tokens === "number" ? row.completion_tokens : null,
    latencyMs: typeof row.latency_ms === "number" ? row.latency_ms : null,
    status,
    evalScore: typeof row.eval_score === "number" ? row.eval_score : null,
    evalNote: typeof row.eval_note === "string" ? row.eval_note : "",
    createdAt: typeof row.created_at === "string" ? row.created_at : "",
  }
}

interface VersionInput {
  systemText?: string
  userTemplate: string
  model?: string
  temperature?: number
  maxTokens?: number
  commitMessage?: string
}

function validatedVersionInput(input: VersionInput):
  | { ok: true; systemText: string; userTemplate: string; model: string; temperature: number; maxTokens: number; commitMessage: string }
  | { ok: false; error: string } {
  const userTemplate = typeof input.userTemplate === "string" ? input.userTemplate.slice(0, MAX_USER_TEMPLATE) : ""
  if (!userTemplate.trim()) return { ok: false, error: "Write the prompt first." }
  const systemText = typeof input.systemText === "string" ? input.systemText.slice(0, MAX_SYSTEM_TEXT) : ""
  const model = typeof input.model === "string" ? input.model.trim().slice(0, 160) : ""
  const temperature = typeof input.temperature === "number" && Number.isFinite(input.temperature)
    ? Math.min(2, Math.max(0, input.temperature))
    : 0.7
  const maxTokens = typeof input.maxTokens === "number" && Number.isFinite(input.maxTokens)
    ? Math.min(16000, Math.max(1, Math.floor(input.maxTokens)))
    : 1024
  const commitMessage = typeof input.commitMessage === "string"
    ? input.commitMessage.trim().slice(0, MAX_COMMIT_MESSAGE)
    : ""
  return { ok: true, systemText, userTemplate, model, temperature, maxTokens, commitMessage }
}

/** Registry entries, most recently updated first. */
export async function listLabTemplates(): Promise<ActionOk<{ templates: LabTemplate[] }> | ActionFail> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "You must be signed in." }
  const { data, error } = await supabase
    .from("prompt_templates")
    .select("id, name, description, current_version, prod_version, staging_version, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(100)
  if (error) return { ok: false, error: "We couldn't load your prompts. Please try again." }
  return {
    ok: true,
    templates: ((data ?? []) as Array<{
      id: string; name: string; description: string | null; current_version: number; prod_version: number | null; staging_version: number | null; updated_at: string
    }>).map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description ?? "",
      currentVersion: t.current_version,
      prodVersion: t.prod_version, stagingVersion: t.staging_version,
      updatedAt: t.updated_at,
    })),
  }
}

/** One template with its immutable version history and recent runs. */
export async function getLabTemplate(input: {
  id: string
}): Promise<ActionOk<{ template: LabTemplate; versions: LabVersion[]; runs: LabRun[] }> | ActionFail> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "You must be signed in." }
  const { data: template, error } = await supabase
    .from("prompt_templates")
    .select("id, name, description, current_version, prod_version, staging_version, updated_at")
    .eq("id", (input.id ?? "").trim())
    .eq("user_id", user.id)
    .maybeSingle()
  if (error || !template) return { ok: false, error: "Prompt not found." }
  const t = template as { id: string; name: string; description: string | null; current_version: number; prod_version: number | null; staging_version: number | null; updated_at: string }
  const { data: versionRows } = await supabase
    .from("prompt_versions")
    .select(VERSION_COLUMNS)
    .eq("template_id", t.id)
    .eq("user_id", user.id)
    .order("version", { ascending: false })
    .limit(100)
  const { data: runRows } = await supabase
    .from("prompt_runs")
    .select(RUN_COLUMNS)
    .eq("template_id", t.id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50)
  return {
    ok: true,
    template: {
      id: t.id, name: t.name, description: t.description ?? "",
      currentVersion: t.current_version, prodVersion: t.prod_version, stagingVersion: t.staging_version, updatedAt: t.updated_at,
    },
    versions: ((versionRows ?? []) as Array<Record<string, unknown>>)
      .map(toVersion)
      .filter((v): v is LabVersion => v !== null),
    runs: ((runRows ?? []) as Array<Record<string, unknown>>)
      .map(toRun)
      .filter((r): r is LabRun => r !== null),
  }
}

/** Creates a template with its first immutable version. */
export async function createLabTemplate(input: {
  name: string
  description?: string
  systemText?: string
  userTemplate: string
  model?: string
  temperature?: number
  maxTokens?: number
}): Promise<ActionOk<{ template: LabTemplate }> | ActionFail> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "You must be signed in." }
  const name = normalizePromptName(input.name)
  if (!name) return { ok: false, error: "Name the prompt first." }
  const checked = validatedVersionInput(input)
  if (!checked.ok) return { ok: false, error: checked.error }
  const description = typeof input.description === "string" ? input.description.trim().slice(0, MAX_PROMPT_DESCRIPTION) : ""
  const { data: template, error: templateError } = await supabase
    .from("prompt_templates")
    .insert({ user_id: user.id, name, description, current_version: 1, prod_version: null, staging_version: null })
    .select("id, name, description, current_version, prod_version, staging_version, updated_at")
    .single()
  if (templateError || !template) return { ok: false, error: "We couldn't save that prompt. Please try again." }
  const templateId = (template as { id: string }).id
  const { error: versionError } = await supabase.from("prompt_versions").insert({
    template_id: templateId,
    user_id: user.id,
    version: 1,
    system_text: checked.systemText,
    user_template: checked.userTemplate,
    model: checked.model,
    temperature: checked.temperature,
    max_tokens: checked.maxTokens,
    commit_message: "First version.",
  })
  if (versionError) {
    await supabase.from("prompt_templates").delete().eq("id", templateId).eq("user_id", user.id)
    return { ok: false, error: "We couldn't save that prompt. Please try again." }
  }
  const t = template as { id: string; name: string; description: string | null; current_version: number; prod_version: number | null; staging_version: number | null; updated_at: string }
  return {
    ok: true,
    template: {
      id: t.id, name: t.name, description: t.description ?? "",
      currentVersion: t.current_version, prodVersion: t.prod_version, stagingVersion: t.staging_version, updatedAt: t.updated_at,
    },
  }
}

/**
 * Saves an edit as a new immutable version (prior versions are never
 * rewritten). Concurrent saves collide on the version unique key and retry
 * honestly instead of forking history.
 */
export async function savePromptVersion(input: {
  templateId: string
} & VersionInput): Promise<ActionOk<{ version: LabVersion }> | ActionFail> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "You must be signed in." }
  const checked = validatedVersionInput(input)
  if (!checked.ok) return { ok: false, error: checked.error }
  const { data: template } = await supabase
    .from("prompt_templates")
    .select("id, current_version")
    .eq("id", (input.templateId ?? "").trim())
    .eq("user_id", user.id)
    .maybeSingle()
  const head = template as { id: string; current_version: number } | null
  if (!head) return { ok: false, error: "Prompt not found." }
  const next = head.current_version + 1
  const { data, error } = await supabase
    .from("prompt_versions")
    .insert({
      template_id: head.id,
      user_id: user.id,
      version: next,
      system_text: checked.systemText,
      user_template: checked.userTemplate,
      model: checked.model,
      temperature: checked.temperature,
      max_tokens: checked.maxTokens,
      commit_message: checked.commitMessage,
    })
    .select(VERSION_COLUMNS)
    .single()
  if (error) {
    const msg = (error.message ?? "").toLowerCase()
    if (msg.includes("duplicate") || msg.includes("unique")) {
      return { ok: false, error: "Someone just saved a version — refresh and try again." }
    }
    return { ok: false, error: "We couldn't save that version. Please try again." }
  }
  await supabase
    .from("prompt_templates")
    .update({ current_version: next, updated_at: new Date().toISOString() })
    .eq("id", head.id)
    .eq("user_id", user.id)
  const version = toVersion(data as Record<string, unknown>)
  if (!version) return { ok: false, error: "We couldn't save that version. Please try again." }
  return { ok: true, version }
}

/**
 * Test-runs a version: renders {{variables}} strictly, then estimate →
 * reserve → execute → measure → finalize through the standard credit
 * policy. Every run logs input, output, model served, and measured usage
 * against the exact version — reproducibility, not vibes.
 */
export async function runLabPrompt(input: {
  templateId: string
  version?: number
  variables?: Record<string, string>
}): Promise<ActionOk<{ run: LabRun; balance: number | null }> | ActionFail> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "You must be signed in." }
  const { data: template } = await supabase
    .from("prompt_templates")
    .select("id, current_version")
    .eq("id", (input.templateId ?? "").trim())
    .eq("user_id", user.id)
    .maybeSingle()
  const head = template as { id: string; current_version: number } | null
  if (!head) return { ok: false, error: "Prompt not found." }
  const versionNumber = input.version ?? head.current_version
  const { data: versionRow } = await supabase
    .from("prompt_versions")
    .select(VERSION_COLUMNS)
    .eq("template_id", head.id)
    .eq("user_id", user.id)
    .eq("version", versionNumber)
    .maybeSingle()
  const version = versionRow ? toVersion(versionRow as Record<string, unknown>) : null
  if (!version) return { ok: false, error: "That version no longer exists." }

  const values: Record<string, string> = {}
  for (const [k, v] of Object.entries(input.variables ?? {})) {
    if (typeof v === "string") values[k] = v;
  }
  const rendered = renderPromptTemplate(version.userTemplate, values)
  if (!rendered.ok) {
    return { ok: false, error: `Missing variables: ${rendered.missing.join(", ")}` }
  }

  const cap = await checkRateLimit("prompt_run")
  if (!cap.allowed) return { ok: false, error: cap.error ?? "You've reached today's test-run limit. Please try again tomorrow." }

  const authorization = await authorizeOperation({
    ledger: supabase as never,
    userId: user.id,
    operation: "prompt_test",
    idempotencyKey: randomUUID(),
    policy: STANDARD_CREDIT_POLICY,
    inputChars: rendered.text.length,
  })
  if (!authorization.authorized) {
    return { ok: false, error: authorization.denialReason ?? "Insufficient credits for this test run." }
  }

  const started = Date.now()
  let text: string
  let modelServed = ""
  let usage: { inputTokens: number; outputTokens: number } | undefined
  try {
    const res = await callAIForSurface("authenticated", {
      systemPrompt: version.systemText.trim()
        ? version.systemText
        : "You are Dealenz Prompt Lab. Follow the user template exactly.",
      userContent: rendered.text,
      temperature: version.temperature,
      maxTokens: version.maxTokens,
      ...(version.model.trim() ? { model: version.model.trim() } : {}),
    })
    text = res.text
    modelServed = `${res.meta.primary.provider}/${res.meta.primary.model}`
    usage = res.meta.usage
  } catch (err) {
    await supabase.from("prompt_runs").insert({
      template_id: head.id,
      user_id: user.id,
      version: version.version,
      input: values,
      output: "",
      model_served: "",
      status: "failure",
    })
    await completeOperation({
      ledger: supabase as never,
      authorization,
      operation: "prompt_test",
      status: "provider_failure",
      policy: STANDARD_CREDIT_POLICY,
      inputChars: rendered.text.length,
    }).catch(() => undefined)
    await logAIUsage(
      toUsageRecord({ operation: "prompt_test", provider: "unattributed", model: "unattributed", status: "provider_failure" }),
      { userId: user.id }
    ).catch(() => undefined)
    return { ok: false, error: err instanceof Error ? "Test run failed — please try again." : "Test run failed — please try again." }
  }

  const latencyMs = Date.now() - started
  const { data: runRow, error: runError } = await supabase
    .from("prompt_runs")
    .insert({
      template_id: head.id,
      user_id: user.id,
      version: version.version,
      input: values,
      output: text.slice(0, 32000),
      model_served: modelServed.slice(0, 160),
      prompt_tokens: usage?.inputTokens ?? null,
      completion_tokens: usage?.outputTokens ?? null,
      latency_ms: latencyMs,
      status: "success",
    })
    .select(RUN_COLUMNS)
    .single()
  const completion = await completeOperation({
    ledger: supabase as never,
    authorization,
    operation: "prompt_test",
    provider: modelServed.split("/")[0] ?? "unattributed",
    model: modelServed,
    usage,
    status: "success",
    policy: STANDARD_CREDIT_POLICY,
    inputChars: rendered.text.length,
  }).catch(() => null)
  const usageRecord = toUsageRecord({
    operation: "prompt_test", provider: modelServed.split("/")[0] ?? "unattributed", model: modelServed,
    usage, status: "success",
  })
  if (completion) usageRecord.creditsConsumed = completion.record.creditsConsumed
  await logAIUsage(usageRecord, { userId: user.id }).catch(() => undefined)
  if (runError || !runRow) return { ok: false, error: "The run finished but wasn't logged — please try again." }
  const run = toRun(runRow as Record<string, unknown>)
  if (!run) return { ok: false, error: "The run finished but wasn't logged — please try again." }
  return { ok: true, run, balance: completion?.balance ?? null }
}

/** Annotates a run with an eval score (1–5) and/or note. Output is immutable. */
export async function setRunEval(input: {
  runId: string
  score?: number | null
  note?: string
}): Promise<ActionOk<{ run: LabRun }> | ActionFail> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "You must be signed in." }
  if (!input.runId.trim()) return { ok: false, error: "That run no longer exists." }
  const patch: Record<string, unknown> = {}
  if (input.score !== undefined) {
    if (input.score !== null && (!Number.isInteger(input.score) || input.score < 1 || input.score > 5)) {
      return { ok: false, error: "Score is 1–5." }
    }
    patch.eval_score = input.score
  }
  if (input.note !== undefined) {
    patch.eval_note = typeof input.note === "string" ? input.note.trim().slice(0, MAX_EVAL_NOTE) : ""
  }
  if (Object.keys(patch).length === 0) return { ok: false, error: "Nothing to save." }
  // Eval columns only — output, input, and usage are never rewritten.
  const { data, error } = await supabase
    .from("prompt_runs")
    .update(patch)
    .eq("id", input.runId.trim())
    .eq("user_id", user.id)
    .select(RUN_COLUMNS)
    .maybeSingle()
  if (error || !data) return { ok: false, error: "We couldn't save that eval. Please try again." }
  const run = toRun(data as Record<string, unknown>)
  if (!run) return { ok: false, error: "We couldn't save that eval. Please try again." }
  return { ok: true, run }
}

export type ReleaseEnv = "staging" | "prod"

/**
 * Moves a release label (staging or prod) to a version — promotion without
 * a redeploy. Pass null to unpromote. Staging gates prod by convention: the
 * UI promotes dev → staging → prod, but the action enforces existence only,
 * never order, so recovery promotion stays possible.
 */
export async function promoteVersion(input: {
  templateId: string
  env: ReleaseEnv
  version: number | null
}): Promise<ActionOk<{ stagingVersion: number | null; prodVersion: number | null }> | ActionFail> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "You must be signed in." }
  if (input.env !== "staging" && input.env !== "prod") return { ok: false, error: "Unknown environment." }
  const templateId = (input.templateId ?? "").trim()
  if (!templateId) return { ok: false, error: "Prompt not found." }
  if (input.version !== null) {
    const { data: exists } = await supabase
      .from("prompt_versions")
      .select("id")
      .eq("template_id", templateId)
      .eq("user_id", user.id)
      .eq("version", input.version)
      .limit(1)
    if ((exists ?? []).length === 0) return { ok: false, error: "That version no longer exists." }
  }
  const patch = {
    ...(input.env === "staging" ? { staging_version: input.version } : { prod_version: input.version }),
    updated_at: new Date().toISOString(),
  }
  const { data, error } = await supabase
    .from("prompt_templates")
    .update(patch)
    .eq("id", templateId)
    .eq("user_id", user.id)
    .select("staging_version, prod_version")
    .maybeSingle()
  if (error || !data) return { ok: false, error: "We couldn't promote that version. Please try again." }
  const row = data as { staging_version: number | null; prod_version: number | null }
  return { ok: true, stagingVersion: row.staging_version, prodVersion: row.prod_version }
}

/** Deletes a template with its full history and runs. The UI confirms first. */
export async function deleteLabTemplate(input: {
  id: string
}): Promise<ActionOk<{ deleted: boolean }> | ActionFail> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "You must be signed in." }
  const { error } = await supabase
    .from("prompt_templates")
    .delete()
    .eq("id", (input.id ?? "").trim())
    .eq("user_id", user.id)
  if (error) return { ok: false, error: "We couldn't delete that prompt. Please try again." }
  return { ok: true, deleted: true }
}

