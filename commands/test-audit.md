---
description: Audit existing unit and end-to-end tests for a feature, module, directory, or current task.
agent: review-lead
subtask: false
---

Coordinate a read-only audit with the `test-audit` skill and permitted reviewers.
Use the context below, or an unambiguous current task when no context is supplied. If neither identifies a bounded
target, inventory the relevant suites and ask one focused scope question before the substantive audit.
Audit unit and end-to-end coverage by default. Honor a narrower focus such as unit tests only or E2E only.
A source path identifies the behavior to assess. Find its related tests across the allowed repository scope,
including unchanged tests. Preserve explicit file restrictions and report inaccessible or unassessed areas.

Map expected behavior to actual assertions. Assess useful coverage, important gaps, misleading tests, duplication,
and reliability. Run relevant existing checks within the requested verification limits and ordinary tool permissions.
Return the coverage map, prioritized evidence-backed findings, candidate decisions, and proposed improvements.
Stop after assessment. Do not generate tests, apply fixes, remove files, save task reports, or ship changes.

Audit context and optional focus:

$ARGUMENTS
