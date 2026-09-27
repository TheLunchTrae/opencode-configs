# Skills

Skills load on demand. The lead selects the relevant procedure and preserves the existing approval gates.
A skill does not grant tools, edit rights, or Task permission.

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

Reviewers load `@reviewer-standards` and `@review-template` as required by their role.
Use `project-standards` for new test tooling, linting, formatting, type checks, or CI configuration.
It does not replace ordinary tests, routine verification, or defect fixes.

## Git

| Skill | Purpose |
| --- | --- |
| `commit` | Stage and commit with secret scanning and a reason-focused conventional message. Matches `/commit`. |
| `push` | Push the current branch under the existing approval policy. Matches `/push`. |

Copy complete skill folders, including supporting license files. Keep project checkpoints in their work project.
The [workflow synthesis](../.opencode/WORKFLOW-SYNTHESIS.md) explains the source contributions and deliberate omissions.
