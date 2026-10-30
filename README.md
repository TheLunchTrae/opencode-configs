# OpenCode Global Configuration

Personal OpenCode configuration with one builder, independent read-only review, optional planning,
on-demand stack skills, model profiles, session inspectors, bookmarks, and secret-path checks.
Planning and review scale with task risk. There is no mandatory planner/design/developer/language-review chain.

## Contents

| Path | Purpose |
| --- | --- |
| [USAGE.md](USAGE.md) | Roles, commands, skills, profiles, and session tools. |
| [AGENTS.md](AGENTS.md), [agents/](agents/) | Global instructions and role definitions. |
| [commands/](commands/), [skills/](skills/) | Shortcuts and reusable guidance. |
| [prompts/](prompts/), [references/agent/](references/agent/) | Shared fragments and conditional references. |
| [opencode.jsonc](opencode.jsonc), [config-composer.jsonc](config-composer.jsonc) | Runtime settings and model profiles. |
| [tui.jsonc](tui.jsonc), [themes/](themes/) | TUI plugins and theme. |

## Setup

1. Install OpenCode V1 1.19.x and Node 22.18 or newer. See [OpenCode documentation](https://opencode.ai/docs/).
2. Back up your existing global configuration directory.
3. Copy `AGENTS.md`, `opencode.jsonc`, `config-composer.jsonc`, `tui.jsonc`, `agents/`, `commands/`, `skills/`,
   `references/`, `prompts/`, `plugins/`, `extensions/`, `themes/`, `opencode-quota/`, `package.json`,
   `package-lock.json`, `README.md`, and `USAGE.md` into that directory. Merge unrelated local settings.
4. Run `npm ci` there to install the pinned dependencies.
5. Configure your shell and available provider models, authenticate through `/connect`, and restart OpenCode.

The global directory is `~/.config/opencode` or `%USERPROFILE%\.config\opencode` on Windows.
Do not copy credentials, tokens, `node_modules`, work-project checkpoints, or the repository's `.opencode/` directory.
The latter contains maintenance instructions, not global runtime configuration.
Install skills with their references and composition sources. Skills containing includes need Prompt Composer
and the native `skill` tool; raw reads and skill-derived slash commands do not expand includes.

## Configure before first launch

- Change or remove the Windows-specific `shell` value in `opencode.jsonc` for your machine.
- Select models supported by your provider. Keep model aliases and profiles in `config-composer.jsonc`.
  `/profiles` selects a worktree profile; `/view-configs` shows settings and origins.
- Review permissions before installation. Builder and built-in `general` can edit; planner and reviewers cannot
  edit, run shell commands, delegate, or use the configured GitHub/Playwright tools. They can use `git_inspect`.
  Built-in `explore` retains its native exploration restrictions.
  Global Task access remains denied except for the builder's explicit targets.
- GitHub and Playwright MCP definitions are disabled. Enabling them and configuring authentication is a separate
  local decision. Their tools require approval for writing roles and remain denied for read-only custom roles.
  Keep credentials out of configuration source.
- The `opencode` provider is disabled. Remove it from `disabled_providers` only if you want to use it.

External-directory access retains native V1 boundaries. Ordinary external paths require approval; OpenCode permits
its configured skill/reference directories and designated temporary/tool-output paths. Read and edit rules still apply.
The selected `pink` theme is supplied in `themes/`. Change `theme` in `tui.jsonc` to select another.

## Quick start

Run `opencode` in a work project and select `builder`. Describe the outcome:

```text
Add JSON output to the list command. Preserve the default table output.
```

The builder inspects, implements, integrates, and verifies authorized work. Small tasks stay small.
Complex or risky work gets a plan and appropriate independent assessment. Non-trivial changes get a fresh code review.
A separate security reviewer covers high-risk boundaries. Generic workers handle separable tasks, not language personas.
Use a design-only or review-only request when you want that stopping point.
Commits, pushes, PRs, merges, installations, and deployments require authorization for that action.

See [USAGE.md](USAGE.md) for command examples, stack guidance, and verification limits.

## Plugins

- [Config Composer](https://github.com/lunchbox-labs/opencode-config-composer), pinned to 0.3.0:
  shared model/permission groups and per-worktree profiles.
- [Prompt Composer](https://github.com/lunchbox-labs/opencode-prompt-composer), pinned to 0.1.1:
  shared implementation and review instructions.
- [OpenCode Quota](https://github.com/slkiser/opencode-quota): OpenAI quota toasts.
- [Session tools](USAGE.md#session-tools): configuration/context inspectors, bookmarks, and handoff drafts.
- Compaction task state: asks automatic and manual compaction to keep scope, approvals, check results,
  review dispositions, and blockers. See [Continue a long task](USAGE.md#continue-a-long-task).
- Local secret-path protection and environment/output scrubbing, described below.
- Local `git_inspect` tool: read-only Git status, diffs, history, and blame for roles without shell access.
- Local `project_script` tool: runs only scripts declared in `package.json`, `composer.json`, or a Makefile.

Both plugin lists register Config Composer before Prompt Composer. Session tools do not import Composer APIs.
Restart the server after editing definitions or prompts. Existing sessions can retain previous model selections.
This configuration targets V1. V2 needs a separate plugin port and delegation-depth migration; compatibility is not claimed.

## Secret-path protection

The `block-secrets` plugin rejects recognized sensitive path arguments before a tool runs.
It covers `.env` files, common private-key and credential files, `.ssh/` content, `.aws/credentials`,
and paths containing a complete `secrets` segment. It shows an error toast when available.
Template basenames `.env.example`, `.env.sample`, `.env.template`, `.env.defaults`, and `.env.dist` are allowed
unless the path contains a `secrets` segment. Matching is case-insensitive on every operating system.
Native Read permissions also deny a complete `secrets` path segment and its contents.

The `scrub-secrets` plugin blanks shell environment variables named like credentials (`*_TOKEN`, `*_SECRET`,
`*_PASSWORD`, `*_API_KEY`, `*_ACCESS_KEY`, `*_PRIVATE_KEY`, `*_CREDENTIALS`, and similar) and variables holding URLs
with embedded passwords. Names ending in `_FILE`, `_PATH`, `_DIR`, or `_HOME`, and values naming an existing file,
are kept.
It applies to shell calls through the `shell.env` hook: agent shell calls and `!` commands. Terminal panels and
plugin tools that start their own processes keep the server's environment.
List variables that commands still need in `OPENCODE_SCRUB_ENV_ALLOW`, separated by commas.
It also redacts private-key bodies, including cut-off blocks, common cloud, Git host, and API tokens, JWTs,
bearer headers, URL passwords, and scrubbed values of 12 or more characters from built-in, plugin, MCP, and subtask
tool results, with a warning toast. Output of `!` commands is not redacted. Redacted text cannot be matched by edits;
edit around it or by hand.

`git_inspect` applies the same path check to explicit paths and `rev:path` reads. The `rev:path` root must resolve
to a commit, including an annotated tag's commit. It rejects subtree roots, raw blob IDs,
index-stage paths, and `:/` or `^{/...}` searches. It excludes content of matching files from diffs, logs, and `show`,
including template files such as `.env.example`. Commits that change only excluded files still appear, without
their content, and file names still appear in status and changed-file lists. It disables external diff drivers,
text conversion, fsmonitor helpers, and partial-clone fetches. Configured clean filters can still run.
Output over 8 MB is truncated.

These plugins are pattern checks, not a sandbox or complete secret protection:

- Shell expansion, aliases, or symlinks can hide the accessed path.
- Searches from a parent directory can read sensitive content without a blocked path argument.
- Approved commands, scripts, and hooks can access secrets.
- Project settings, per-agent permissions, and saved approvals can change effective access.
- Credentials in unrecognized formats or variable names pass through scrubbing unchanged.

Shell approval defaults to `ask`, with explicit destructive-command denials. They cover common argument orders for
force, `+refspec`, and `--mirror` pushes, hard resets, `branch -D`, `git clean`, and recursive forced `rm`.
For `git clean`, leading `-n` or `--dry-run`, and the prefixes `-dn`, `-fdn`, `-xdn`, `-d -n`, and
`-d --dry-run` still ask. Other `git clean` spellings remain denied. Negated long options (`--no-*`) also deny,
because they can cancel dry-run mode. This conservative rule can also deny paths with that text.
Unlisted destructive spellings fall back to approval, including `rm -vrf`, `branch -d -f`, and Git options before the
subcommand such as `-C <dir>`, `-c`, or `--git-dir`. Rules for those would also deny commit messages that mention
the commands.
`git status *`, `git diff *`, and `git log *` allow routine inspection, including bare commands in V1.
Later rules require approval for `--output` and `>` redirection. Git helpers and text-conversion filters can still run.
Check an approval prompt's scope before saving approval. See [opencode.jsonc](opencode.jsonc) for the complete policy.

`project_script` asks for `project_script` permission on every run. The approval key names the runner, script,
directory, a hash of the declared scripts or Makefile, and the exact arguments, such as
`npm:test in packages/api #3f2a9c1b7d4e ["--watch=false"]`. The prompt shows the declared command, including npm
`pre` and `post` scripts. A saved approval stops matching when any declared script, the directory, or an argument
changes. It does not cover files the script runs or includes, such as test files, `.npmrc` settings, or included
makefiles, which a writing role can still edit.
The tool runs without a shell and uses the lockfile or `packageManager` field to choose npm, pnpm, Yarn, or Bun.
Nested packages use the nearest declaration or lockfile, searching only as far as the worktree root.
Makefile targets take no arguments. On Windows, package-manager shims run through `cmd.exe`, so arguments are limited
to letters, digits, and `@+=:,./_-`. Stdin is closed, and an abort or the 10-minute timeout stops the whole process
tree. Read-only roles deny the tool. Scripts run with the OpenCode server's full environment; approving one in an
untrusted repository has the same risk as running it yourself.

## Upgrade an existing installation

Back up first. Update the shipped files together and preserve local provider settings, custom extensions,
bookmark data, credentials, and applicable license notices.
Remove retired repository-owned files instead of overlaying new files onto them: old agents remain discoverable otherwise.
Compare your installation with the current checkout; do not delete unrelated custom files.

The retained custom agents are `builder`, `planner`, `code-reviewer`, and `security-reviewer`.
Retire the former leads, language/framework developers and reviewers, and specialist cleanup/documentation/performance
agents. Update custom command agent names, Task allowlists, group memberships, and session selections accordingly.
There are no aliases for removed roles. Select `builder` in an existing session that names a retired lead.
Remove old stage/lead-contract/research fragments and `prompts/response-formats/` after updating custom consumers.
Language prompt fragments now live in native stack skills. Shared-only profiles retain shared permissions and
fixed system/title settings, but omit profile model aliases.

Keep Config Composer and Prompt Composer registered once each in both plugin lists at the pinned versions.
Preserve deliberate final native overrides and custom `configFile` options. Restart the server and inspect
`/view-configs`, `/view-prompts`, agent availability, and skill discovery before resuming work.
Older installations may also contain retired workflow commands and skill wrappers; remove only repository-owned
entries absent from this checkout. Skills and references do not grant tool permissions.

## Maintenance

Run `npm ci`, `npm run check`, and `npm run test:native` from the checkout.
Tests exercise local plugin behavior and native integration, not personal agent inventories or configuration snapshots.
See [.opencode/AGENTS.md](.opencode/AGENTS.md) for verification boundaries and package validation.

## References

[Krish's TypeScript standards](https://github.com/KrishRVH/standards/tree/f1909fdd2c55bd23604d0c5042ade09013495847/TS)
informed lint and formatting conventions.
[OpenClaw's test audit](https://github.com/openclaw/openclaw/blob/main/.agents/skills/test-audit/SKILL.md)
and [Playwright guidance](https://playwright.dev/docs/best-practices) informed test assessment and isolation.
[pstack](https://github.com/cursor/plugins/tree/5bf2b1544db739998121a306340631963c2ff3de/pstack)
informed task routing and measurement.
