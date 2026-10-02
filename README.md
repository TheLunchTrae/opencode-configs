# OpenCode Global Configuration

Personal global configuration for OpenCode, with focused lead agents, specialists, commands, reusable skills,
shared prompt composition, agent group and model controls, workflow panels, session bookmarks, and secret-path checks.
The default agent is `workflow-lead`. It coordinates complete development tasks.
Select a focused lead when you want only planning, approved implementation, or assessment of existing work.

## Contents

| Path | Purpose |
| --- | --- |
| [`USAGE.md`](USAGE.md) | Workflow guide, command and skill reference, and practical task examples. |
| [`AGENTS.md`](AGENTS.md) | Shared instructions for all sessions. |
| [`agents/`](agents/) | Agent prompts, roles, and model choices. |
| [`commands/`](commands/) | Utility shortcuts and the focused test-audit entrypoint. |
| [`skills/`](skills/) | Reusable task procedures. |
| [`references/agent/`](references/agent/) | Conditional guidance that agents read when needed. |
| [`config-composer/agent/prompts/`](config-composer/agent/prompts/) | Shared fragments for agent and skill bodies. |
| [`plugins/`](plugins/) | Local plugins, including secret-path checks. |
| `@lunchbox/opencode-config-composer` | Config Composer: shared prompts and group settings. |
| [`extensions/session-tools/`](extensions/session-tools/) | Workflow, config, context, bookmarks, and handoff panels. |
| [`package.json`](package.json) | Pinned plugin dependencies and maintenance commands. |
| [`opencode.jsonc`](opencode.jsonc) | Global models, permissions, MCP servers, shell, and plugin settings. |
| [`config-composer.jsonc`](config-composer.jsonc) | Config Composer groups, models, and prompt settings. |
| [`tui.jsonc`](tui.jsonc) | TUI theme selection and plugin settings. |
| [`themes/`](themes/) | Custom TUI themes. |
| [`opencode-quota/quota-toast.jsonc`](opencode-quota/quota-toast.jsonc) | Quota display preferences. |

## Setup

1. Install OpenCode V1 1.18.34 or a compatible version with the TUI plugin API. See <https://opencode.ai/docs/>.
2. Authenticate your provider through `/connect` when supported.
3. Back up your existing global configuration directory.
4. Obtain a checkout or download of this repository.
5. Copy `README.md`, `USAGE.md`, `AGENTS.md`, `opencode.jsonc`, `config-composer.jsonc`, `tui.jsonc`, `themes/`,
   `agents/`, `commands/`, `skills/`, `references/`, `config-composer/`, `plugins/`, `extensions/`, `package.json`,
   `package-lock.json`, and `opencode-quota/`
   into the global configuration directory.
   Preserve the layout and merge your existing settings.

The global configuration directory is `~/.config/opencode` or `%USERPROFILE%\.config\opencode` on Windows.
Install the pinned dependencies in this directory with `npm ci`.
The settings schema uses the package repository's raw GitHub URL. Local extensions do not import Composer.
OpenCode also resolves the matching npm specifier registered in both plugin lists.

Do not copy credentials, tokens, `node_modules`, `.idea`, or work-project checkpoints.
The repository's `.opencode/` directory contains maintenance guidance and is not needed for global installation.
When copying selected skills, include their supporting files, applicable license notices, references, and
composition sources. Skills with include directives also require Config Composer and their configured sources.
Load these templates through native skill loading under an agent whose role and permissions permit the procedure.

