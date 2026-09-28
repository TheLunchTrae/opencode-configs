# Skills

Skills load on demand. The lead selects the relevant procedure and preserves the existing approval gates.
A skill does not grant tools, edit rights, or Task permission.
Workflow and approval policy lives in [lead](../agents/lead.md); planning lives in [planner](../agents/planner.md).
The `development-workflow` and `plan` skills are entry points to those agents.

## Development

| Skill | Purpose |
| --- | --- |
| `development-workflow` | Route work through planning, bounded tasks, acceptance evidence, and review. |
| `spec-interview` | Resolve consequential ambiguity before planning. Matches `/spec`. |
| `plan` | Produce a source-backed plan with acceptance slices. Matches `/plan`; the planner stays read-only. |
| `phased-plan` | Plan a requested or necessary staged rollout with per-phase rollback. Matches `/phased-plan`. |
| `test-first` | Observe a meaningful failing test, implement the behavior, and verify green. |
| `measured-performance` | Compare a baseline and candidate under the same measurement conditions. |
| `checkpoint` | Save or validate a project-local handoff. Matches `/checkpoint` and `/resume-work`. |
| `finish` | Collect final checks, independent reviews, and lessons without shipping. Matches `/finish`. |
| `code-learning` | Explain code mechanics and optional questions. Matches `/explain` and `/quiz`. |

## Review and verification

| Skill | Purpose |
| --- | --- |
| `review` | Review code with shared standards and report format. Matches `/review` and `/code-review`. |
| `security-review` | Review security-sensitive changes. Matches `/security-review`. |
| `verify` | Run configured checks and report PASS, FAIL, BLOCKED, or SKIP. Matches `/verify`. |
| `project-standards` | Plan and approve deliberate repository standards and tooling changes. |

Reviewers load `@agent-prompts/reviewer-standards.md` and `@agent-prompts/review-template.md` as required by their role.
Shared prompts live in `references/agent-prompts/`, exposed through one hidden `agent-prompts` directory reference.
Use paths such as `@agent-prompts/review-template.md`. Hidden affects `@` autocomplete only.
Use `project-standards` for new test tooling, linting, formatting, type checks, or CI configuration.
It does not replace ordinary tests, routine verification, or defect fixes.

## Git

| Skill | Purpose |
| --- | --- |
| `commit` | Stage and commit with secret scanning and a reason-focused conventional message. Matches `/commit`. |
| `push` | Push the current branch under the existing approval policy. Matches `/push`. |

Copy complete skill folders, including supporting license files, with their owning agents and references.
Keep project checkpoints in their work project.
