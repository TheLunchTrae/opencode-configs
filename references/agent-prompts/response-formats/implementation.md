# Implementation response

Read `@agent-prompts/response-formats/common.md`. Use its envelope with these sections under `Result`:

### Changes

State changed behavior and files, or explain why no change was needed. Connect each change to the assigned outcome.
For cleanup, include the risk category and reference evidence for removals. For simplification, state the preserved
behavior and why the change improves clarity. Identify any deviation from the approved scope instead of hiding it.

### Acceptance

Relate the change and checks to acceptance examples and preserved invariants. Distinguish verified behavior from
unverified expectations. For test-first work, include observed red/green and regression evidence in `Evidence`.

Put actual check details and source state in `Evidence`. Put blockers, uncovered behavior, risks, and required review
in `Unresolved items`. An implementation assignment does not authorize commits or other external actions.
