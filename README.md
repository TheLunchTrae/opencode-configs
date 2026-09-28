# OpenCode Global Configuration

Personal global configuration for OpenCode, with specialist agents, slash commands, reusable skills,
shared prompts, secret-path checks, and quota display preferences.
The default agent is `lead`. It coordinates planning, implementation, review, and verification.

## Contents

| Path | Purpose |
| --- | --- |
| [`USAGE.md`](USAGE.md) | Practical task examples and guidance for choosing commands and skills. |
| [`AGENTS.md`](AGENTS.md) | Shared instructions for all sessions. |
| [`agents/`](agents/) | Agent prompts, roles, and model choices. |
| [`commands/`](commands/) | Slash commands listed below. |
| [`skills/`](skills/) | Reusable task procedures. |
| [`references/agent-prompts/`](references/agent-prompts/) | Shared prompt guidance. |
| [`plugins/`](plugins/) | Local plugins, including secret-path checks. |
| [`opencode.jsonc`](opencode.jsonc) | Global models, permissions, MCP servers, shell, and plugin settings. |
| [`tui.jsonc`](tui.jsonc) | TUI plugin settings. |
| [`opencode-quota/quota-toast.jsonc`](opencode-quota/quota-toast.jsonc) | Quota display preferences. |

## Setup

1. Install OpenCode. See <https://opencode.ai/docs/>.
2. Authenticate your provider through `/connect` when supported.
3. Back up your existing global configuration directory.
4. Obtain a checkout or download of this repository.
5. Copy `README.md`, `USAGE.md`, `AGENTS.md`, `opencode.jsonc`, `tui.jsonc`, `agents/`, `commands/`, `skills/`,
   `references/`, `plugins/`, and `opencode-quota/` into the global configuration directory.
   Preserve the layout and merge your existing settings.

The global configuration directory is `~/.config/opencode` or `%USERPROFILE%\.config\opencode` on Windows.
No `npm install` step is required for normal setup. OpenCode installs configured npm plugins when needed.

Do not copy credentials, tokens, `node_modules`, `.idea`, or work-project checkpoints.
The repository's `.opencode/` directory contains maintenance guidance and is not needed for global installation.
When copying selected skills, include their supporting files, license notices, owning agents, and references.

