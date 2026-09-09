---
name: phased-plan
description: Produce a phased implementation plan with migration windows, backwards-compatibility scaffolding, and per-phase rollback. Use when the user asks for a phased rollout, gradual migration, or in-phases plan — overrides the planner's default-to-immediate-change directive.
---

<!-- Run this skill as a subtask in the `planner` subagent for context isolation. -->

# Phased plan: $ARGUMENTS

Produce a phased rollout plan. This overrides the planner's default-to-immediate-change directive: the user has explicitly asked to ship the change in phases.

## When this skill applies

Use this skill (instead of the default `/plan` workflow) when one or more of the following holds:

- The system must keep serving traffic during the change.
- Downstream consumers need a deprecation window before the old behavior disappears.
- The change is too large to land in a single diff safely (schema migrations, data backfills, breaking API changes).

If none of those apply, the default immediate-change plan is the right fit.

## Plan structure

Break the work into independently mergeable phases. Each phase ships on its own and leaves the system in a working state. Use as few phases as the change actually needs — don't pad to four.

Typical phase shapes:

- **Phase 1** — smallest slice that provides value
- **Phase 2** — complete happy path
- **Phase 3** — error handling, edge cases, polish
- **Phase 4** — performance, monitoring, analytics

## Considerations to surface

- **Migration** — schema changes, data backfill, dual-write windows, read-from-old / write-to-new transitions. Note each migration's reversibility.
- **Backwards compatibility** — public API versioning, feature flags, deprecation timeline. State which phase removes the old code path.
- **Rollback** — per-phase back-out plan. If phase N can't be safely reversed once phase N+1 lands, call it out.
- **Operations** — deployment strategy, monitoring/alerting changes, on-call runbook updates.

## Output

For each phase, include:

- One-line goal
- Files touched (paths)
- Step ordering and inter-step dependencies
- Rollback procedure
- "Mergeable independently" check — does the system still work if only this phase lands?

End with a risks-and-mitigations section that flags coordination points across phases.

## Gotchas

- Subagent fork — output is a plan, not an implementation. Wait for explicit user approval before any code is written.
- The planner does not run tests or execute scripts; verification steps in the plan are descriptions, not results.
- If the request doesn't actually need phasing, say so and recommend `/plan` instead rather than padding the plan with unnecessary phases.
