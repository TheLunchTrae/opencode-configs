# Implementation response

Read `@agent-prompts/response-formats/common.md` if its guidance was not already supplied.
Use its envelope with these sections under `Result`:

### Changes

State changed behavior and files, or why no change was needed. Relate each change to the assigned outcome.
For cleanup, include the risk category and reference evidence for removals. For simplification, state the preserved
behavior and why clarity improves. Identify deviations from approved scope.

### Acceptance

Relate the change and checks to acceptance examples and preserved invariants. Distinguish verified behavior from
unverified expectations. For test-first work, include observed red/green and regression evidence in `Evidence`.

Put actual check details and source state in `Evidence`. Put blockers, uncovered behavior, risks, and required review
in `Unresolved items`. An implementation assignment does not authorize commits or other external actions.
