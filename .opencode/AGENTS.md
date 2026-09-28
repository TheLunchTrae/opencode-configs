# OpenCode Config Repository

## Scope and instruction loading

- This repository supplies reusable global OpenCode configuration, supporting tests, and license notices.
  Its files can be installed directly in the live global configuration directory.
- Root `AGENTS.md` applies to all OpenCode sessions. Keep repository maintenance guidance in this file.
  Put repository-only configuration in `.opencode/opencode.jsonc`.
- The local config's `instructions` array names `.opencode/AGENTS.md`. V1 resolves that pattern through the
  project directory ancestry. Do not move it into the shipped root config.
- V2 currently accepts `instructions` without loading its entries. When maintaining this repository in V2,
  read this file explicitly; do not assume that the array loaded it.
- Keep README content relevant to users: installation, configuration, usage, upgrades, and operational limits.
  Keep editing rules, verification procedures, and implementation notes here.
- Describe the current setup directly. Do not add research catalogs, source-comparison reports, task completion
  reports, or references to unrelated private resources. Put change-specific plans and results in the pull request.
- Keep workflow, approval, and role policy in the applicable agent prompt. This maintenance file describes how
  to edit the configuration; it must not become another copy of the runtime workflow.

Read the relevant source before editing it. Use [the user README](../README.md) to check documented behavior.
Check the installed version against the [V1 documentation](https://opencode.ai/docs/) or
[V2 documentation](https://opencode.ai/v2/docs/). Do not infer runtime compatibility from JSON parsing alone.

## Agents and model settings

- Custom agent `model` and `variant` settings belong in `agents/*.md` frontmatter.
  Root `opencode.jsonc` owns global defaults and built-in overrides.
- Agent Markdown bodies are prompts. Do not add a separate `prompt` frontmatter field.
- `lead` is the primary agent. Built-in `build` and `plan` are disabled; custom `planner` is a separate agent.
- Read the affected agent definitions for identities, models, and permissions. Do not maintain a second allocation
  table or hardcoded role inventory in documentation.
- The existing allocation was checked against OpenCode 1.18.29. Before changing it, inspect current provider
  metadata with `opencode models openai --verbose` when available. Verify model IDs and variant support.
  Metadata is not proof of actual model dispatch or quality.
- Preserve explicit `options.reasoningEffort` defaults for built-in `title` and `compaction`.
  In V1, small calls skip variant selection and request variants can override agent options.
  Keep fallback values aligned with the selected agent variant; do not assume a title setting controls every
  `small_model` call. Check the runtime request path before removing a fallback.
- Check model sampling capabilities before adding temperature settings. A metadata capability of
  `temperature: false` means unsupported; it is not an agent configuration value.
  Do not add null or boolean temperature overrides to the title agent.
- Model-pinned children do not inherit the lead's model. Diagnose the effective configuration and session
  selection before changing pins. A supported model change requires restarting and checking the affected route.

## Prompt ownership, commands, and skills

- [Lead](../agents/lead.md) owns orchestration, approvals, review routing, budgets, and shipping authorization.
  [Planner](../agents/planner.md) owns planning. Each specialist owns its scope and escalation behavior.
- Shared prompt content belongs in `references/agent-prompts/`. Register that directory once as the hidden
  `agent-prompts` reference, with a description, in root `opencode.jsonc`.
  Use full paths such as `@agent-prompts/reviewer-standards.md`; verify every referenced file exists.
- Hidden affects interactive visibility. It does not remove agent context or grant tool permissions.
- Each agent must explicitly read the references it needs. Framework agents do not inherit another agent's body.
  Keep language guidance shared with the matching developer, reviewer, and framework roles.
- Commands and entry-point skills route to the owning agent. Do not duplicate workflow or approval procedures there.
  Preserve command names, argument handling, intended target defaults, and agent routing.
- `/verify` and lead workflow commands run in the active lead session. `/plan` remains a read-only planner subtask.
  Preserve the built-in `/resume` session selector; `/resume-work` consumes a project handoff.
- Skills do not grant permissions. Preserve their supporting files and license notices when moving content.
  Keep project contracts, checkpoints, and lessons in their work project, not in this global configuration.
- `project-standards` handles deliberate tooling and convention changes. Ordinary tests, routine checks, and defect
  fixes do not require adopting new tooling through that skill.

## Permissions and delegation

- Preserve explicit Bash `ask` rules. A project wildcard override can coexist with inherited specific rules.
  Do not remove specific rules merely because the global wildcard currently has the same value.
- Keep global Task access denied by default. Exact agent allowlists are authoritative; do not expand them during
  documentation cleanup or infer permissions from a role description.
- Preserve leaf restrictions and the configured depth limit. When changing permissions, verify that leaf delegation
  is denied and approved parents can reach only their listed targets in a fresh session.
- Research-only assignments limit the task, not the developer's edit capability. Preserve the parent's sole-editor
  requirement and validation of citations, scope, and uncertainty in the relevant agent prompts.
- Keep GitHub and Playwright MCP definitions typed and disabled, without credential-file interpolation.
  V2 discards enabled-only V1 MCP entries without a `type`; `{ "enabled": false }` is not a portable disable rule.
- Never inspect or inline secret files while checking configuration.

## Plugin maintenance

Read [block-secrets.ts](../plugins/block-secrets.ts) and its tests before changing the plugin.
Preserve these contracts:

- Check `filePath`, `file_path`, and `path`; treat `pattern` as a path only for glob.
- Normalize backslashes and match case-insensitively, including on POSIX systems.
- A complete `secrets` path segment takes precedence over allowed template basenames.
- Bash token checks are heuristic. They do not parse shell expansion or resolve symlinks and aliases.
  A search from a parent directory can avoid a sensitive path argument.
- Reject the tool call even when the best-effort error toast fails.
- Keep the user-facing error's documentation pointer aligned with the README's secret-path protection section.
  Document access limitations there; do not describe the plugin as a sandbox.

The current plugin uses the V1 `@opencode-ai/plugin` hook API. A V2 port is a separate implementation change.
V2 also ignores top-level `subagent_depth`; its supported setting is `experimental.subagent_depth`.
Consult the [migration guide](https://opencode.ai/v2/docs/migrate-v1/) and verify behavior before claiming V2 support.

## Verification

Run applicable existing checks from the repository root:

```sh
node --test tests/workflow-config.test.mjs
node --experimental-strip-types --test tests/block-secrets.test.ts
npx --no-install tsc --project tsconfig.json
```

- Configuration tests check metadata, routing, and shared references. They do not launch OpenCode or prove behavior.
- Plugin tests use mocked hooks and synthetic paths. They do not access real secrets or establish V2 compatibility.
- Type checking includes `plugins/**/*.ts` and `tests/**/*.ts`.
  It does not validate Markdown, JSONC, or `.opencode/` code.
- Dependency manifests are untracked local editor support. Inspect an existing root or `.opencode/package.json`
  before changing dependencies. Check available tooling; do not assume npm scripts or a CI workflow exist.
- Report unavailable dependencies and checks explicitly. Do not install unrelated tooling to hide a missing check.
- Check internal links, moved-file consumers, command routing, and unchanged model and permission fields.
  After runtime configuration changes, restart OpenCode and test the relevant discovery and permission behavior
  when the native runtime is available. A harmless approval check must not use real secrets.
- Distinguish source checks, mocked tests, native loading, and model-assisted execution in the pull request.
  Do not claim an independent review for a self-review.

## Markdown and documentation

Apply `@agent-prompts/asd-ste100.md` to technical documentation. If the official writing rules and dictionary are
unavailable, report that formal compliance could not be verified.
Preserve code, identifiers, commands, paths, URLs, literal values, and quotations.

- Use LF line endings and GitLab Flavored Markdown.
- Limit lines to 120 characters, except indivisible URLs, literal output, or frontmatter strings.
- Use two spaces for YAML indentation and four spaces for indented code blocks.
- Keep the main README as the single user guide. Do not recreate per-directory README instruction catalogs.
