# Completion and final assessment

Use in the active primary lead under its role boundary and `@agent-prompts/lead-contract.md`.
Workflow and implementation leads use this before their final handoff. A review lead uses it for an explicitly
requested final assessment and reports repairs as follow-up; it cannot execute them.

1. Compare the current diff with the approved outcome and non-goals. Identify unexpected changes.
   If approval evidence is unavailable in a standalone assessment, report that limit rather than inventing it.
2. In an implementation scope, consider only useful simplification and refresh evidence after changes.
3. Use `verify` on the final source in the active session. Verification is evidence-only: return fixes or coverage
   gaps to an authorized implementation assignment. Do not generate tests or repair code inside verification.
4. Collect required reviews under `@agent-prompts/review-stage.md`. Reuse current findings.
   Supply current source, acceptance criteria, context, and check evidence. State missing or failing CI explicitly.
5. Within an approved implementation scope and remaining budget, resolve blocking findings and refresh affected checks
   and reviews. A material scope change needs design review and renewed approval. A review lead reports the blocker.
6. Assess merge readiness separately. Require current reviews, applicable configured CI, target-branch currency, and
   resolved conflicts for the current source. Do not invent CI requirements for a project without configured CI.
7. Report changed behavior or assessed scope, observed checks, review dispositions, blockers, residual risks,
   and the next action.

Distinguish `PASS`, `FAIL`, `BLOCKED`, and `SKIP`. Static parsing is not native loading or model-assisted validation.
A self-review is not independent review. Missing mandatory reviews remain explicit blockers.
Final handoff does not authorize shipping. Use `checkpoint` before a context reset only when saving is authorized.

## Project learning

When a recurring mistake has concrete evidence, propose one targeted project improvement.
Prefer an existing test, lint rule, or interface contract over a long global prompt.
Record the failure pattern, proposed prevention, and a check for it in conversation first.
Obtain authorization before changing persistent instructions or tooling outside the approved scope.
Use `project-standards` for deliberate tooling adoption. Keep project lessons out of global configuration.
Learning notes and quizzes are not merge gates.
