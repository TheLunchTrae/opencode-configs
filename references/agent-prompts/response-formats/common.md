# Common task response

Use this structure for a final, partial, or blocked task response. Routine progress updates need not use it.
Each task profile defines the content of `Result`; this file owns the shared envelope and status meanings.
Use the assigned profile when it fits the task and role; otherwise use the agent's default profile or report a mismatch.
Keep all four level-two headings in this order. Use `None` for an empty required section.
Do not copy assignment history or describe the identity or workflow of the agent that assigned the task.

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

Task completion, review verdicts, and check results are different facts. A completed review can find a blocking defect.
A completed check can fail. A missing required check is not a pass.
Never use task status to claim approval or readiness.
For a research-only assignment, use `@agent-prompts/response-formats/research.md` for `Result`, even when the usual
profile covers edits. Research remains bounded by the assigned specialty and permissions; it does not authorize edits.

## Evidence requirements

- Identify the reviewed or changed scope and source state: revision, relevant dirty or untracked files, or a supplied
  document and version. State when source state cannot be established.
- Cite verified paths and lines, document sections, or other relevant sources. Mark proposed files as new.
  State the search scope behind a negative result. A missing match does not prove that no consumer exists.
- Separate personally inspected or executed evidence from supplied results and proposed checks.
- For executed checks, give the command, working directory, source state, exit code when available, and useful result
  details. Report failures, blocked checks, and skipped checks with reasons. Do not fabricate execution evidence.
- For tasks without execution, report inspected sources and applicable limits. Do not add invented command results.

## Unresolved items requirements

For each item, state the affected scope, the evidence or uncertainty, and the decision, input, review, or action needed.
Describe the need without routing it to a named agent. Recognize authorization already supplied for the same scope.
If a stop condition requires an immediate response, return available evidence in this structure and mark unfinished
scope explicitly. A response is evidence, not permission to edit, delegate, approve, commit, or ship.

## Project learning

For an assigned failure-prevention assessment, an evidenced recurring mistake, or repeated attempts that stop
at a blocker, read `@agent-prompts/project-learning.md` within the task's budget and stopping conditions.
Use the existing `Result` sections for the assessment and any justified prevention, `Evidence` for support, and
`Unresolved items` for unassigned changes or decisions. Preserve the selected profile and its verdict criteria.
Do not add a required learning section to every response or invent a finding to populate it.
