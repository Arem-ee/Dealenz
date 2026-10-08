-- 00111: Prompt Lab registry (Phase B).
--
-- Industry baseline (prompt-management practice: PromptLayer/LangSmith/
-- Langfuse/Latitude): prompts are versioned, testable assets outside
-- application code. Every save creates an immutable version with a commit
-- message; diffs and rollback are first-class; release labels (prod/staging
-- pointers) promote versions without redeploys; every run logs full input,
-- output, model served, and measured cost/latency against the exact version;
-- evaluations annotate runs with scores and notes.
--
-- prompt_templates: registry entries. current_version is the latest saved;
-- prod_version is the release label (nullable = nothing promoted yet).
-- prompt_versions: immutable history — SELECT/INSERT/DELETE only, no UPDATE
-- policy, so versions can never be rewritten. prompt_runs: append-mostly run
-- log; the app updates eval_score/eval_note only (run output is immutable
-- by convention, enforced in the server actions).
--
-- Forward-only, additive. Owner-scoped RLS mirrors standing_instructions
-- (00081): the authenticated user manages only their own rows, deletes
-- cascade with the auth user and the parent template. No service-role
-- bypass, no shared reads.

CREATE TABLE prompt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  description TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 500),
  current_version INT NOT NULL DEFAULT 1 CHECK (current_version >= 1),
  prod_version INT NULL CHECK (prod_version IS NULL OR prod_version >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX prompt_templates_user_updated_idx
  ON prompt_templates (user_id, updated_at DESC);

ALTER TABLE prompt_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own prompt templates"
  ON prompt_templates FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE prompt_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES prompt_templates(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version INT NOT NULL CHECK (version >= 1),
  system_text TEXT NOT NULL CHECK (char_length(system_text) <= 8000),
  user_template TEXT NOT NULL CHECK (char_length(user_template) BETWEEN 1 AND 12000),
  model TEXT NOT NULL DEFAULT '' CHECK (char_length(model) <= 160),
  temperature NUMERIC NOT NULL DEFAULT 0.7 CHECK (temperature >= 0 AND temperature <= 2),
  max_tokens INT NOT NULL DEFAULT 1024 CHECK (max_tokens >= 1 AND max_tokens <= 16000),
  commit_message TEXT NOT NULL DEFAULT '' CHECK (char_length(commit_message) <= 280),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (template_id, version)
);

CREATE INDEX prompt_versions_template_idx
  ON prompt_versions (template_id, version DESC);

ALTER TABLE prompt_versions ENABLE ROW LEVEL SECURITY;

-- Immutable history: no UPDATE policy, so versions can never be rewritten.
CREATE POLICY "Users read own prompt versions"
  ON prompt_versions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own prompt versions"
  ON prompt_versions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own prompt versions"
  ON prompt_versions FOR DELETE
  USING (auth.uid() = user_id);

CREATE TABLE prompt_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES prompt_templates(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version INT NOT NULL CHECK (version >= 1),
  input JSONB NOT NULL DEFAULT '{}',
  output TEXT NOT NULL DEFAULT '' CHECK (char_length(output) <= 32000),
  model_served TEXT NOT NULL DEFAULT '' CHECK (char_length(model_served) <= 160),
  prompt_tokens INT NULL CHECK (prompt_tokens IS NULL OR prompt_tokens >= 0),
  completion_tokens INT NULL CHECK (completion_tokens IS NULL OR completion_tokens >= 0),
  latency_ms INT NULL CHECK (latency_ms IS NULL OR latency_ms >= 0),
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failure')),
  eval_score INT NULL CHECK (eval_score IS NULL OR (eval_score >= 1 AND eval_score <= 5)),
  eval_note TEXT NOT NULL DEFAULT '' CHECK (char_length(eval_note) <= 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX prompt_runs_template_idx
  ON prompt_runs (template_id, created_at DESC);

ALTER TABLE prompt_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own prompt runs"
  ON prompt_runs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
