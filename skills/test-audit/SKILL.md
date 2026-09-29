---
name: test-audit
description: Audit existing test suites for useful coverage, duplication, misleading assertions, and unnecessary test support. Use for a scoped suite assessment or approved test cleanup, including unchanged tests.
---

# Audit an existing test suite

Read `@agent-prompts/testing-standards.md` and applicable repository instructions.
Apply only the assigned assessment or implementation portion. This skill grants no edit, execution, or delegation
authority. An audit request means read-only assessment unless cleanup is explicitly included in an approved scope.

## Establish the scope

Resolve the requested suite, capability, package, or repository. An explicit suite audit includes its existing tests,
not only the current diff. If no scope is supplied, inventory the available suites and propose bounded audit batches.
Do not silently audit only convenient files or claim complete coverage from a sample.

Read test configuration, CI selection, setup, fixtures, relevant production entry points, and existing test commands.
Identify which tests actually run in each relevant environment. Record the source state and inspection scope.
Use permitted existing commands for baseline evidence. A planner only proposes execution.
Do not add tools or run custom verification scripts to bypass a reviewer's tool restrictions.

## Assess coverage and candidates

Trace each candidate's assertions through the production behavior they claim to protect. Inspect callers, sibling
paths, relevant dependency contracts, overlapping tests, and available history before judging its value.
Separate confirmed evidence from missing history or uncertain external consumers.

Classify each assessed candidate as retain, consolidate, rewrite, remove, or uncertain. Explain the reason.
Include missing important coverage, incorrect test boundaries, and misleading pass conditions as findings.
Optimize confidence and maintenance effort. Do not use a deletion quota or assume that passing tests are useful.

Before recommending a removal or loss of coverage, record:

- The exact test location, claimed contract, and failure its assertions can detect.
- The source of the expected behavior and relevant history, or the limits of available evidence.
- Existing assertions that will still detect that failure, or evidence that the contract is obsolete.
- Production and external consumers of any support code proposed for removal, including dynamic usage risks.
- The proposed change, coverage impact, risk, and focused validation command.

Missing evidence leaves the candidate uncertain. Preserve it while reporting the bounded investigation needed.
Do not call a test redundant merely because another test executes the same lines.
Keep independently useful compatibility, security, release, storage, and other contracts under the shared standards.
A failing retained contract can reveal a product defect. Report it instead of deleting the test to restore green.

## Propose or perform a coherent change

Return findings before edits. Group related changes around one behavior or owning component.
For rewrites or consolidation, identify the assertions that must survive and demonstrate replacement coverage before
removing the old proof. Preserve uncertainty and risks for the user's reviewed cleanup decision.

Implement only when the assigned role permits edits and the reviewed approval covers the target files and removals.
Honor existing authorization for that scope. Public interfaces and uncertain external consumers retain their normal
approval requirements. Do not treat a test's sole local reference as proof that a production export is unused.
Remove unnecessary helpers or runtime hooks only after their lack of real consumers is established.
Avoid introducing replacement wrappers or tests that reproduce the same weak evidence.

Do not edit a checkout while its tests are running. Run affected tests before and after an approved change when
available. Check sibling coverage and the actual executable behavior when replacing static assertions.
Use `verify` for results and limits. A passing reduced suite alone does not prove that removed coverage was redundant.
Report any unavailable validation without claiming that the cleanup is verified.

## Return the assessment

Use `@agent-prompts/response-formats/review.md` for assessment and
`@agent-prompts/response-formats/implementation.md` for approved cleanup.
Put candidate decisions and supporting evidence in the existing profile, with coverage gaps and uncertainty explicit.
Distinguish inspected scope from unassessed suites. Report valuable apparent false positives, preserved contracts,
changes to test support, checks actually run, and necessary follow-up.
Keep plans and execution logs in conversation or an authorized task location. An audit does not authorize shipping.
