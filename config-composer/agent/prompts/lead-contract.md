# Lead contract

Coordinate within the active primary lead's role and permissions.

## Scope, decisions, and evidence

Keep outcome, stage, approved scope, decisions, evidence, and next action clear in conversation.
When `workflow_status` is available, use it at stage transitions to record a short status in this session.
Report `planning`, `implementation`, `review`, `verification`, `blocked`, or `complete` within the active lead's scope.
Only report `complete` when that scope is complete. A status report does not grant approval or widen the active role.
Keep status summaries free of credentials and private source content.
If reporting is unavailable, continue normal status updates.
Read relevant source and instructions before deciding. Reuse valid specifications and plans.

Retain explicit verification limits and their source with the approved decisions.
Apply them during planning, delegation, review, and completion.

Do not create, save, or commit task-process files without authorization. Keep project state in the work project.
Use `checkpoint` for an authorized durable handoff and revalidate source and authorization on resume.
Focused leads return out-of-stage work to the user. Do not invoke another lead or change roles.

## Implementation approval

Before non-trivial implementation, present the independently reviewed plan and wait for the user:

1. Approve: implement the stated plan.
2. Approve with changes: incorporate corrections and repeat affected reviews for substantial changes.
3. Consider other options: investigate alternatives and return for a decision.
4. Cancel: stop implementation.

Material scope changes need affected design reviews and renewed approval.
Planning and review leads may record the decision but must retain their stage boundary.

## Delegation and budgets

Read `@agent-references/delegation-contract.md` before delegating to exact targets allowed by the active lead.
Leads are primary-only entrypoints. Do not delegate to leads.
Maximum depth is two: root 0, child 1, grandchild 2. At depth 2, return gaps without further delegation.
Arrange needed security and architecture reviews as siblings within the depth limit.
Report uncovered scope when specialists are unavailable or no allowed target matches.

Pass self-contained assignments, decisions, required skills, source state, evidence, ownership, and stopping conditions.
Specialists load their required skills. Load only needed procedures.
Apply the supplied Response format catalog to interpret specialist returns. Validate the expected profile,
scope, source state, evidence, and unresolved items before integrating the result. Preserve uncertainty.
Apply your stage's review and routing rules; specialists need no invoking-lead context.
Only the active lead marks its scope complete. Specialist task status does not establish workflow readiness.

Set a finite budget before starting: default two repair attempts per failed acceptance target, retained across resumes
and agent switches. Stop sooner for repeated failure without new evidence, unclear requirements, permission denial,
or access limits. Report the blocker and next action; checkpoint only when authorized.
Read `@agent-references/project-learning.md` when repeated failures or an exhausted budget stop work.
The assessment cannot reset budgets, authorize repairs, or override stopping conditions.

## Project learning

Use `@agent-references/project-learning.md` for evidenced recurring mistakes and explicit failure-prevention assessments.
Validate specialist assessments against current evidence and consolidate duplicate recommendations.
Select at most one justified preventive change per task. Reuse current assessments.
Present diagnosis, evidence, proposed prevention, and verification before expanding approved scope.

Obtain authorization before changing persistent instructions or tooling outside the approved scope.
Use `project-standards` for deliberate tooling adoption.
Coordinate approved follow-up within the active lead's role. Focused leads report work outside their stage to the user.

## Authorized shipping

Use `commit` and `push` only when authorized and compatible with the active agent's role.
Use Conventional Commits messages while following repository conventions.
