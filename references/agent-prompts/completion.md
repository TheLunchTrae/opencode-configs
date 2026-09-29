# Completion and final assessment

Apply within the active primary lead's role and `@agent-prompts/lead-contract.md`.
Workflow and implementation leads use this before final handoff. Review leads use it for explicitly requested final
assessment and report repairs without executing them.

1. Compare the current diff with the approved outcome and non-goals. Identify unexpected changes.
   Report unavailable approval evidence in standalone assessments.
2. In an implementation scope, consider only useful simplification.
3. Apply the agreed verification boundary. Use `verify` on the final source for in-scope checks.
   If all agent verification is excluded, report that limitation without capability discovery or
   execution. Return in-scope fixes or coverage gaps to authorized implementation. Verification generates evidence,
   not tests or repairs.
4. Collect required reviews under `@agent-prompts/review-stage.md`. Reuse current findings.
   Supply current source, acceptance criteria, context, and check evidence. State missing or failing CI explicitly.
5. Within an approved implementation scope and remaining budget, resolve blocking findings and refresh affected checks
   and reviews. A material scope change needs design review and renewed approval. A review lead reports the blocker.
6. Assess merge readiness separately: current reviews, applicable configured CI, current target branch, and resolved
   conflicts for this source. Do not invent CI requirements where none are configured.
7. Report changed behavior or assessed scope, observed checks, accepted verification limitations, review dispositions,
   blockers, residual risks, and the next action. Accepted limitations do not block implementation completion.

Distinguish `PASS`, `FAIL`, `BLOCKED`, and `SKIP`. Static parsing is not native loading or model-assisted validation.
Missing mandatory reviews remain explicit blockers.
Use `checkpoint` before a context reset only when saving is authorized.

## Project learning

When recurring mistakes have concrete evidence, read `@agent-prompts/project-learning.md`.
Consolidate recommendations under the lead contract's coordination and approval rules.
Reuse prior stop-time assessments. Update only when new evidence changes the cause or proposed prevention.
