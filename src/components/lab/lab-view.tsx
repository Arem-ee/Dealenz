"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { FlaskConical, Loader2, Play, Plus, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { diffLines } from "@/lib/diff/lines"
import { useToast } from "@/components/ui/toast"
import {
  createLabTemplate,
  deleteLabTemplate,
  getLabTemplate,
  listLabTemplates,
  promoteVersion,
  runLabPrompt,
  savePromptVersion,
  setRunEval,
  type LabRun,
  type LabTemplate,
  type LabVersion,
  type ReleaseEnv,
} from "@/app/(app)/lab/actions"

interface Detail {
  template: LabTemplate
  versions: LabVersion[]
  runs: LabRun[]
}

// Prompt Lab: versioned prompt registry with test runs. Every save mints an
// immutable version with a commit message; the prod label promotes without a
// redeploy; every run logs input, output, model, and usage on its version.
export function LabView() {
  const { showError } = useToast()
  const [templates, setTemplates] = useState<LabTemplate[] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [showNew, setShowNew] = useState(false)

  const loadList = useCallback(async () => {
    const res = await listLabTemplates()
    if (!res.ok) {
      showError(res.error, "Prompts failed to load")
      setTemplates([])
      return
    }
    setTemplates(res.templates)
  }, [showError])

  useEffect(() => {
    let live = true
    listLabTemplates()
      .then((res) => {
        if (!live) return
        if (!res.ok) {
          showError(res.error, "Prompts failed to load")
          setTemplates([])
          return
        }
        setTemplates(res.templates)
      })
      .catch(() => {
        if (!live) return
        showError("Prompts failed to load")
        setTemplates([])
      })
    return () => {
      live = false
    }
  }, [showError])

  const loadDetail = useCallback(
    async (id: string) => {
      setDetailLoading(true)
      try {
        const res = await getLabTemplate({ id })
        if (!res.ok) throw new Error(res.error)
        setDetail({ template: res.template, versions: res.versions, runs: res.runs })
      } catch (err) {
        showError(err instanceof Error ? err.message : "Prompt failed to load.")
      } finally {
        setDetailLoading(false)
      }
    },
    [showError]
  )

  function select(id: string) {
    setSelectedId(id)
    setDetail(null)
    setShowNew(false)
    void loadDetail(id)
  }

  async function afterMutation(id: string | null) {
    await loadList()
    if (id) await loadDetail(id)
  }

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col overflow-y-auto px-4 pb-6 sm:px-6">
      <div className="flex shrink-0 items-end justify-between gap-3 pb-4 pt-6">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-foreground">Prompt Lab</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Saved prompts, tested before they touch a deal.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowNew(true)
            setSelectedId(null)
            setDetail(null)
          }}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 bg-primary px-4 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" />
          New prompt
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
        <section aria-label="Saved prompts" className="shrink-0 md:w-72">
          <h2 className="text-sm font-semibold">Saved prompts</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Versioned, reusable, with run history each.</p>
          {templates === null ? (
            <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading prompts…
            </p>
          ) : templates.length === 0 ? (
            <div className="mt-2 border border-dashed px-4 py-10 text-center">
              <FlaskConical className="mx-auto h-6 w-6 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium">No saved prompts yet</p>
              <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
                Name one above — every save becomes a version.
              </p>
            </div>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {templates.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => select(t.id)}
                    aria-pressed={selectedId === t.id}
                    className={cn(
                      "w-full border px-3 py-2 text-left transition-colors",
                      selectedId === t.id
                        ? "border-foreground bg-muted"
                        : "border-border hover:border-foreground/50"
                    )}
                  >
                    <p className="text-[13px] font-semibold text-foreground">{t.name}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      v{t.currentVersion}
                      {t.stagingVersion !== null ? ` · staging v${t.stagingVersion}` : ""}
                      {t.prodVersion !== null ? ` · prod v${t.prodVersion}` : " · no prod version"}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="min-h-0 flex-1">
          {showNew ? (
            <TemplateEditor
              key="new"
              withName
              submitLabel="Save prompt"
              sectionLabel="New prompt"
              onSubmit={async (draft, meta) => {
                const res = await createLabTemplate({ name: meta.name, description: meta.description, ...draft })
                if (!res.ok) throw new Error(res.error)
                setShowNew(false)
                setSelectedId(res.template.id)
                void afterMutation(res.template.id)
              }}
              onCancel={() => setShowNew(false)}
            />
          ) : detailLoading ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading prompt…
            </p>
          ) : detail ? (
            <PromptDetail
              key={`${detail.template.id}-v${detail.template.currentVersion}`}
              detail={detail}
              onChanged={() => void afterMutation(detail.template.id)}
              onDeleted={() => {
                setDetail(null)
                setSelectedId(null)
                void loadList()
              }}
            />
          ) : (
            <section aria-label="Test run" className="shrink-0">
              <h2 className="text-sm font-semibold">Test run</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Try a prompt against sample input before trusting it.</p>
              <div className="mt-2 border border-dashed px-4 py-10 text-center">
                <p className="text-sm font-medium">Pick a prompt to run</p>
                <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
                  Versions, test runs, and evals live on each prompt.
                </p>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

function NumberField({
  label, value, onChange, min, max, step,
}: {
  label: string; value: number; onChange: (n: number) => void; min: number; max: number; step: number
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-9 w-full border border-input bg-background px-2 text-sm outline-none"
      />
    </label>
  )
}

export interface PromptDraft {
  systemText: string
  userTemplate: string
  model: string
  temperature: number
  maxTokens: number
}

function TemplateEditor({
  initial, withName, withCommit, submitLabel, sectionLabel, onSubmit, onCancel,
}: {
  initial?: PromptDraft
  withName?: boolean
  withCommit?: boolean
  submitLabel: string
  sectionLabel: string
  onSubmit: (draft: PromptDraft, meta: { name: string; description: string; commitMessage: string }) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [systemText, setSystemText] = useState(initial?.systemText ?? "")
  const [userTemplate, setUserTemplate] = useState(initial?.userTemplate ?? "")
  const [model, setModel] = useState(initial?.model ?? "")
  const [temperature, setTemperature] = useState(initial?.temperature ?? 0.7)
  const [maxTokens, setMaxTokens] = useState(initial?.maxTokens ?? 1024)
  const [commitMessage, setCommitMessage] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      await onSubmit(
        { systemText, userTemplate, model, temperature, maxTokens },
        { name, description, commitMessage }
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Not saved.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <section aria-label={sectionLabel} className="border border-border p-4">
      <h2 className="text-sm font-semibold">{sectionLabel}</h2>
      {withName ? (
        <div className="mt-2 grid gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            placeholder="Name, e.g. Risk summary"
            aria-label="Prompt name"
            className="h-9 w-full border border-input bg-background px-2 text-sm outline-none placeholder:text-muted-foreground/60"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            placeholder="What this prompt is for (optional)"
            aria-label="Prompt description"
            className="h-9 w-full border border-input bg-background px-2 text-sm outline-none placeholder:text-muted-foreground/60"
          />
        </div>
      ) : null}
      <div className="mt-2 grid gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-muted-foreground">System (optional)</span>
          <textarea
            value={systemText}
            onChange={(e) => setSystemText(e.target.value)}
            rows={3}
            maxLength={8000}
            placeholder="Role and rules for the model"
            aria-label="System prompt"
            className="w-full border border-input bg-background px-2 py-1.5 text-xs outline-none placeholder:text-muted-foreground/60"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-muted-foreground">Prompt — use {"{{variable}}"} for inputs</span>
          <textarea
            value={userTemplate}
            onChange={(e) => setUserTemplate(e.target.value)}
            rows={6}
            maxLength={12000}
            placeholder="Summarize the risk in {{document}} for {{audience}}."
            aria-label="User prompt template"
            className="w-full border border-input bg-background px-2 py-1.5 text-xs outline-none placeholder:text-muted-foreground/60"
          />
        </label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-muted-foreground">Model override (optional)</span>
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              maxLength={160}
              placeholder="Auto"
              aria-label="Model override"
              className="h-9 w-full border border-input bg-background px-2 text-sm outline-none placeholder:text-muted-foreground/60"
            />
          </label>
          <NumberField label="Temperature" value={temperature} onChange={setTemperature} min={0} max={2} step={0.1} />
          <NumberField label="Max tokens" value={maxTokens} onChange={setMaxTokens} min={1} max={16000} step={1} />
        </div>
      </div>
      {withCommit ? (
        <input
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          maxLength={280}
          placeholder="What changed and why (goes in history)"
          aria-label="Commit message"
          className="mt-2 h-9 w-full border border-input bg-background px-2 text-xs outline-none placeholder:text-muted-foreground/60"
        />
      ) : null}
      {error ? <p role="alert" className="mt-2 text-xs text-destructive">{error}</p> : null}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || (withName && !name.trim()) || !userTemplate.trim()}
          className="h-8 bg-primary px-3 text-[11px] font-semibold text-primary-foreground disabled:opacity-40"
        >
          {submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="h-8 px-2 text-[11px] text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </section>
  )
}

function VersionDiff({ from, to }: { from: LabVersion | null; to: LabVersion }) {
  const lines = useMemo(() => {
    if (!from) return null
    return diffLines(from.userTemplate, to.userTemplate)
  }, [from, to])
  const paramChanged =
    from !== null &&
    (from.systemText !== to.systemText || from.model !== to.model ||
      from.temperature !== to.temperature || from.maxTokens !== to.maxTokens)
  if (!from) return null
  return (
    <div className="mt-1.5 border border-border" aria-label={`Changes in v${to.version}`}>
      {paramChanged ? (
        <p className="border-b border-border px-2 py-1 text-[11px] text-muted-foreground">
          {from.systemText !== to.systemText ? "System changed. " : ""}
          {from.model !== to.model ? `Model ${from.model || "Auto"} → ${to.model || "Auto"}. ` : ""}
          {from.temperature !== to.temperature ? `Temp ${from.temperature} → ${to.temperature}. ` : ""}
          {from.maxTokens !== to.maxTokens ? `Max ${from.maxTokens} → ${to.maxTokens}.` : ""}
        </p>
      ) : null}
      {lines && lines.some((l) => l.type !== "same") ? (
        <div className="max-h-48 overflow-y-auto" aria-label="Prompt text diff">
          {lines.map((l, i) =>
            l.type === "same" ? null : (
              <div
                key={i}
                className={cn(
                  "border-l-2 px-2 py-0.5 font-mono text-[11px] leading-relaxed",
                  l.type === "add" && "border-green-700 bg-green-50 text-foreground",
                  l.type === "del" && "border-[var(--destructive)] bg-red-50 text-foreground"
                )}
              >
                <span className="mr-2 inline-block w-3 select-none text-muted-foreground" aria-hidden="true">
                  {l.type === "add" ? "+" : "−"}
                </span>
                {l.text === "" ? " " : l.text}
              </div>
            )
          )}
        </div>
      ) : (
        <p className="px-2 py-1 text-[11px] text-muted-foreground">Text unchanged{paramChanged ? "" : " — metadata-only save"}.</p>
      )}
    </div>
  )
}

function VersionSelect({
  label, value, onPick, versions, template,
}: {
  label: string
  value: number | null
  onPick: (n: number) => void
  versions: LabVersion[]
  template: LabTemplate
}) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {label}
      <select
        value={value ?? ""}
        onChange={(e) => onPick(Number(e.target.value))}
        className="h-8 border border-border bg-background px-2 text-xs text-foreground"
        aria-label={`${label} version to run`}
      >
        {versions.map((v) => (
          <option key={v.id} value={v.version}>
            v{v.version}
            {template.stagingVersion === v.version ? " (staging)" : ""}
            {template.prodVersion === v.version ? " (prod)" : ""}
          </option>
        ))}
      </select>
    </label>
  )
}

function AbVariables({
  names, runVars, setRunVars,
}: {
  names: string[]
  runVars: Record<string, string>
  setRunVars: (updater: (prev: Record<string, string>) => Record<string, string>) => void
}) {
  if (names.length === 0) return <p className="mt-2 text-[11px] text-muted-foreground">No variables — runs as written.</p>
  return (
    <div className="mt-2 grid gap-1.5">
      {names.map((name) => (
        <label key={name} className="flex items-center gap-2">
          <span className="w-28 shrink-0 font-mono text-[11px] text-muted-foreground">{"{{"}{name}{"}}"}</span>
          <input
            value={runVars[name] ?? ""}
            onChange={(e) => setRunVars((prev) => ({ ...prev, [name]: e.target.value }))}
            aria-label={`Value for ${name}`}
            className="h-8 min-w-0 flex-1 border border-input bg-background px-2 text-xs outline-none"
          />
        </label>
      ))}
    </div>
  )
}

function PromptDetail({
  detail, onChanged, onDeleted,
}: {
  detail: Detail
  onChanged: () => void
  onDeleted: () => void
}) {
  const { showError } = useToast()
  const [showEdit, setShowEdit] = useState(false)
  const [runVersion, setRunVersion] = useState<number>(detail.template.currentVersion)
  const [runVars, setRunVars] = useState<Record<string, string>>({})
  const [runOutput, setRunOutput] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [abEnabled, setAbEnabled] = useState(false)
  const [versionB, setVersionB] = useState<number | null>(null)
  const [abResult, setAbResult] = useState<{ a: LabRun; b: LabRun } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [evalNote, setEvalNote] = useState<Record<string, string>>({})
  const [diffFor, setDiffFor] = useState<number | null>(null)

  const head = detail.versions.find((v) => v.version === detail.template.currentVersion) ?? detail.versions[0] ?? null
  const runTarget = detail.versions.find((v) => v.version === runVersion) ?? head
  const targetB = detail.versions.find((v) => v.version === versionB) ?? null
  // Shared inputs: the union of both sides' variables, A-first.
  const abVariableNames = useMemo(() => {
    const names: string[] = []
    for (const v of [runTarget, ...(abEnabled ? [targetB] : [])]) {
      for (const n of v?.variables ?? []) {
        if (!names.includes(n)) names.push(n)
      }
    }
    return names
  }, [runTarget, targetB, abEnabled])

  async function handleRun() {
    if (running || !runTarget) return
    setRunning(true)
    setRunOutput(null)
    try {
      const res = await runLabPrompt({ templateId: detail.template.id, version: runTarget.version, variables: runVars })
      if (!res.ok) throw new Error(res.error)
      setRunOutput(res.run.output)
      onChanged()
    } catch (err) {
      showError(err instanceof Error ? err.message : "Test run failed.")
    } finally {
      setRunning(false)
    }
  }

  // A/B: same input against two versions, side by side. Each side is a full
  // priced run with its own history row — score both, promote the winner.
  async function handleRunAb() {
    const targetB = detail.versions.find((v) => v.version === versionB) ?? null
    if (running || !runTarget || !targetB || runTarget.version === targetB.version) return
    setRunning(true)
    setAbResult(null)
    try {
      const [ra, rb] = await Promise.all([
        runLabPrompt({ templateId: detail.template.id, version: runTarget.version, variables: runVars }),
        runLabPrompt({ templateId: detail.template.id, version: targetB.version, variables: runVars }),
      ])
      if (!ra.ok) throw new Error(ra.error)
      if (!rb.ok) throw new Error(rb.error)
      setAbResult({ a: ra.run, b: rb.run })
      onChanged()
    } catch (err) {
      showError(err instanceof Error ? err.message : "A/B run failed.")
    } finally {
      setRunning(false)
    }
  }

  async function handleAbEval(which: "a" | "b", score: number | null) {
    const run = abResult?.[which]
    if (!run) return
    try {
      const res = await setRunEval({ runId: run.id, score })
      if (!res.ok) throw new Error(res.error)
      setAbResult((prev) => (prev ? { ...prev, [which]: res.run } : prev))
      onChanged()
    } catch (err) {
      showError(err instanceof Error ? err.message : "Eval not saved.")
    }
  }

  async function handleEval(run: LabRun, score: number | null) {
    try {
      const res = await setRunEval({ runId: run.id, score, note: evalNote[run.id] ?? run.evalNote })
      if (!res.ok) throw new Error(res.error)
      onChanged()
    } catch (err) {
      showError(err instanceof Error ? err.message : "Eval not saved.")
    }
  }

  async function handlePromote(env: ReleaseEnv, version: number | null) {
    try {
      const res = await promoteVersion({ templateId: detail.template.id, env, version })
      if (!res.ok) throw new Error(res.error)
      onChanged()
    } catch (err) {
      showError(err instanceof Error ? err.message : "Promotion failed.")
    }
  }

  async function handleDelete() {
    try {
      const res = await deleteLabTemplate({ id: detail.template.id })
      if (!res.ok) throw new Error(res.error)
      onDeleted()
    } catch (err) {
      showError(err instanceof Error ? err.message : "Prompt not deleted.")
    }
  }

  return (
    <div className="space-y-4">
      <section aria-label="Prompt header" className="border border-border p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold">{detail.template.name}</h2>
            {detail.template.description ? (
              <p className="mt-0.5 text-xs text-muted-foreground">{detail.template.description}</p>
            ) : null}
            <p className="mt-1 text-[11px] text-muted-foreground">
              v{detail.template.currentVersion}
              {detail.template.stagingVersion !== null ? ` · staging v${detail.template.stagingVersion}` : ""}
              {detail.template.prodVersion !== null ? ` · prod v${detail.template.prodVersion}` : " · no prod version"}
            </p>
          </div>
          <div className="flex shrink-0 gap-1">
            <button
              type="button"
              onClick={() => setShowEdit(true)}
              className="h-8 border border-border px-2.5 text-[11px] font-medium text-muted-foreground hover:text-foreground"
            >
              Edit → new version
            </button>
            <button
              type="button"
              aria-label={`Delete prompt: ${detail.template.name}`}
              onClick={() => setConfirmDelete(true)}
              className="p-1.5 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        {confirmDelete ? (
          <div className="mt-2 flex items-center gap-2 border-t border-border pt-2">
            <p className="text-[11px] text-muted-foreground">Delete this prompt, all versions, and all runs?</p>
            <button
              type="button"
              onClick={() => void handleDelete()}
              className="h-7 bg-destructive px-2.5 text-[11px] font-semibold text-destructive-foreground"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground"
            >
              Keep
            </button>
          </div>
        ) : null}
      </section>

      {showEdit && head ? (
        <TemplateEditor
          key={`edit-${detail.template.id}-v${detail.template.currentVersion}`}
          initial={{
            systemText: head.systemText, userTemplate: head.userTemplate, model: head.model,
            temperature: head.temperature, maxTokens: head.maxTokens,
          }}
          withCommit
          submitLabel={`Save as v${detail.template.currentVersion + 1}`}
          sectionLabel="New version"
          onSubmit={async (draft, meta) => {
            const res = await savePromptVersion({
              templateId: detail.template.id,
              ...draft,
              commitMessage: meta.commitMessage,
            })
            if (!res.ok) throw new Error(res.error)
            setShowEdit(false)
            onChanged()
          }}
          onCancel={() => setShowEdit(false)}
        />
      ) : null}

      <section aria-label="Test run">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Test run</h3>
          <button
            type="button"
            aria-pressed={abEnabled}
            onClick={() => {
              setAbEnabled(!abEnabled)
              setAbResult(null)
              setRunOutput(null)
              if (!abEnabled && versionB === null) {
                const other = detail.versions.find((v) => v.version !== runVersion)
                setVersionB(other?.version ?? null)
              }
            }}
            className={cn(
              "h-7 border px-2 text-[11px] font-medium transition-colors",
              abEnabled
                ? "border-foreground bg-muted font-semibold text-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            A/B: two versions
          </button>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {abEnabled
            ? "Same input, two versions, side by side — each side is a separately priced run."
            : "Priced like a short Ask — estimate first, measured settle after."}
        </p>
        <div className="mt-2 border border-border p-3">
          <div className="flex flex-wrap items-center gap-2">
            <VersionSelect
              label={abEnabled ? "A" : "Version"}
              value={runVersion}
              versions={detail.versions}
              template={detail.template}
              onPick={(n) => {
                setRunVersion(n)
                setRunVars({})
                setRunOutput(null)
                setAbResult(null)
              }}
            />
            {abEnabled ? (
              <VersionSelect
                label="B"
                value={versionB}
                versions={detail.versions}
                template={detail.template}
                onPick={(n) => {
                  setVersionB(n)
                  setAbResult(null)
                }}
              />
            ) : null}
          </div>
          <AbVariables runVars={runVars} setRunVars={setRunVars} names={abVariableNames} />
          {abEnabled ? (
            <button
              type="button"
              onClick={() => void handleRunAb()}
              disabled={running || !runTarget || versionB === null || runVersion === versionB}
              className="mt-2 inline-flex h-8 items-center gap-1.5 bg-primary px-3 text-[11px] font-semibold text-primary-foreground disabled:opacity-40"
            >
              {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              {running ? "Running both." : "Run both"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleRun()}
              disabled={running || !runTarget}
              className="mt-2 inline-flex h-8 items-center gap-1.5 bg-primary px-3 text-[11px] font-semibold text-primary-foreground disabled:opacity-40"
            >
              {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              {running ? "Running." : "Run test"}
            </button>
          )}
          {runOutput !== null && !abEnabled ? (
            <p className="mt-2 whitespace-pre-wrap border-t border-border pt-2 text-xs leading-relaxed">{runOutput}</p>
          ) : null}
          {abEnabled && abResult ? (
            <div className="mt-2 grid gap-px border border-border bg-border md:grid-cols-2" aria-label="A/B results">
              {(["a", "b"] as const).map((side) => {
                const run = abResult[side]
                return (
                  <div key={side} className="bg-background p-3">
                    <p className="text-xs font-semibold">
                      {side === "a" ? "A" : "B"} · v{run.version} · {run.modelServed || "unknown model"}
                    </p>
                    <p className="mt-1 max-h-64 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed">{run.output}</p>
                    <div className="mt-2 flex items-center gap-1">
                      <span className="text-[11px] text-muted-foreground">Eval:</span>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <button
                          key={s}
                          type="button"
                          aria-pressed={run.evalScore === s}
                          onClick={() => void handleAbEval(side, run.evalScore === s ? null : s)}
                          className={cn(
                            "h-6 w-6 border text-[11px] transition-colors",
                            run.evalScore === s
                              ? "border-foreground bg-muted font-semibold text-foreground"
                              : "border-border text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : null}
        </div>
      </section>

      <section aria-label="Version history">
        <h3 className="text-sm font-semibold">Versions</h3>
        <ul className="mt-2 space-y-1.5">
          {detail.versions.map((v, i) => {
            const prev = detail.versions[i + 1] ?? null
            const isProd = detail.template.prodVersion === v.version
            const isStaging = detail.template.stagingVersion === v.version
            return (
              <li key={v.id} className="border border-border px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold">
                      v{v.version}
                      {isStaging ? <span className="ml-1.5 font-normal text-foreground">· staging</span> : null}
                      {isProd ? <span className="ml-1.5 font-normal text-green-700">· prod</span> : null}
                      <span className="ml-1.5 font-normal text-muted-foreground">
                        {v.model || "Auto"} · {v.temperature} · {v.maxTokens} tokens
                      </span>
                    </p>
                    {v.commitMessage ? <p className="mt-0.5 text-[11px] text-muted-foreground">{v.commitMessage}</p> : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-1">
                    {prev ? (
                      <button
                        type="button"
                        onClick={() => setDiffFor(diffFor === v.version ? null : v.version)}
                        className="h-7 border border-border px-2 text-[11px] text-muted-foreground hover:text-foreground"
                      >
                        {diffFor === v.version ? "Hide diff" : "Diff"}
                      </button>
                    ) : null}
                    {!isStaging ? (
                      <button
                        type="button"
                        onClick={() => void handlePromote("staging", v.version)}
                        className="h-7 border border-border px-2 text-[11px] text-muted-foreground hover:text-foreground"
                      >
                        To staging
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handlePromote("staging", null)}
                        className="h-7 border border-border px-2 text-[11px] text-muted-foreground hover:text-foreground"
                      >
                        Unstage
                      </button>
                    )}
                    {!isProd ? (
                      <button
                        type="button"
                        onClick={() => void handlePromote("prod", v.version)}
                        className="h-7 border border-border px-2 text-[11px] text-muted-foreground hover:text-foreground"
                      >
                        To prod
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handlePromote("prod", null)}
                        className="h-7 border border-border px-2 text-[11px] text-muted-foreground hover:text-foreground"
                      >
                        Unpromote
                      </button>
                    )}
                  </div>
                </div>
                {diffFor === v.version ? <VersionDiff from={prev} to={v} /> : null}
              </li>
            )
          })}
        </ul>
      </section>

      <section aria-label="Run history">
        <h3 className="text-sm font-semibold">Runs</h3>
        {detail.runs.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">No runs yet — test a version above.</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {detail.runs.map((r) => (
              <li key={r.id} className="border border-border px-3 py-2">
                <p className="text-[11px] text-muted-foreground">
                  v{r.version} · {r.modelServed || "unknown model"}
                  {r.promptTokens !== null ? ` · in ${r.promptTokens}` : ""}
                  {r.completionTokens !== null ? ` out ${r.completionTokens}` : ""}
                  {r.latencyMs !== null ? ` · ${(r.latencyMs / 1000).toFixed(1)}s` : ""}
                  {r.status === "failure" ? " · failed" : ""}
                </p>
                {r.output ? (
                  <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs leading-relaxed">{r.output}</p>
                ) : null}
                <div className="mt-1.5 flex flex-wrap items-center gap-1">
                  <span className="text-[11px] text-muted-foreground">Eval:</span>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      aria-pressed={r.evalScore === s}
                      onClick={() => void handleEval(r, r.evalScore === s ? null : s)}
                      className={cn(
                        "h-6 w-6 border text-[11px] transition-colors",
                        r.evalScore === s
                          ? "border-foreground bg-muted font-semibold text-foreground"
                          : "border-border text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {s}
                    </button>
                  ))}
                  <input
                    value={evalNote[r.id] ?? r.evalNote}
                    onChange={(e) => setEvalNote((prev) => ({ ...prev, [r.id]: e.target.value }))}
                    onBlur={() => {
                      const next = (evalNote[r.id] ?? r.evalNote).trim().slice(0, 1000)
                      if (next !== r.evalNote) void handleEval(r, r.evalScore)
                    }}
                    maxLength={1000}
                    placeholder="Eval note"
                    aria-label={`Eval note for run ${r.id}`}
                    className="h-6 min-w-0 flex-1 border border-input bg-background px-1.5 text-[11px] outline-none placeholder:text-muted-foreground/60"
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
