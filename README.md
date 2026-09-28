# OpenCode Global Configuration

This repository is a personal global configuration for OpenCode. It is not an application, an installer, or a configuration synchronization tool.

The default primary agent is `lead`. It coordinates planning, specialist work, reviews, and verification. The configuration supplies shared rules, slash commands, skills, a secret-path blocking plugin, and quota preferences.

## Contents

| Path | Purpose |
| --- | --- |
| [`AGENTS.md`](AGENTS.md) | Shared rules for all sessions. |
| [`agents/`](agents/README.markdown) | Agent roles, model pins, and delegation rules. |
| [`commands/`](commands/README.markdown) | Slash commands. |
| [`skills/`](skills/README.md) | Task procedures. |
| [`references/agent-prompts/`](references/agent-prompts/) | Shared prompt guidance through one hidden directory reference. |
| [`plugins/`](plugins/README.md) | Local plugins, including `block-secrets.ts`. |
| [`opencode.jsonc`](opencode.jsonc) | Global agent, permission, MCP, shell, and plugin settings. |
| [`tui.jsonc`](tui.jsonc) | TUI plugin settings. |
| [`opencode-quota/quota-toast.jsonc`](opencode-quota/quota-toast.jsonc) | Quota display preferences. |

## Setup

1. Install OpenCode. See <https://opencode.ai/docs/>.
2. Authenticate the provider that you want to use. Use the official
   `/connect` flow when it supports that provider.
3. Back up your existing global configuration directory.
4. Obtain a checkout or download of this repository.
5. For a complete setup, copy `AGENTS.md`, `opencode.jsonc`, `tui.jsonc`,
   `agents/`, `commands/`, `skills/`, `references/`, `plugins/`, and `opencode-quota/` into
   the global configuration directory. Preserve the repository layout.

The global configuration directory is `~/.config/opencode`. On Windows, it is
`%USERPROFILE%\.config\opencode`. Merge changes rather than blindly overwrite
your existing configuration.

Do not copy credentials, tokens, `node_modules`, or `.idea`. The repository
`.opencode/` directory contains maintenance instructions. OpenCode does not
require it for normal global configuration installation.

No `npm install` step is required for normal setup.

Copy each selected skill folder with its supporting files, including license notices.
Skills that route to an agent require that agent and its references too.
Do not copy work-project checkpoints into the global configuration.

When upgrading, copy `AGENTS.md`, `agents/`, `skills/`, `references/agent-prompts/`, and `opencode.jsonc` together.
The previous per-file aliases are no longer configured. Shared prompts use the `agent-prompts` directory reference.
Update custom prompts to use paths such as `@agent-prompts/reviewer-standards.md`.
Remove the old root reference copies of `asd-ste100.md`, `global-coding-style.md`, `reviewer-standards.md`,
and `review-template.md` after the new paths are in place. Preserve unrelated references.

## Configure Before First Launch

1. Set `shell` in `opencode.jsonc`. This repository uses `C:/Program Files/Git/bin/bash.exe`. On another operating system, set the path to an installed Bash executable or remove `shell`.
2. Select models that are available from your authenticated provider. Update
   global `model` and `small_model` values, built-in agent overrides in
   `opencode.jsonc`, and applicable `agents/*.md` frontmatter values. A global
   model does not override an agent model pin.
3. Set `options.reasoningEffort` only when the selected model supports it.
4. Keep `opencode` out of `disabled_providers` when you want to use that
   provider.
5. Review `AGENTS.md`, `opencode.jsonc` permissions, and per-agent permission
   overrides. These global settings apply to every project. The `lead` agent
   can edit files; permission behavior can differ by agent.

The `github` and `playwright` MCP entries are disabled. They contain no server definitions or credential references.
To enable either server, add its complete configuration in your local or project settings and set `enabled` to `true`.
Use the server's supported authentication flow. Do not copy secrets or add tokens inline.

Local `*.ts` files in the global `plugins/` directory load when OpenCode
starts. OpenCode installs npm plugins named in the `plugin` setting. The
configured quota plugin has preferences only for `openai`. Keep its defaults,
or remove the quota plugin from both `opencode.jsonc` and `tui.jsonc` to opt
out.

## Use

Quit and restart OpenCode after configuration changes. Run `opencode` from
your project directory. Run `/plan` to prepare a change, `/review` to review
code, and `/verify` to run available checks. Confirm that `lead` is the active
agent and that the slash commands are available.

For configuration fields, see <https://opencode.ai/docs/config/>. For plugin
behavior, see <https://opencode.ai/docs/plugins/>.

## Development workflow

[The lead prompt](agents/lead.md) owns workflow, approvals, specialist routing, and required reviews.
[The planner prompt](agents/planner.md) owns planning. Commands and entry-point skills route to those roles.
Shared guidance lives in `references/agent-prompts/`. One `agent-prompts` reference points to that directory
and has `hidden: true` in `opencode.jsonc`. Agents read individual files such as
`@agent-prompts/reviewer-standards.md` and `@agent-prompts/global-coding-style.md`.
See the [OpenCode reference documentation](https://opencode.ai/docs/references/) for directory reference syntax.
Hidden affects `@` autocomplete only. The reference remains available to agents, and normal tool permissions apply.

Use `/workflow <task>` for a routed task, or keep using `/plan`, `/review`, and `/verify`.
Use `/spec <feature>` when consequential requirements remain unclear.
Use `/checkpoint <task-id>` before a context reset and `/resume-work <handoff-path>` to validate saved state.
The built-in `/resume` still selects a session; `/resume-work` does not replace it.
Use `/finish` to collect final checks and reviews without shipping.
Use `/explain <feature>` and `/quiz <topic>` for optional, read-only learning.

The workflow starts with one writer. It allows at most two disjoint writers and two repair attempts per failed target.
These are prompt-level operating limits, not filesystem isolation or an autonomous loop.
The workflow requires no additional service, MCP server, background process, provider, or package installation.

The [command catalog](commands/README.markdown) and [skill catalog](skills/README.md) describe the entry points.

## Configuration checks

Run the dependency-free configuration checks from the repository root:

```sh
node --test tests/workflow-config.test.mjs
```

These checks validate authored metadata, routing, and shared-reference contracts. They do not launch OpenCode or prove agent behavior.
