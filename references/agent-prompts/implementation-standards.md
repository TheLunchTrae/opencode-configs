# Shared implementation guidance

Use this reference for implementation technique within the assigned scope, permissions, and authorization.

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

Use the agent's canonical response profile. `@agent-prompts/response-formats/implementation.md` covers implementation;
`@agent-prompts/response-formats/research.md` covers research-only assignments. Use the specialized performance or
documentation profile when the task requires it.

Implementation evidence does not authorize a commit, push, deployment, or other external action.
Honor the task's authorization boundaries and report unmet prerequisites without expanding the assignment.
