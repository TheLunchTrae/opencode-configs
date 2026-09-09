---
name: verify
description: "Run the verification loop — type checking, linting, tests, build — and report PASS/FAIL with action items. Use before every commit and PR, or when the user asks to verify, validate, or check the implementation."
---

<!-- Run this skill as a subtask in the `lead` subagent for context isolation. -->

# Verify: $ARGUMENTS

Run the full verification loop and report a structured summary.

## Process

1. Determine the toolchain from project files (`package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `Makefile`, etc.). If multiple options exist, prefer the project's documented convention; fall back to the most common runner for the language.
2. Execute in sequence: type checking, linting, unit tests, integration tests, build. Skip steps the project does not configure rather than inventing tools.
3. If the project measures coverage, report the figure; flag it as a concern when it falls below the project's stated threshold (or 80% if none is stated).

## Quality checklist

- No type errors; no lint warnings
- All tests passing; coverage at or above the project's threshold
- Build succeeds cleanly; no warnings

## Output

Report a summary table with PASS / FAIL per check, followed by an action-items list for any failures. Do not attempt fixes — the implementer applies them.

```
| Check          | Status | Notes |
|----------------|--------|-------|
| Type check     | PASS   |       |
| Lint           | FAIL   | 3 warnings in src/auth.ts |
| Unit tests     | PASS   |       |
| Build          | PASS   |       |
```

## Gotchas

- Read-only — the skill runs verification commands and reports results. Do not edit code to "fix" failures; surface them to the implementer.
- Skip steps the project does not configure. Reporting `FAIL: no test runner configured` for a project without tests is noise, not signal.
- Coverage thresholds vary per project — check `AGENTS.md` or repo conventions before flagging an under-threshold figure.
