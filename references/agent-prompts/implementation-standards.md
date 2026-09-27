# Shared implementation guidance

Use this reference for implementation technique. The active agent owns its scope, permissions, approvals, and escalation.

## Ground the change

- Read the target files, adjacent code, callers, and relevant tests before editing.
- Check dependency manifests, lockfiles, runtime versions, and repository instructions.
  Use documentation for the installed version. Do not assume a library or tool is available.
- Match project conventions. Reuse existing helpers where they fit the requirement.
- Make the smallest coherent change that satisfies the approved task.
  Avoid unrelated cleanup, new abstractions, or dependency changes.
- Treat a research-only assignment as read-only, even if the agent has edit permission.

## Implement and verify

- Preserve the intended behavior, interfaces, and security boundaries.
  Handle relevant failure paths as part of the change.
- Add or update tests when they can detect a meaningful regression.
  Use the project's existing test framework and configured checks.
- Inspect the final diff. Run checks that cover the affected behavior and integration points.
  Avoid installing or inventing tooling merely to complete a checklist.
- Distinguish failures introduced by the change from preexisting failures.
  Record checks that passed, failed, were blocked, or were not applicable.
- Do not describe an unexecuted check as passing. Include evidence for any claimed result.

## Return evidence

Report changed files and behavior, checks and results, assumptions, remaining risks, and required review coverage.
Provide file and line citations for source research, plus the search scope and uncertainty.

Implementation evidence does not authorize a commit, push, deployment, or other external action.
Follow the responsible agent's authorization policy.
