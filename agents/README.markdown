---
disabled: true
---

# Agents

## Review references

Reviewer agents load `@reviewer-standards` for role and conduct rules. They load
`@review-template` for report structure. `@global-coding-style` remains the style
authority when it applies.

## Model routing and defaults

Custom agent `model` and `variant` values are in `agents/*.md` frontmatter. The
central [`opencode.jsonc`](../opencode.jsonc) defines the global `model`,
`small_model`, and `default_agent` values and built-in agent overrides. Agent
Markdown files also define prompts, descriptions, and roles. The approved
allocation is:

| Model | Variant | Agents |
|-------|---------|--------|
| `openai/gpt-6-astra` | `high` | `lead`, `planner`, `architect`, `architecture-reviewer`, `code-reviewer`, `security-reviewer`, `typescript-reviewer`, `go-reviewer`, `csharp-reviewer`, `php-reviewer`, `efcore-developer`, `doctrine-developer`, `performance-optimizer` |
| `openai/gpt-5.6-sol` | `medium` | `typescript-developer`, `react-developer`, `go-developer`, `csharp-developer`, `php-developer`, `laminas-developer`, `github-actions-developer`, `gitlab-ci-developer`, `code-simplifier`, `refactor-cleaner`; built-in `general` |
| `openai/gpt-5.6-terra` | `medium` | `doc-updater`; built-in `explore`, `summary`, `compaction` |
| `openai/gpt-5.6-luna` | `low` | Built-in `title` |

Global `model` falls back to `openai/gpt-6-astra`; `default_agent` is `lead` (primary). All other custom agents are subagents. Global `small_model` is `openai/gpt-5.6-luna`. It has no variant field: the `title` agent's explicit `low` setting does **not** guarantee low effort for other internal small-model calls.

### Built-in roles

| Built-in | Role / local override |
|----------|-----------------------|
| `build` | Default coding agent, disabled locally with `disable: true`; use `lead` instead. |
| `plan` | Built-in planning agent, disabled locally with `disable: true`; use custom `planner` instead. |
| `general` | General-purpose delegated work, Sol `medium`. |
| `explore` | Codebase search and exploration, Terra `medium`. |
| `summary` | Hidden internal summary generation, Terra `medium`. |
| `compaction` | Hidden internal context compaction, Terra `medium`. |
| `title` | Hidden internal session-title generation, Luna `low`. |

### Compatibility and escalation