This setup retains V1 plugin and configuration conventions. Before using V2, port the bundled V1 plugin and
review the delegation-depth setting. V2 does not run V1 plugins and ignores top-level `subagent_depth`.
See the [V2 migration guide](https://opencode.ai/v2/docs/migrate-v1/).

## Configure before first launch

1. Set `shell` in `opencode.jsonc` to an installed shell.
   The supplied value is `C:/Program Files/Git/bin/bash.exe`; change it or remove it on other systems.
2. Select models available from your authenticated provider. Global defaults and built-in overrides are in
   `opencode.jsonc`; custom agent model and variant choices are in `agents/*.md`.
   A global model change does not override those agent choices.
3. Use reasoning and sampling options supported by the selected models.
4. Remove `opencode` from `disabled_providers` if you want to use that provider.
5. Review the global and per-agent permissions. These settings affect every project; `lead` can edit files.

GitHub and Playwright MCP servers are configured but disabled. Review their connection settings before enabling them.
Configure GitHub authentication in your local environment, then set `enabled` to `true` for a server you want to use.
The supplied GitHub entry has OAuth disabled; configure a supported authentication method when enabling it.
Keep tokens out of version control.

The quota plugin is configured for OpenAI. To opt out, remove its entries from both `opencode.jsonc` and `tui.jsonc`.

## Use

Restart OpenCode after configuration changes, then run `opencode` from your work project.
Confirm that `lead` is active and the custom slash commands are available.
Project settings and explicit session model choices can override global defaults.

See the [usage guide](USAGE.md) for example prompts, task selection, and ways to combine commands and skills.

Use `/workflow <task>` for a complete development task. Substantial implementation includes a plan for your approval.
Use `/plan` or `/design` for read-only planning, and `/finish` for final checks without shipping the changes.
Commits, pushes, pull requests, merges, and deployments need authorization for that action.

Specialists cover TypeScript, JavaScript, Go, C#, PHP, React, EF Core, Doctrine, Laminas, GitHub Actions, and GitLab CI.
Other agents handle architecture, security, performance, cleanup, and documentation.
See [agent definitions](agents/) for individual roles and model choices.

### Commands

| Command | Purpose |
| --- | --- |
| `/workflow <task>` | Plan, implement, review, and verify a development task. |
| `/spec <feature>` | Clarify requirements before implementation. |
| `/plan <task>` | Produce a read-only implementation plan. |
| `/phased-plan <task>` | Plan a phased rollout and rollback when requested or needed. |
| `/design <problem>` | Compare architecture and design alternatives. |
| `/verification-tests [scope]` | Design and generate verification tests for established repository behavior. |
| `/verify` | Run available project checks and report results without fixes. |
| `/finish` | Collect final verification and reviews without committing or publishing. |
| `/checkpoint <task-id>` | Save a handoff in the current work project. |
| `/resume-work <handoff-path>` | Resume from a handoff after checking saved state. |
| `/explain <feature>` | Explain the current implementation from source. |
| `/quiz <topic>` | Ask optional questions about the code and wait for answers. |
| `/review <target>` | Review the requested scope; ask when it is unclear. |
| `/code-review [target]` | Review code; default to local changes. |
| `/security-review [target]` | Review security risks; default to local changes. |
| `/go-review [target]` | Review Go code; default to local changes. |
| `/refactor-clean <scope>` | Find and remove verified dead code and duplicates. |
| `/update-docs <scope>` | Update documentation from current code. |
| `/commit` | Stage and commit authorized changes with secret checks. |
| `/push` | Push the current branch with authorization. |
| `/summarize-branch` | Summarize branch commits before a pull request. |

`/resume-work` reads a project handoff. The built-in `/resume` selects an OpenCode session.
Checkpoints stay in the work project. Learning questions and quiz scores are optional.

### Build a verification baseline

Use `/verification-tests [scope]` to add reusable coverage for an existing module, workflow, or repository.
For example:

```text
/verification-tests the CLI's configuration loading and error handling
/verification-tests the database import workflow
```

With no scope, the lead inspects the repository and proposes the coverage to build. The workflow reuses existing tests,
maps required behavior to suitable test levels, and presents the design for review and your approval.
It then generates tests and necessary fixtures, runs available checks, and documents setup and execution.
You can request design only. Missing test infrastructure and proposed tooling changes are included in the design.

Baseline tests can pass immediately. Observed legacy behavior is labeled as characterization when its intended
contract is unconfirmed. Suspected defects and blocked checks are reported; passing tests cover only their stated
behavior. Test code and execution instructions stay in the work project.

Other agents can use the `verification-tests` skill within their assigned scope. For subsequent changes, `/verify`
reuses relevant suites and reports coverage gaps. The lead assigns any required test additions through its normal
implementation workflow. Use `test-first` for a new behavior or bug fix.

See the [verification-test examples](USAGE.md#verification-tests-for-existing-code) for scope selection,
design-only requests, complex infrastructure, and reuse after later changes.

### Additional skills

Skills provide procedures used by agents and commands. You can also request these by name:

| Skill | Purpose |
| --- | --- |
| `test-first` | Verify a failing behavior with a test, then implement and check the fix. |
| `measured-performance` | Compare performance before and after a change under matching conditions. |
| `project-standards` | Propose deliberate changes to project conventions, test tooling, or CI. |

## Secret-path protection

The `block-secrets` plugin rejects recognized sensitive path arguments before a tool runs.
It covers `.env` files, common private-key and credential files, `.ssh/` content, `.aws/credentials`,
and paths containing a complete `secrets` segment. It shows an error toast when available.

Template basenames `.env.example`, `.env.sample`, `.env.template`, `.env.defaults`, and `.env.dist` are allowed
unless the path contains a `secrets` segment. Matching is case-insensitive on every operating system.

This plugin is a path check, not a sandbox or complete secret protection:

- Shell expansion, aliases, or symlinks can hide the accessed path.
- A search starting in a parent directory can read sensitive content without a blocked path argument.
- Approved commands, scripts, and hooks can access secrets.
- Project settings, per-agent permissions, and saved approvals can change effective access.

Normal tool permissions still apply. Shell approval defaults to `ask`, with explicit denials for selected
destructive commands. Check an approval prompt's scope before saving an approval.

## Upgrade an existing installation

Back up the configuration first. Update `README.md`, `USAGE.md`, `AGENTS.md`, `agents/`, `commands/`, `skills/`,
`references/agent-prompts/`, `plugins/`, and `opencode.jsonc` together, preserving local overrides and license notices.

Shared prompts now use the hidden `agent-prompts` directory reference.
Update custom prompts to use paths such as `@agent-prompts/reviewer-standards.md`.
Hidden references stay available to agents while being omitted from interactive reference selectors.
See the [reference documentation](https://opencode.ai/docs/references/).

After installing the new files, remove the old root reference copies of `asd-ste100.md`, `global-coding-style.md`,
`reviewer-standards.md`, and `review-template.md` from `references/`. Preserve unrelated references.
The former directory READMEs are also obsolete: `agents/README.markdown`, `commands/README.markdown`,
`skills/README.md`, and `plugins/README.md`. User documentation is in this README and the [usage guide](USAGE.md).

Restart OpenCode and confirm agent, command, and skill availability in a work project.
For other settings, see the [configuration documentation](https://opencode.ai/docs/config/).
