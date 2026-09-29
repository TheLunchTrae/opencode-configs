# OpenCode Global Configuration

Personal global configuration for OpenCode, with focused lead agents, specialists, commands, reusable skills,
shared prompts, agent group and model controls, workflow panels, session bookmarks, and secret-path checks.
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
| [`references/agent-prompts/`](references/agent-prompts/) | Shared prompt guidance. |
| [`plugins/`](plugins/) | Local plugins, including secret-path checks. |
| [`extensions/agent-groups/`](extensions/agent-groups/) | TUI settings and server-side group defaults. |
| [`extensions/session-tools/`](extensions/session-tools/) | Workflow, config, context, bookmarks, and handoff panels. |
| [`package.json`](package.json) | Pinned plugin dependencies and maintenance commands. |
| [`opencode.jsonc`](opencode.jsonc) | Global models, permissions, MCP servers, shell, and plugin settings. |
| [`tui.jsonc`](tui.jsonc) | TUI theme selection and plugin settings. |
| [`themes/`](themes/) | Custom TUI themes. |
| [`opencode-quota/quota-toast.jsonc`](opencode-quota/quota-toast.jsonc) | Quota display preferences. |

## Setup

1. Install OpenCode V1 1.18.29 or a compatible version with the TUI plugin API. See <https://opencode.ai/docs/>.
2. Authenticate your provider through `/connect` when supported.
3. Back up your existing global configuration directory.
4. Obtain a checkout or download of this repository.
5. Copy `README.md`, `USAGE.md`, `AGENTS.md`, `opencode.jsonc`, `tui.jsonc`, `themes/`, `agents/`, `commands/`, `skills/`,
   `references/`, `plugins/`, `extensions/`, `package.json`, `package-lock.json`, and `opencode-quota/`
   into the global configuration directory.
   Preserve the layout and merge your existing settings.

The global configuration directory is `~/.config/opencode` or `%USERPROFILE%\.config\opencode` on Windows.
No `npm install` step is required for normal setup. OpenCode installs configured npm plugins and local dependencies.

Do not copy credentials, tokens, `node_modules`, `.idea`, or work-project checkpoints.
The repository's `.opencode/` directory contains maintenance guidance and is not needed for global installation.
When copying selected skills, include their supporting files, applicable license notices, owning agents, and references.

This setup retains V1 plugin and configuration conventions. Before using V2, port the bundled V1 plugin and
review the delegation-depth setting. V2 does not run V1 plugins and ignores top-level `subagent_depth`.
See the [V2 migration guide](https://opencode.ai/v2/docs/migrate-v1/).

## Configure before first launch

1. Set `shell` in `opencode.jsonc` to an installed shell.
   The supplied value is `C:/Program Files/Git/bin/bash.exe`; change it or remove it on other systems.
2. Select models available from your authenticated provider. Global and group defaults are in `opencode.jsonc`.
   Custom agents declare `agent_group` in their frontmatter. An explicit agent model overrides its group default.
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
[response format catalog](references/agent-prompts/response-formats/catalog.md).
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
`references/agent-prompts/`, `plugins/`, `opencode.jsonc`, `tui.jsonc`, and `themes/` together,
preserving local overrides and license notices.

Install `extensions/`, `package.json`, and `package-lock.json` with both configuration files when adding agent groups.
Merge existing dependencies if your installation already has a package manifest.
Keep the server plugin tuple and its group defaults in `opencode.jsonc`, and the TUI entry in `tui.jsonc`.
Custom agents with explicit model pins keep those models. Use **Use group defaults** to opt an agent into inheritance.
Removing the server plugin also removes group inheritance; restore explicit models before disabling it.

Shared prompts now use the hidden `agent-prompts` directory reference.
Update custom prompts to use paths such as `@agent-prompts/reviewer-standards.md`.
Hidden references stay available to agents while being omitted from interactive reference selectors.
See the [reference documentation](https://opencode.ai/docs/references/).

After installing the new files, remove the old root reference copies of `asd-ste100.md`, `global-coding-style.md`,
`reviewer-standards.md`, and `review-template.md` from `references/`. Preserve unrelated references.
Also remove `references/agent-prompts/review-template.md` if present. Update custom review prompts to read
`@agent-prompts/response-formats/review.md`, and copy the complete `response-formats/` directory with the other references.
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

The preserved procedures and security checklist now live in `references/agent-prompts/`.
After replacing the shipped workflow and performance skill, remove the obsolete
`references/agent-prompts/LICENSE-pstack.txt` and `skills/measured-performance/LICENSE-pstack.txt` copies.
Preserve any notices required by local additions or other retained third-party material.
Update custom references to retired entrypoints using the [usage guide](USAGE.md).
Select `workflow-lead` explicitly in an existing session that still names the old agent.

Restart OpenCode and confirm agent, command, and skill availability in a work project.
For other settings, see the [configuration documentation](https://opencode.ai/docs/config/).

## References

[OpenClaw's test-audit skill](https://github.com/openclaw/openclaw/blob/main/.agents/skills/test-audit/SKILL.md)
informed the test-value assessment and evidence required for suite cleanup.
[Playwright's testing guidance](https://playwright.dev/docs/best-practices)
informed the browser-test isolation, locator, and waiting guidance. Use the work project's existing test tools.

[Lauren Tan's pstack](https://github.com/cursor/plugins/tree/5bf2b1544db739998121a306340631963c2ff3de/pstack)
informed the workflow's evidence-based task routing and performance measurement practices.

[Ryan Lopopolo's harness engineering discussion](https://cloud.google.com/blog/topics/developers-practitioners/agent-factory-recap-agent-harnesses-shifting-left-and-autonomous-coding)
informed the workflow's project context assessment and prevention of recurring failures.
