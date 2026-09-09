# Slash commands

### Day-to-day workflow

| Command | What it does |
|---------|--------------|
| `/plan` | Draft an implementation plan for the current task — file paths, risks, dependencies. No code is written; it waits for your approval before executing. |
| `/phased-plan` | Same as `/plan` but produces a phased rollout — independently mergeable phases with migration timeline, backwards-compat scaffolding, and per-phase rollback. Use when shipping atomically isn't safe. |
| `/design` | Produce an architectural design: components, data flow, trade-offs, alternatives. Used when the "how" isn't settled. |
| `/verify` | Run the verification loop (tests, linters, typecheck) and report. |

### Reviewing code

| Command | What it does |
|---------|--------------|
| `/review` | Lightweight review of recent changes with findings. |
| `/code-review` | Comprehensive review of staged + unstaged changes. Returns severity-graded findings (CRITICAL / HIGH / MEDIUM / LOW) and an approval verdict. |
| `/security-review` | OWASP Top 10 + common vulnerabilities. CRITICAL / HIGH findings block progress until resolved. |
| `/go-review` | Go-specific idiomatic review. |

### Refactoring and cleanup

| Command | What it does |
|---------|--------------|
| `/refactor-clean` | Find unused code, dead dependencies, duplicated logic. Categorizes findings by risk (SAFE / CAREFUL / RISKY), removes only the SAFE ones, and verifies with tests between batches. |
| `/update-docs` | Update documentation to reflect the code changes in the current session. |

### Git

| Command | What it does |
|---------|--------------|
| `/commit` | Stage and commit changes with a conventional-commits message. |
| `/push` | Push the current branch to the remote. |
| `/summarize-branch` | Summarize every commit on the current branch — useful before opening a PR. |
