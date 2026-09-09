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
   `agents/`, `commands/`, `skills/`, `plugins/`, and `opencode-quota/` into
   the global configuration directory. Preserve the repository layout.

The global configuration directory is `~/.config/opencode`. On Windows, it is
`%USERPROFILE%\.config\opencode`. Merge changes rather than blindly overwrite
your existing configuration.

Do not copy credentials, tokens, `node_modules`, or `.idea`. The repository
`.opencode/` directory contains maintenance instructions. OpenCode does not
require it for normal global configuration installation.

No `npm install` step is required for normal setup.

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

For MCP, remove unused entries from your copy of `opencode.jsonc` before you
start OpenCode. The disabled `github` entry contains a
`{file:secrets/github_token}` substitution. Do not copy secrets or add tokens
inline.

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
