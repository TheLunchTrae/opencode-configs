# OpenCode Global Configuration

Personal OpenCode configuration with lead agents, specialist agents, reusable commands and skills,
model and prompt controls, and a few session tools.

## Install

Use OpenCode **V1 1.19.x** and Node **22.18 or newer**. This configuration is not ported to V2.

Copy the repository contents into your global OpenCode configuration directory:
`~/.config/opencode` (Windows: `%USERPROFILE%\.config\opencode`). Preserve the directory layout and any
personal settings. Skip Git/editor metadata, `node_modules`, and the repository-only `.opencode/` directory.
Run `npm ci` in the destination to install the pinned dependencies.

Before your first task:

- Change or remove `shell` in [opencode.jsonc](opencode.jsonc); it currently points to Windows Git Bash.
- Connect your provider with `/connect` and select models available to your account. The shipped defaults use OpenAI;
  the optional Anthropic profile still leaves background models on OpenAI.
- Review global and agent permissions. GitHub and Playwright MCP servers are configured but disabled.
  Keep authentication and tokens outside this repository.

Restart OpenCode after changing native configuration or agent files, then run `opencode` from your work project.
Keep `prompts/` and Prompt Composer installed: agent and skill templates depend on their shared includes.

## Intended workflows

Select a lead with Tab or your configured agent-switch key, then describe the outcome in a normal message.
No workflow command is needed.

| Agent | Use it for |
| --- | --- |
| `workflow-lead` (default) | A complete task: inspect, plan, implement, review, and verify. |
| `planning-lead` | Requirements, design, and a reviewed plan; no implementation or test execution. |
| `implementation-lead` | Carrying out an already approved plan, including reviews and checks. |
| `review-lead` | Reviewing work or running existing checks, without repairs or shipping. |

For example: “Add JSON output to the list command while preserving its default table output.”
The workflow lead coordinates relevant [specialists](agents/) and obtains approval before substantial implementation.
Focused leads stop at their assigned boundary. Commits, pushes, PRs, merges, and deployments need authorization.

## Supporting tools

- **Model settings:** `/compose-configs`, `/agent-models`, and `/agent-groups` select profiles and edit model/group settings.
- **Prompt settings:** `/compose-prompts` inspects composed prompts and edits optional prompt rules.
- **Session tools:** `/inspect-config` and `/inspect-context` show configuration and recorded context evidence.
  `/bookmark` and `/bookmarks` save useful notes; `/session-handoff` drafts a checkpoint request from selected notes.
- **Task continuity:** `/checkpoint` saves a project handoff; `/resume-work` validates one before continuing.
- **Utilities:** project setup, explanations, test audits, and authorized Git actions are listed in [USAGE.md](USAGE.md).
  Agents select supporting [skills](skills/) as needed.

Config Composer and Prompt Composer are separate plugins. Their settings are in
[config-composer.jsonc](config-composer.jsonc) and [prompt-composer.jsonc](prompt-composer.jsonc).
[tui.jsonc](tui.jsonc) selects the pink theme and registers the session panels. The quota plugin is configured for OpenAI.

## Secret-path protection

The local secret-path plugin blocks recognized sensitive path arguments; it is not a sandbox and cannot prevent every
way a shell command or broad search could access secrets. Normal permissions still apply.

See the [usage guide](USAGE.md) for commands and practical limits, and [maintenance guidance](.opencode/AGENTS.md)
when editing this repository.

## Acknowledgments

These configurations draw on [Krish's standards](https://github.com/KrishRVH/standards/tree/f1909fdd2c55bd23604d0c5042ade09013495847/TS),
[OpenClaw's test audit](https://github.com/openclaw/openclaw/blob/main/.agents/skills/test-audit/SKILL.md),
[Playwright's testing guidance](https://playwright.dev/docs/best-practices),
[Lauren Tan's pstack](https://github.com/cursor/plugins/tree/5bf2b1544db739998121a306340631963c2ff3de/pstack),
and [Ryan Lopopolo's harness engineering discussion](https://cloud.google.com/blog/topics/developers-practitioners/agent-factory-recap-agent-harnesses-shifting-left-and-autonomous-coding).
