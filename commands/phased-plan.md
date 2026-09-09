---
description: Produce a phased implementation plan for the current task — independently mergeable phases with migration timeline, backwards-compat, and per-phase rollback. Waits for confirmation before implementation begins.
agent: planner
subtask: true
---

Produce a phased implementation plan rather than an immediate full-change plan.

Break the work into independently mergeable phases, each leaving the system in a working
state. For each phase, lay out file paths, step ordering, rollback procedure, and a
"mergeable independently" check. Surface migration considerations (schema/data, dual-write
windows), backwards-compatibility (API versioning, feature flags, deprecation timeline),
and operations (deployment strategy, monitoring changes). End with a risks-and-mitigations
section flagging coordination across phases.

Do not write any code — output the plan only. Wait for user confirmation before
implementation begins.

$ARGUMENTS
