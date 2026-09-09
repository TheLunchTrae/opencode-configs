# Skills

| Skill | What it does |
|-------|--------------|
| `commit` | Stage and commit changes with a secret-scan guard and a "why-not-what" commit message. Matches the `/commit` command. |
| `plan` | Draft a detailed implementation plan (phases, file paths, risks) before any code is written. Matches the `/plan` command. |
| `phased-plan` | Draft a phased rollout plan with migration windows, backwards-compat scaffolding, and per-phase rollback. Matches the `/phased-plan` command. |
| `push` | Push the current branch to its remote, handling first-push tracking and network-error retries. Matches the `/push` command. |
| `review` | Review code and present findings. Matches `/review` and `/code-review`. |
| | Load `@reviewer-standards` and `@review-template`. |
| `security-review` | Security-focused review of current changes or specified files. Matches the `/security-review` command. |
| `project-standards` | Plan and approve new-project or repository standards and deliberate test-tooling, linting, formatting, type-check, CI, and tooling configuration. Does not write ordinary tests, run routine checks, or fix ordinary defects. |
| `verify` | Run the verification loop (type checking, linting, tests, build) and report PASS/FAIL with action items. Matches the `/verify` command. |
