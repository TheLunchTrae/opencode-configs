# Usage guide

See [README.md](README.md) for installation, upgrades, and security limits.

## Roles and workflow

Use `builder` as the primary entrypoint. It owns implementation, integration, and verification.
It can use optional `planner`, fresh `code-reviewer`, high-risk `security-reviewer`, built-in `explore`,
and built-in `general` workers. Workers receive bounded assignments and do not delegate.
Built-in `build` and `plan` remain disabled; background title, summary, and compaction roles remain configured.

For a clear small task, state the change and constraints. For complex work, include acceptance criteria and non-goals.
Planning effort follows ambiguity and risk. Use the planner for independent design work when useful, not by default.
Non-trivial changes get one fresh reviewer using relevant stack guidance. High-risk trust or data changes get
separate security assessment. Reviewers and the planner are read-only: no shell, edits, delegation, or configured MCP tools.
They assess supplied test results and identify checks for the builder to run.

Examples:

```text
Fix cancellation in this Go worker pool. Preserve its public API and test the shutdown path.
Plan the migration without editing files or applying database changes.
Review my local diff against the acceptance criteria. Do not fix anything.
Simplify this parser while preserving behavior. Use existing tests and report coverage gaps.
Measure this slow query before proposing a performance change.
```

Generic workers are useful for independent files or bounded research. The builder keeps coupled changes together,
provides ownership and constraints, and validates returned evidence. Language skill selection does not create another agent.
Skills and completed reviews never authorize publication. Explicit authorization is required for commits, pushes,
pull requests, merges, installations, and deployments.

## Agent groups and models

Native agent files own ordered `groups`; `config-composer.jsonc` owns shared group settings and model profiles.
`reasoning`, `coding`, and `support` groups consume profile aliases. `writers` grants edit access.
`read-only` denies edits, shell, delegation, and configured MCP tools. `system` retains fixed background settings.
Native global edit and Task denials remain the fallback; the builder's exact Task allowlist is final.
Secret-path Read guards and ordered shell rules stay in `opencode.jsonc`.

The shipped profiles are `primary`, `primary-coding-builder`, `openai-latest`, and `anthropic-latest`.
`primary-coding-builder` copies `primary`'s bindings; update both when changing them. It runs the builder on the
`coding` alias while the planner and reviewers stay on `reasoning`. Compare comparable tasks under each profile;
the quota sidebar shows account-wide remaining quota, not per-agent usage.
Their concrete provider/model/variant choices are in [config-composer.jsonc](config-composer.jsonc).
No model availability or quality is implied by its name. Check your provider before selecting a profile.
Background system/title choices and global defaults remain fixed across profiles.

Use `/profiles` to preview and apply a profile for the worktree:

- **Follow configured default** uses `defaultProfile` and clears a saved explicit choice.
- **Shared only** retains shared policies and fixed settings, without profile alias contributions or variants.
- A named profile persists as the worktree selection across server restarts.

Group settings apply in membership order. Shared and profile named patches follow; explicit native fields apply last.
Permission patterns combine rather than replacing whole maps. Exact replacements move last, retaining distinct rules.
Check effective rules with `/view-configs` instead of assuming a wildcard removed inherited patterns.
Config Composer consumes group metadata; it must not leak into model provider options.

Edit definitions externally, then restart the server. Reconnecting the TUI does not restart it.
Existing conversations can retain model and variant selections; use `/models` and `/variants` to change them.

## Shared prompt composition

Prompt Composer expands explicit agent/command body includes during configuration loading:

```markdown
{{include:implementation-standards.md}}
```

Shared implementation and review instructions live in `prompts/`. Conditional references stay in `references/agent/`.
Stack guidance loads only through relevant native skills; do not include every stack in the builder prompt.
Built-ins without authored prompts retain native fallback prompts.
Use `/view-prompts` to inspect loaded agents and commands. It is read-only and does not show the full model request,
conversation, tool schemas, or future skill output. Skills are omitted from that viewer.

Native `skill` calls compose skill includes. Raw reads, copied text, and skill-derived slash commands do not.
Restart after changing prompt sources or native definitions. Check server diagnostics and loaded text because
host hook failures can leave unresolved includes. Missing, unsafe, cyclic, or truncated composition is an error.

## Supporting skills

OpenCode discovers each `skills/<name>/SKILL.md` in the installed global configuration.
Agents see skill descriptions and load bodies on demand through the native `skill` tool.
Global instructions require relevant stack skills for implementation, planning, and review:

