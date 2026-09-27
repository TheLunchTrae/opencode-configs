# OpenCode Config Repository

## Scope and configuration

- Keep this repository limited to reusable OpenCode configuration, usage and maintenance documentation,
  supporting tests, and required license notices.
- Describe the current configuration directly. Do not add research catalogs, source-comparison reports,
  task-specific completion reports, or references to unrelated private resources.
- Keep change-specific plans, test results, and open review items in the pull request, not tracked report files.
- Root `AGENTS.md` is the global instruction file for all OpenCode sessions. Keep repository-only guidance here, not in that file.
- The repository root is the live global OpenCode configuration directory, not an application. Changes to its agents, skills, plugins, and permissions affect other projects after restarting OpenCode.
- Put configuration and instructions that apply only to work in this repository in `.opencode/`. Root-level configuration files define global settings; do not use them for repository-only settings. This file gives maintenance instructions for the whole repository.
- Custom agent `model` and `variant` settings belong in `agents/*.md` frontmatter. Built-in overrides remain in `opencode.jsonc`; preserve their explicit `options.reasoningEffort` values.
- `lead` is the default agent; built-in `build` and `plan` are disabled. Do not confuse `plan` with the custom `planner` agent.
- Agent Markdown bodies are prompts. Do not add a separate `prompt` frontmatter field.

## Documentation

Use the [OpenCode documentation](https://opencode.ai/docs/) to check configuration fields and behavior. Check that the documentation applies to the installed version before you make changes.

Read the relevant README before you change a component. Do not load all READMEs for every task. The following links are relative to this file:

| Document | When to read it |
| --- | --- |
| [Repository README](../README.md) | Read for the repository structure and setup information. |
| [Agent README](../agents/README.markdown) | Read before you change agent definitions or model settings. |
| [Command README](../commands/README.markdown) | Read before you change slash commands. |
| [Plugin README](../plugins/README.md) | Read before you change plugins. |
| [Skill README](../skills/README.md) | Read before you change skills or their procedures. |

Use these READMEs as reference material, not replacements for applicable agent instructions.
Verify referenced files and current configuration before you follow a procedure.
Workflow and approval policy belongs in the relevant agent prompt. Shared prompt content belongs in
`references/agent-prompts/` with a hidden reference in `opencode.jsonc`.

## Verification

- Run `npx --no-install tsc --project tsconfig.json` from the repository root for type checking.
  The config includes `plugins/**/*.ts` and `tests/**/*.ts`. It does not validate Markdown, JSONC, or `.opencode/` code.
- Run `node --experimental-strip-types --test tests/block-secrets.test.ts` for the plugin tests.
- Run `node --test tests/workflow-config.test.mjs` for configuration and reference checks.
- Dependency manifests are local editor support and are not tracked. No CI workflow is present.
  Check available tooling; do not assume `npm test`, `npm run lint`, or `npm run build` exists.
- If local root or `.opencode/package.json` manifests exist, inspect the relevant one before changing dependencies.
- Type checking cannot prove OpenCode config loads. Validate changed configuration separately and restart OpenCode to exercise config-time changes.

## Operational traps
- Preserve explicit Bash `ask` rules. Project configuration can override the wildcard while inheriting specific rules.
- MCP entries are disabled placeholders. Enabling one requires a complete local or project server definition.
- Never inspect or inline secret files when checking configuration.

# Markdown Style
Style rules for config-related Markdown files in this repository.
Line length: 120 characters maximum. Only exceed when the content cannot be split (for example, Long URLs, command
output, or YAML frontmatter strings that cannot be folded).
- Indentation: 2 spaces for YAML frontmatter, 4 spaces for code blocks.
- Line endings: LF (Unix-style)
  Markdown flavor: GitLab Flavored Markdown.
