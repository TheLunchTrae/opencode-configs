---
name: finish
description: Verify the final diff, collect independent reviews, and hand off evidence without shipping.
---

# Finish a change

Use this skill in the active `lead` session with [the lead's review and approval policy](../../agents/lead.md).
A `/finish` request alone does not authorize shipping.

1. Compare the current diff with the approved outcome and non-goals. Identify unexpected changes.
2. Consider only useful simplification within the approved scope. Re-verify any resulting changes.
3. Use `verify` on the final source. Record local checks separately from CI status.
4. Collect the reviews required by the lead's policy. Supply the current diff, acceptance criteria, context, and evidence.
   Review may proceed while CI is missing or failing; report that limit.
5. Resolve blocking findings within the remaining approved budget. Repeat affected checks and reviews after fixes.
6. Assess merge readiness separately, using the lead's branch, conflict, CI, and review requirements.
7. Report changed behavior, observed checks, review dispositions, blockers, residual risks, and the next action.

Distinguish `PASS`, `FAIL`, `BLOCKED`, and `SKIP`. Static parsing is not native loading or model-assisted validation.
A self-review is not independent review. Missing mandatory reviews remain explicit blockers.

## Retain one useful lesson

When a recurring mistake has concrete evidence, propose one targeted project improvement.
Prefer an existing test, lint rule, or documented interface contract over a long global prompt.
Record the failure pattern, proposed prevention, and a check for it.
Follow the lead's authorization policy before changing persistent instructions or tooling.
Use `project-standards` for deliberate tooling adoption. Keep project lessons out of global configuration.
Learning notes and quizzes are not merge gates.