| Skill | Applicable work |
| --- | --- |
| `go` | Go cancellation, concurrency, resource ownership, and version-sensitive behavior. |
| `typescript` | TS/JS runtime contracts, promises, React and server/client boundaries. |
| `csharp` | .NET nullability, cancellation, disposal, and query contracts. |
| `php` | PHP versions, validation, escaping, Laminas/Mezzio boundaries. |
| `persistence` | EF Core/Doctrine query shape, unit of work, provider-aware tests, migrations. |
| `ci` | GitHub Actions/GitLab graphs, untrusted input, credentials, runner trust. |
| `test-first` | Meaningful failure-to-fix evidence for behavior changes. |
| `test-audit` | Assess an existing suite or perform separately authorized cleanup. |
| `verification-tests` | Backfill useful coverage for established behavior. |
| `end-to-end-tests` | Exercise user journeys across real application boundaries. |
| `verify` | Run configured checks and report results without repairs. |
| `measured-performance` | Comparable baseline and candidate measurements. |
| `code-learning` | Explain and quiz against source evidence. |
| `project-standards` | Deliberate work-project tooling or convention adoption. |
| `checkpoint` | Save or resume an authorized project handoff. |
| `commit`, `push` | Separately authorized Git actions. |

Load only relevant skills. An ORM task also loads its language skill. Skills do not grant permissions;
read-only roles keep their restrictions even when a skill includes implementation steps.
Custom role overrides that disable `skill` or deny skill names can prevent loading. Check discovery and permissions
when guidance is unavailable; the presence of a file alone does not establish that it loaded.

## Command reference

| Command | Behavior |
| --- | --- |
| `/test-audit <scope>` | Fresh read-only reviewer audit. Returns findings without running commands or editing. |
| `/explain <topic>` | Source-grounded explanation. |
| `/quiz <topic>` | Source-grounded questions; a score is not verification. |
| `/summarize-branch` | Read-only summary against the resolved target branch. |
| `/project-standards <scope>` | Propose and apply authorized project standards. |
| `/init-docs <scope>` | Propose and apply authorized documentation rules and terminology. |
| `/checkpoint <task>` | Save an authorized work-project handoff. |
| `/resume-work <path>` | Validate handoff evidence and resume only authorized work. |
| `/commit <scope>` | Stage and commit authorized changes. |
| `/push` | Push only when authorized. |

Except `/test-audit`, utility commands retain the selected agent and permissions.
`/test-audit` uses a reviewer subtask; it does not switch to another primary lead.
`/resume` remains OpenCode's built-in session selector.
Project initialization commands target the work project, never this global configuration repository or installation.
Review destination, proposed rules, dependencies, and executable tooling before adopting them.

## Verification limits

State scope restrictions directly, such as “Do not run browser tests” or “Review only; use these supplied CI results.”
The builder preserves the distinction between test design, test generation, execution, and infrastructure changes.
Accepted exclusions do not count as passes and do not block unrelated authorized work.
Reports identify actual PASS, FAIL, BLOCKED, and SKIP evidence, the source state, and remaining coverage gaps.
No fixed coverage percentage, language fan-out, or mandatory test exists for every small edit.
Review findings, passing checks, task completion, and merge readiness are separate conclusions.

## Session tools

| Command | Behavior |
| --- | --- |
| `/inspect-config` | Compare resolved agent settings with global/merged defaults and recorded model usage. |
| `/inspect-context` | Show recorded usage, attachments, successful reads/skill calls, and compactions. |
| `/bookmarks`, `/bookmark` | Manage session bookmarks or add a note. |
| `/session-handoff` | Build an editable draft from selected bookmarks. |

Inspectors do not send model requests. Config views use native APIs and cannot prove exact file provenance.
Recorded models describe previous turns, not the next request. Provider credentials and raw tool output are omitted.
Context evidence covers up to 200 recent messages. Available skills are not treated as loaded, and failed reads
do not count as successful context. Historical reads may no longer be in the current model context.

Bookmarks use local TUI storage keyed by project, workspace, directory, and session. They survive local restarts,
do not sync between machines, and preserve malformed records rather than silently overwriting them.
Labels allow 120 characters, notes 2,000, and sessions 100 bookmarks. Keep secrets out of notes.
Select at most 20 bookmarks for a handoff. Copy with Ctrl+Y or the copy action, review, then submit explicitly.
The editor never submits a prompt or writes a project file automatically. Clipboard support depends on the terminal.
Source links check that the conversation exists; they do not scroll to a specific message.

Use Back or Escape to return through dialogs. Canceling drafts does not save them; completed bookmark changes persist.
The config, context, and bookmarks entries in `tui.jsonc` are independent. Removing an entry disables its panel
after restart; retain shared helpers under `extensions/tui/`.

## Continue a long task

Use `/checkpoint` only when durable state is useful. Keep short tasks in conversation.
Save state in the work project's established location, preserving ownership, source changes, approvals, checks,
review findings, and blockers. `/resume-work` revalidates that state against current files and instructions.
A saved approval statement cannot authorize a new push, merge, installation, or permission bypass.