For local editing of `plugins/` and `extensions/`, run `npm ci` from the checkout root.
Select the workspace TypeScript version in your editor. If types remain unresolved, reopen the project or restart
its TypeScript service. See [plugin tooling](.opencode/AGENTS.md#plugin-tooling) for lint and format commands.

This setup retains V1 plugin and configuration conventions. Before using V2, port the bundled V1 plugin and
review the delegation-depth setting. V2 does not run V1 plugins and ignores top-level `subagent_depth`.
See the [V2 migration guide](https://opencode.ai/v2/docs/migrate-v1/).

## Configure before first launch

1. Set `shell` in `opencode.jsonc` to an installed shell.
   The supplied value is `C:/Program Files/Git/bin/bash.exe`; change it or remove it on other systems.
2. Select models available from your authenticated provider. Global defaults are in `opencode.jsonc`.
   Config Composer group defaults and model presets are in `config-composer.jsonc`.
   Custom agents declare `groups` in frontmatter.
   An explicit agent model overrides its group default.
   After launch, use `/agent-models` to select models and `/agent-groups` to assign agents to groups.
   See [agent groups and models](USAGE.md#agent-groups-and-models) for precedence and configuration examples.
3. Use reasoning and sampling options supported by the selected models.
4. Remove `opencode` from `disabled_providers` if you want to use that provider.
5. Review the global and per-agent permissions. These settings affect every project.
   `workflow-lead` and `implementation-lead` can edit files; planning and review leads have narrower roles.

GitHub and Playwright MCP servers are configured but disabled. Review their connection settings before enabling them.
If enabled, their tools require approval through the `github_*` and `playwright_*` permission rules.
Configure GitHub authentication in your local environment, then set `enabled` to `true` for a server you want to use.
The supplied GitHub entry has OAuth disabled; configure a supported authentication method when enabling it.
Keep tokens out of version control.

The quota plugin is configured for OpenAI. To opt out, remove its entries from both `opencode.jsonc` and `tui.jsonc`.

The session tools add a live workflow sidebar, read-only configuration and context inspectors, and session bookmarks
with editable handoff drafts. Open them through the command palette or `/workflow-panel`, `/inspect-config`,
`/inspect-context`, and `/bookmarks`. See [session tools](USAGE.md#session-tools) for use and individual opt-outs.

Config Composer assembles shared guidance into custom agent prompts when configuration loads.
It also resolves inline includes in skill bodies when OpenCode loads a skill through its native loader.

Install the Composer package, `config-composer.jsonc`, `config-composer/`, and `references/` together.
Shared source directories are configured at the top level.
Agent groups, models, and prompt settings belong under `agent`.
The `$schema` field points to `https://raw.githubusercontent.com/lunchbox-labs/opencode-config-composer/main/schema.json`.
This URL tracks `main`. To use the installed package version instead, set `$schema` to
`./node_modules/@lunchbox/opencode-config-composer/schema.json`, relative to the settings file.

The `config-composer/` directory contains personal prompt fragments, not the plugin implementation.
The npm package supplies composition, settings editing, the Composer TUI, and the schema.
Session-tools uses native OpenCode APIs in `/inspect-config`; it does not read or interpret Composer settings.
Use the package's `/agent-models` and `/agent-groups` controls for saved model and group choices.
The shared `extensions/tui/` directory supports the remaining session-tools panels.

The shipped agent bodies declare shared fragments with explicit include directives at their intended positions.
These directives require Config Composer, which resolves them when configuration loads.
Missing or invalid includes fail configuration loading.
Skill templates require native skill loading. A direct Read or a raw file copy does not resolve their directives.
Conditional reference reads remain agent actions. See [shared prompt composition](USAGE.md#shared-prompt-composition).

The selected `pink` theme uses pink accents, pastel syntax and status colors, and neutral dark backgrounds.
It keeps the same dark appearance in both terminal modes. Install `themes/` with `tui.jsonc` so OpenCode can find it.
To select another theme, change `theme` in `tui.jsonc`. See the [theme documentation](https://opencode.ai/docs/themes/).
Agent colors identify their functions. Custom-agent colors are in `agents/*.md`; built-in overrides are in
`opencode.jsonc`. See [agent colors](https://opencode.ai/docs/agents/#color).

Global file edits require approval unless the selected agent explicitly allows or denies them.
Explore explicitly denies edits. The four primary leads can use the Question tool for structured clarification.
Delegation remains denied by default, with exact targets in each coordinating agent's permissions.

External-directory access uses OpenCode's V1 defaults. Ordinary external paths require approval.
OpenCode permits its configured skill and reference directories and designated temporary and tool-output locations.
Read and edit permissions still apply to those paths.

## Quick start

Restart OpenCode after configuration changes, then run `opencode` from your work project.
Confirm that `workflow-lead` is active and the four primary leads are available.
Project settings and explicit session model choices can override global defaults.

Describe a development task in an ordinary message:

```text
Add a JSON output option to the existing list command. Preserve the default table output.
```

The workflow lead inspects the project, resolves consequential questions, and presents a reviewed plan for approval
before substantial implementation. It then coordinates implementation, documentation, reviews, and verification.
It advances between stages automatically within the approved scope. No workflow command or skill invocation is needed.

Use Tab or your configured agent-switch key to select `planning-lead`, `implementation-lead`, or `review-lead`
for a focused task. These are primary agents; select them instead of invoking them as child agents.
Focused leads stop at their stage boundary. The workflow lead handles the full process without switching leads.

See the [usage guide](USAGE.md) for [lead selection](USAGE.md#choose-a-lead),
[utility commands](USAGE.md#command-reference),
[supporting skills](USAGE.md#supporting-skills), and worked examples.
It also explains [verification baselines](USAGE.md#verification-tests-for-existing-code) for existing behavior.
Commits, pushes, pull requests, merges, and deployments require authorization for that action.

Use `/project-standards` to initialize a work project from
[KrishRVH/standards](https://github.com/KrishRVH/standards/tree/main).
See [project standards setup](USAGE.md#initialize-project-standards) for scope and examples.

Specialists cover TypeScript, JavaScript, Go, C#, PHP, React, EF Core, Doctrine, Laminas, GitHub Actions, and GitLab CI.
Other agents handle architecture, security, performance, cleanup, and documentation.
See [agent definitions](agents/) for individual roles and model choices.
Specialists return canonical Markdown reports defined in the
[response format catalog](config-composer/agent/prompts/response-formats/catalog.md).
The reports share task status, result, evidence, and unresolved items, with sections for each kind of task.
Delegating agents validate the reports and apply their own workflow rules. Specialists need only their assigned task
and constraints; they do not depend on the invoking lead's identity.

## Secret-path protection

The `block-secrets` plugin rejects recognized sensitive path arguments before a tool runs.
It covers `.env` files, common private-key and credential files, `.ssh/` content, `.aws/credentials`,
and paths containing a complete `secrets` segment. It shows an error toast when available.

Template basenames `.env.example`, `.env.sample`, `.env.template`, `.env.defaults`, and `.env.dist` are allowed
unless the path contains a `secrets` segment. The plugin matches paths case-insensitively on every operating system.

Native Read permissions also deny a complete `secrets` path segment and its contents,
including `~/.config/opencode/secrets`.
These rules match V1 worktree-relative paths and normalized Windows separators.

This plugin is a path check, not a sandbox or complete secret protection:

- Shell expansion, aliases, or symlinks can hide the accessed path.
- A search starting in a parent directory can read sensitive content without a blocked path argument.
- Approved commands, scripts, and hooks can access secrets.
- Project settings, per-agent permissions, and saved approvals can change effective access.

Normal tool permissions still apply. Shell approval defaults to `ask`, with explicit denials
for selected destructive commands.
The `git status *`, `git diff *`, and `git log *` rules allow routine inspection with flexible arguments.
V1 also matches each bare command with its trailing ` *` rule. Later rules require approval for `--output` options
and commands containing `>`, which can redirect output into a file.
These command patterns permit normal Git helper behavior, including configured diff and text-conversion filters.
The complete policy is in `opencode.jsonc`.
Check an approval prompt's scope before saving an approval.

## Upgrade an existing installation

Back up the configuration first. Update `README.md`, `USAGE.md`, `AGENTS.md`, `agents/`, `commands/`, `skills/`,
`references/`, `config-composer/`, `plugins/`, `opencode.jsonc`, `config-composer.jsonc`, `tui.jsonc`, and `themes/`
together, preserving local overrides and license notices.

Install `extensions/`, `package.json`, and `package-lock.json` with the configuration files when adding Config Composer.
Merge existing dependencies if your installation already has a package manifest.
Preserve a customized `config-composer.jsonc` and merge the new fields instead of overwriting it.
Use the same published `@lunchbox/opencode-config-composer@VERSION` in both plugin lists.
The server reads `config-composer.jsonc` by default. Preserve any explicit `configFile` override for a custom filename.
Keep `extensions/tui/`; session-tools still uses it. Preserve unrelated extensions and dependencies.
Custom agents with explicit model pins keep those models. Use **Use group defaults** to opt an agent into inheritance.
Removing the server plugin also removes group inheritance and prompt composition.
Resolve include directives, restore shared guidance, and restore explicit models before disabling it.

Register one Config Composer server entry and one TUI entry. Keep composition settings in
`config-composer.jsonc` and agent memberships in ordered `groups` arrays.
Use the raw GitHub `$schema` URL shown in `config-composer.jsonc`, or the installed package schema path above.
Preserve customized source mappings and prompt fragments instead of overwriting them.

After installing the updated agent bodies, remove matching shared fragments from their configured prompt layers.
The former shipped default appended `@agent-prompts/response-formats/common.md`.
The former shipped group layers supplied implementation or reviewer standards, review target and criteria,
and implementation, review, or documentation profiles. These fragments are now included directly in agent bodies.
Remove matching per-agent profile appends for `architect`, `planner`, `code-simplifier`, `refactor-cleaner`,
and `performance-optimizer` after installing their inline includes.
Preserve custom additional fragments, models, memberships, and the four primary leads' inheritance opt-outs.
Leads include specialist contracts to delegate work and validate reports.
These contracts do not define the leads' own responses.
Do not keep the same fragment in a configured layer and an inline include unless repetition is intended.

Composition fragments now live in `config-composer/agent/prompts/`.
Set the `agent-prompts` entry in `sourceDirectories` to `./config-composer/agent/prompts`.
Use this alias in Composer include directives and configured prompt fragments.
Migrate custom `@agent-prompts` reads to inline includes, or move genuine runtime references into a
native reference directory.
After migrating all consumers, remove the native `agent-prompts` entry from `opencode.jsonc`.
Install templated skills with Config Composer and their configured sources.
Their includes resolve during native skill loading.
Conditional guidance lives in `references/agent/`, exposed through the hidden `agent-references` reference.
Update customized reads to that guidance, such as `@agent-references/testing-standards.md`.
Move customized fragments and conditional references to their respective directories before removing obsolete copies.
Hidden references stay available to agents while being omitted from interactive reference selectors.
See the [reference documentation](https://opencode.ai/docs/references/).

After installing the new files, remove the old root reference copies of `asd-ste100.md`, `global-coding-style.md`,
`reviewer-standards.md`, and `review-template.md` from `references/`. Preserve unrelated references.
Also remove `references/agent-prompts/review-template.md` if present. Update custom review prompts to include
`{{include:@agent-prompts/response-formats/review.md}}`, and install the complete
`config-composer/agent/prompts/response-formats/` directory.
The former directory READMEs are also obsolete: `agents/README.markdown`, `commands/README.markdown`,
`skills/README.md`, and `plugins/README.md`. User documentation is in this README and the [usage guide](USAGE.md).

If upgrading from the command-based workflow, remove these retired entries from the installation directory.
Copying new files alone leaves old agents, commands, and skills discoverable. Back up first and remove only these entries:

- Agent: `agents/lead.md`.
- Commands: `workflow.md`, `spec.md`, `design.md`, `plan.md`, `phased-plan.md`, `verification-tests.md`, `verify.md`,
  `finish.md`, `review.md`, `code-review.md`, `security-review.md`, `go-review.md`, `refactor-clean.md`, and
  `update-docs.md` from `commands/`.
- Skill directories: `development-workflow/`, `spec-interview/`, `plan/`, `phased-plan/`, `review/`, `security-review/`,
  and `finish/` from `skills/`.

Preserved procedures now live in `config-composer/agent/prompts/` and `references/agent/`.
The security checklist is `references/agent/owasp-2021.md`.
After replacing the shipped workflow and performance skill, remove the obsolete
`references/agent-prompts/LICENSE-pstack.txt` and `skills/measured-performance/LICENSE-pstack.txt` copies.
Preserve any notices required by local additions or other retained third-party material.
Update custom references to retired entrypoints using the [usage guide](USAGE.md).
Select `workflow-lead` explicitly in an existing session that still names the old agent.

Restart OpenCode and confirm agent, command, and skill availability in a work project.
For other settings, see the [configuration documentation](https://opencode.ai/docs/config/).

## References

[Krish's TypeScript standards](https://github.com/KrishRVH/standards/tree/f1909fdd2c55bd23604d0c5042ade09013495847/TS)
informed the general lint and formatting rules. The local setup retains npm and OpenCode's TypeScript and OpenTUI APIs.

[OpenClaw's test-audit skill](https://github.com/openclaw/openclaw/blob/main/.agents/skills/test-audit/SKILL.md)
informed the test-value assessment and evidence required for suite cleanup.
[Playwright's testing guidance](https://playwright.dev/docs/best-practices)
informed the browser-test isolation, locator, and waiting guidance. Use the work project's existing test tools.

[Lauren Tan's pstack](https://github.com/cursor/plugins/tree/5bf2b1544db739998121a306340631963c2ff3de/pstack)
informed the workflow's evidence-based task routing and performance measurement practices.

[Ryan Lopopolo's harness engineering discussion](https://cloud.google.com/blog/topics/developers-practitioners/agent-factory-recap-agent-harnesses-shifting-left-and-autonomous-coding)
informed the workflow's project context assessment and prevention of recurring failures.
