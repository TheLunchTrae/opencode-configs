# Slash commands

## Day-to-day workflow

| Command | Purpose |
| --- | --- |
| `/workflow <task>` | Select a route, plan, obtain approval, implement a bounded task, and review. |
| `/spec <feature>` | Resolve consequential requirements without implementation. |
| `/plan <task>` | Return a read-only plan with acceptance examples, files, risks, and dependencies. |
| `/phased-plan` | Plan a requested or necessary phased rollout and per-phase rollback. |
| `/design` | Compare architecture, data flow, and consequential alternatives. |
| `/verify` | Run configured checks and report observed results without fixes. |
| `/finish` | Collect final verification and independent reviews without shipping. |

The workflow commands and `/verify` use the lead agent in the active session.
`/plan` remains an isolated planner subtask. It returns to the lead for design review and user approval.
No command removes approval gates. `/finish` does not commit, push, open a pull request, merge, or deploy.

## Context and learning

| Command | Purpose |
| --- | --- |
| `/checkpoint <task-id>` | Save an authorized project-local handoff without overwriting unrelated notes. |
| `/resume-work <handoff-path>` | Revalidate source evidence, task ownership, approvals, and the remaining budget. |
| `/explain <feature>` | Trace the actual code path and the invariants behind its safeguards. |
| `/quiz <topic>` | Ask source-grounded questions and wait for answers. A score is not a merge gate. |

`/resume-work` does not replace the built-in `/resume` session selector or native compaction.
Checkpoint paths belong to the current work project, never to the global configuration.

## Review

| Command | Purpose |
| --- | --- |
| `/review` | Review recent changes and return findings. |
| `/code-review` | Review staged and unstaged changes with severity levels and a verdict. |
| `/security-review` | Review security risks; CRITICAL and HIGH findings block progress. |
| `/go-review` | Review Go-specific behavior and conventions. |

## Refactoring and documentation

| Command | Purpose |
| --- | --- |
| `/refactor-clean` | Classify dead code and duplicates by risk, then verify authorized cleanup. |
| `/update-docs` | Update documentation for the current changes. |

## Git

| Command | Purpose |
| --- | --- |
| `/commit` | Stage and commit under the existing secret-scan and conventional-commit policy. |
| `/push` | Push the current branch under the existing approval policy. |
| `/summarize-branch` | Summarize the branch commits before a pull request. |

See the [skill catalog](../skills/README.md) and [development procedure](../skills/development-workflow/SKILL.md).
