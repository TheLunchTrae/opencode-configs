# Common task response

Use this structure for final, partial, or blocked task responses. Routine progress updates need not use it.
Task profiles define `Result`; this file defines the shared envelope and status meanings.
Read `@agent-prompts/verification-scope.md` before selecting or assessing checks. Preserve the assigned verification
limits in the result and evidence. Accepted limitations alone do not make the assigned task `BLOCKED` or `PARTIAL`.
Use the assigned profile when it fits the task and role; otherwise use the default or report a mismatch.
Keep all four level-two headings in order. Use `None` for empty required sections.
Omit assignment history and the assigning agent's identity or workflow.

```markdown
## Task status
COMPLETE | PARTIAL | BLOCKED — scope-specific reason

## Result
Task-profile sections

## Evidence
Source state, inspected sources, and observed or supplied check results

## Unresolved items
Remaining scope, uncertainty, prerequisites, and required follow-up; or None
```

Choose one task status:

| Status | Meaning |
| --- | --- |
| COMPLETE | The assigned work is complete. The result can contain defects, failed checks, or review needs. |
| PARTIAL | Useful work is complete, but some required scope remains unassessed or unfinished. |
| BLOCKED | An essential input, authorization, permission, or environment prevents meaningful task progress. |

Separate task completion, review verdicts, and check results. Completed reviews can find blocking defects; completed
checks can fail. Missing required checks are not passes. Task status never establishes approval or readiness.
For a research-only assignment, use `@agent-prompts/response-formats/research.md` for `Result`, even when the usual
profile covers edits. Research remains bounded by the assigned specialty and permissions; it does not authorize edits.

## Evidence requirements

- Identify reviewed or changed scope and source state: revision, relevant dirty/untracked files, or supplied document
  and version. Report unavailable source state.
- Cite verified paths and lines, document sections, or other relevant sources. Mark proposed files as new.
  State the search scope behind a negative result. A missing match does not prove that no consumer exists.
- Separate personally inspected or executed evidence from supplied results and proposed checks.
- For executed checks, give command, working directory, source state, available exit code, and useful results.
  Explain failed, blocked, and skipped checks. Never fabricate execution evidence.
- Without execution, report inspected sources and limits, not invented command results.

## Unresolved items requirements

For each item, state affected scope, evidence or uncertainty, and the needed decision, input, review, or action.
Describe needs without routing them to named agents. Reuse same-scope authorization.
For immediate stop conditions, return available evidence in this structure with unfinished scope marked.
A response grants no permission to edit, delegate, approve, commit, or ship.

## Project learning

For an assigned failure-prevention assessment, an evidenced recurring mistake, or repeated attempts that stop
at a blocker, read `@agent-prompts/project-learning.md` within the task's budget and stopping conditions.
Put the assessment and justified prevention in existing `Result` sections, support in `Evidence`, and unassigned
changes or decisions in `Unresolved items`. Preserve the profile and verdict criteria.
Do not require a learning section in every response or invent findings to fill it.
