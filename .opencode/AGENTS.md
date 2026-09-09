# OpenCode Config Repository

## Scope and configuration

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

Use these READMEs as reference material, not as replacements for applicable `AGENTS.md` instructions. Verify referenced files and current configuration before you follow a procedure. The agent README conflicts with this file about custom-agent model settings; verify the current configuration before you change those settings.

## Verification

- Run `npx --no-install tsc --project tsconfig.json` from the repository root for type checking.
  The config includes `plugins/**/*.ts` and `tests/**/*.ts`. It does not validate Markdown, JSONC, or `.opencode/` code.
- Run `node --experimental-strip-types --test tests/block-secrets.test.ts` for the plugin tests.
- Root `package.json` has no scripts. No CI workflow is present.
  Do not assume `npm test`, `npm run lint`, or `npm run build` exists.
- Root dependencies support authored plugins; `.opencode/package.json` is a separate dependency manifest, not a workspace package. Check the relevant manifest before changing dependencies.
- Type checking cannot prove OpenCode config loads. Validate changed configuration separately and restart OpenCode to exercise config-time changes.

## Operational traps
- GitHub MCP credentials are referenced through `secrets/github_token`; do not read or inline that file when inspecting configuration.

# Markdown Style
Style rules for config-related Markdown files in this repository.
Line length: 120 characters maximum. Only exceed when the content cannot be split (for example, Long URLs, command
output, or YAML frontmatter strings that cannot be folded).
- Indentation: 2 spaces for YAML frontmatter, 4 spaces for code blocks.
- Line endings: LF (Unix-style)
  Markdown flavor: GitLab Flavored Markdown.