- The installed OpenCode 1.18.29 model listing (`opencode models openai --verbose`) confirms built-in `high` / `medium` / `low` variants for this allocation. Reuse those variants; no provider-level custom variants are needed.
- Internal calls need two explicit `options.reasoningEffort` defaults alongside their variants: `title: low` and `compaction: medium`. In the [1.18.29 request preparation source](https://github.com/anomalyco/opencode/blob/v1.18.29/packages/opencode/src/session/llm/request.ts), small calls skip variant selection; compaction uses the triggering user message rather than resolving its own agent variant. Agent options supply the fallback, but a triggering message's explicit variant can still override compaction effort. Keep each option aligned with its agent variant when changing these defaults.
- All four models report the capability `temperature: false`. Omit temperature
  settings from all 24 custom agent frontmatters rather than carrying over
  unsupported sampling controls. This is a capability flag, not an instruction
  to configure `temperature: false` on agents.
- The built-in title agent retains its runtime temperature default. The 1.18.29 request preparation code omits temperature for models whose temperature capability is false; no invalid null/boolean override is needed.
- Escalate manually to `lead` after repeated verification failures, when work
  becomes cross-cutting, or when security uncertainty remains. Include failed
  checks and relevant context; `lead` handles the hard reasoning and coordinates
  specialists. A model-pinned child cannot automatically upgrade itself or
  inherit Astra because `lead` delegates to it. If a stronger child model is
  needed, explicitly change its `model` or `variant` frontmatter, quit and
  restart OpenCode, then delegate again.
- Quit and restart OpenCode after configuration or agent-file changes; running sessions retain loaded configuration. Project configuration and explicit session model/variant selections can override these global defaults. Check the effective configuration and active session selection when diagnosing routing.
- These are routing choices, not paid-evaluation results or proof of actual model dispatch. Model metadata confirms capability support, not end-to-end execution.

## Delegation policy

The configuration sets `subagent_depth` to `2`. The root session is depth 0. A child is depth 1. A grandchild is depth 2. No agent can delegate at depth 2.

The global Task wildcard is `deny`. This default-deny policy prevents a new agent from gaining delegation authority without an explicit review. A per-agent permission can override the global setting. The override is limited to the exact approved targets in the agent definition.

Only five custom agents can delegate:

| Parent agent | Approved targets |
| --- | --- |
| `lead` | The other 23 custom agents, `general`, and `explore`. |
| `code-reviewer` | `typescript-reviewer`, `go-reviewer`, `csharp-reviewer`, and `php-reviewer`. |
| `security-reviewer` | `typescript-reviewer`, `go-reviewer`, `csharp-reviewer`, and `php-reviewer`. |
| `doc-updater` | `typescript-developer`, `go-developer`, `csharp-developer`, and `php-developer`, for focused evidence-only research. |
| `refactor-cleaner` | `typescript-developer`, `go-developer`, `csharp-developer`, and `php-developer`, for focused evidence-only research. |

All other custom agents are leaves. The built-in `general`, `explore`, `summary`, `compaction`, and `title` agents are leaves. The built-in `build` and `plan` agents are disabled.

```text
root session (0) -> permitted child (1) -> permitted grandchild (2)
```

At the depth limit, or when no approved specialist matches the assignment, the agent must return scope gaps to its caller. It must not retry delegation or bypass a Task denial through a shell command, an API, or another tool. Leaf agents return work, tests, evidence, blockers, and review requests through their caller.

The research-only instruction limits the delegated assignment. It does not remove developer edit rights. The parent is the sole editor for that assignment. The parent must validate citations, assignment scope, and uncertainty before it uses the research.

Delegation prompts state the task, scope, constraints, required context, and return evidence. They preserve user approval gates and existing commit policy.

All agents follow the safety and mandatory-review requirements in
[`AGENTS.md`](../AGENTS.md). For an architecture, system, or high-level design,
the caller asks `lead` to arrange sibling `architecture-reviewer` work. The
mandatory `code-reviewer` review remains required. The caller sends a CRITICAL
security finding to `lead`. The lead arranges sibling `security-reviewer` work
and user notification when required. The lead can reuse applicable current-scope
reviewer findings to prevent duplicate reviews while it preserves the review
requirement.

Quit and restart OpenCode after you change agent definitions or configuration. Start a fresh session and verify that a leaf Task request is denied and an approved parent can reach only its listed target. Running sessions retain the prior configuration.

## Agent inventory

This repository defines 24 custom agents, including `lead`: `lead`, `planner`,
`architect`, `architecture-reviewer`, `code-reviewer`, `security-reviewer`,
`typescript-reviewer`, `go-reviewer`, `csharp-reviewer`, `php-reviewer`,
`typescript-developer`, `react-developer`, `go-developer`, `csharp-developer`,
`php-developer`, `efcore-developer`, `doctrine-developer`, `laminas-developer`,
`github-actions-developer`, `gitlab-ci-developer`, `performance-optimizer`,
`code-simplifier`, `refactor-cleaner`, and `doc-updater`.

The local configuration also defines the built-in agent overrides `build`,
`plan`, `general`, `explore`, `summary`, `compaction`, and `title`. See
[`opencode.jsonc`](../opencode.jsonc#L75-L107).

## Custom agent roles

### Orchestration and planning

| Agent | What it does |
|-------|--------------|
| `lead` | The primary orchestrator. Runs the end-to-end workflow, deciding when to hand off to specialists. |
| `planner` | Breaks complex work into phases with dependencies and risks. Writes plans, not code. |
| `architect` | Compares design alternatives, identifies trade-offs. Used when multiple approaches are viable. |

### Review

| Agent | What it does |
|-------|--------------|
| `code-reviewer` | Quality, maintainability, and security review across any language. |
| `security-reviewer` | OWASP Top 10 and common vulnerability detection. Blocks progress on CRITICAL / HIGH findings. |
| `architecture-reviewer` | Evaluates designs before implementation. `architect` compares alternatives. |
| `typescript-reviewer`, `go-reviewer`, `csharp-reviewer`, `php-reviewer` | Language-specific review after the matching developer writes code. |

The `architecture-reviewer` has `edit` and `bash` denied permissions. It inherits
the global Task denial. It cannot implement changes or grant user approval.

### Language developers

| Agent | Stack |
|-------|-------|
| `typescript-developer` | TypeScript / JavaScript |
| `go-developer` | Go |
| `csharp-developer` | C# / .NET |
| `php-developer` | PHP |

### Framework developers

| Agent | Framework | Base |
|-------|-----------|------|
| `react-developer` | React / Next.js / Remix | `typescript-developer` |
| `efcore-developer` | Entity Framework Core | `csharp-developer` |
| `doctrine-developer` | Doctrine ORM | `php-developer` |
| `laminas-developer` | Laminas / Mezzio | `php-developer` |

### Cross-stack specialists

| Agent | When it helps |
|-------|---------------|
| `github-actions-developer` | Authoring or fixing GitHub Actions workflows. |
| `gitlab-ci-developer` | GitLab CI/CD pipelines, components, child pipelines. |
| `performance-optimizer` | Slow queries, N+1 patterns, algorithmic hotspots. |

### Maintenance

| Agent | What it does |
|-------|--------------|
| `code-simplifier` | Clarifies or consolidates code without changing behavior. |
| `refactor-cleaner` | Finds and removes dead code, unused imports, duplicated logic. |
| `doc-updater` | Updates documentation and docstrings after code changes. |
