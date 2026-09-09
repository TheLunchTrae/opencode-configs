---
description: Produce a detailed implementation plan for the current task, with file paths, risks, and dependencies — no code written. Waits for confirmation before implementation begins. Use `/phased-plan` instead when the change must roll out gradually.
agent: planner
subtask: true
---

Create a detailed implementation plan before writing any code.

Restate the requirements clearly, identify risks and dependencies, then produce a plan
with explicit file paths and step-by-step actions. Default to a single-pass, immediate
full-state plan — only break into phases if the user explicitly asked for that or if
phasing is structurally required (e.g. ship a schema migration before the code that
reads from it). Do not write any code — output the plan only. Wait for user confirmation
before implementation begins.

$ARGUMENTS
