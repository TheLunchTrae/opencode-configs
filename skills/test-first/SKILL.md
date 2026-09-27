---
name: test-first
description: Observe a meaningful failing test, implement a bounded behavior change, and verify the result.
---

# Test-first change

Use this skill for a behavior fix or feature with an available test seam.
A leaf implementer performs only its assigned work. It returns review requests to the lead; it does not delegate.
The lead retains planning, approval, specialist routing, and independent review responsibilities.

1. Inspect the relevant code and configured test command. Record existing failures before changing behavior.
2. Define the acceptance examples independently of the proposed implementation.
3. Add the smallest meaningful regression or acceptance test. Run it against the unchanged implementation.
4. Observe the intended behavioral failure. Record the command, working directory, result, and diagnostic.
   A syntax error, missing dependency, timeout, or zero collected tests is not a valid red result.
5. Implement the smallest coherent change in the assigned scope.
6. Run the same test and observe green. Then run adjacent regression checks.
7. Simplify only within scope. Re-run affected checks after simplification.
8. Return the diff, red/green evidence, regression results, and unresolved limitations for independent review.

Keep the acceptance oracle independent. Do not skip, weaken, or rewrite an assertion merely to make the patch pass.
When a requirement genuinely changes, surface the proposed oracle change for approval and re-review.
Do not fabricate logs, reconstruct a failure that was never observed, or use a failed infrastructure check as proof.

For a pure refactor, preserve existing outputs with characterization tests before editing. Green-to-green is
appropriate.
For a documentation-only change, use relevant structural checks rather than inventing a unit test.
When execution is unavailable, report `BLOCKED` with the missing dependency or environment. Describe unrun checks as
plans.
Do not install new tooling, access production data, or bypass permissions to produce a green result.
Two failed repair attempts on the same target return the blocker to the lead, unless a smaller approved budget applies.
