---
name: finish
description: Verify the final diff, collect independent reviews, and hand off evidence without shipping.
---

# Finish a change

Use this skill in the active `lead` session. It coordinates existing skills and reviewers, not a nested lead agent.
A `/finish` request does not authorize a commit, push, pull request, merge, or deployment.

1. Compare the current diff with the approved outcome and non-goals. Identify unexpected or unrelated changes.
2. Check whether a scoped simplification is worthwhile. Delegate only within existing approval and permissions.
   Do not expand a finish step into unrelated cleanup. Re-verify any changed code.
3. Use `verify` on the final source state. Record local checks separately from CI status.
4. Check target-branch currency, merge conflicts, and configured CI as required by the existing review gate.
   If a required result is unavailable, record a blocker. Do not claim that missing CI passed.
5. Dispatch the mandatory general, language, architecture, and security reviews that apply to the changed scope.
   Supply acceptance criteria, exact diff, surrounding source, and verification evidence.
   Reuse only current, complete findings for identical scope; do not repeat unchanged reviews.
6. Resolve blocking findings within approval. Repeat affected checks and reviews after fixes.
   Stop after the remaining task budget is exhausted or repeated failure produces no new evidence.
7. Report outcome, changed behavior, observed checks, review dispositions, residual risks, and the next action.

Distinguish `PASS`, `FAIL`, `BLOCKED`, and `SKIP`. Static parsing is not native loading or model-assisted validation.
A self-review cannot be reported as an independent reviewer run. Missing mandatory reviews remain explicit blockers.
Preserve the user's control over lower-severity findings and shipping decisions.

## Retain one useful lesson

When a recurring mistake has concrete evidence, propose one targeted project improvement.
Prefer an existing test, lint rule, or documented interface contract over a long global prompt.
Record the failure pattern, evidence, proposed prevention, and how to test it.
Do not promote a one-off assumption to a permanent rule. Recheck or remove obsolete lessons.
Ask before changing project instructions or tooling; use `project-standards` for deliberate tooling changes.
Keep project lessons out of the global configuration. Learning notes or quizzes are never merge gates.
