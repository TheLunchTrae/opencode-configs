---
name: verification-tests
description: Design and generate reusable verification tests for existing repositories or established functionality. Use to backfill coverage, create characterization baselines, or make complex behavior repeatably testable.
---

# Verification tests for existing behavior

Use this procedure in the active lead session or within a bounded assignment from the lead.
Follow [the lead's workflow](../../agents/lead.md) for planning, approval, specialist routing, review, and task budgets.
Specialists apply only their assigned portion; do not create a nested lead or expand a read-only assignment.
Before writing tests, read `@agent-prompts/implementation-standards.md` and applicable project and language guidance.

Build executable coverage for established behavior. Use `test-first` when implementing a new behavior or fixing a bug.
A verification suite can combine unit, integration, contract, CLI, API, or end-to-end tests as the scope requires.
Full verification means coverage of the agreed behavior and boundaries, with explicit exclusions and remaining gaps.

## Discover the scope and available evidence

1. Resolve the requested capability, module, workflow, or repository scope. Inspect established behavior beyond the
   current diff. With no scope, inspect the repository and propose coverage before generating tests.
2. Read repository instructions, manifests, declared and installed versions, CI, test configuration, existing tests,
   fixtures, and documented commands. Verify paths and tools before proposing them.
3. Trace relevant entry points, callers, dependencies, outputs, errors, state changes, and external side effects.
   Identify important boundaries and explain what makes those paths difficult to test.
4. Identify reusable tests, helpers, and fixtures. Have a permitted executor run relevant existing checks and record
   baseline results when available. A read-only planner proposes checks; it does not execute them.
5. For repository-wide requests, map the in-scope surfaces and order work by risk. Keep uncovered surfaces visible;
   do not silently reduce the scope to easily tested functions.

## Establish expectations and design the suite

Derive expected results from documented requirements, public contracts, approved examples, or independent reference
data. Use implementation inspection to understand execution paths. When observed behavior is the only evidence, label
the test as characterization; an observed result does not establish that the behavior is correct.
Surface suspected existing bugs and consequential ambiguities through the lead. Continue independent, unambiguous
coverage where possible. Do not silently preserve a suspected defect as an approved requirement or fix application code.

Create a compact coverage map. For each behavior, include:

- The expected observable result and its source; distinguish requirements from characterization assumptions.
- Relevant normal, boundary, invalid-input, failure, recovery, and side-effect cases, with a reason for each.
- Existing coverage to reuse and the gap each proposed test addresses.
- The appropriate test level and real entry point, with any substituted dependencies and their limits.
- Fixtures, environment prerequisites, setup, cleanup, isolation, and execution command with working directory.
- Dependencies, risks, and behavior that will remain unverified.

Choose the smallest test level that exercises the relevant contract. Use integration or end-to-end coverage when
unit tests cannot establish the required behavior. Follow the framework agent's provider and runtime guidance.
If a harness is missing, propose the smallest suitable setup using the project's language and available tools.
List new dependencies, testability refactors, CI changes, and external environment needs explicitly in the design.
Use `project-standards` only for deliberate tooling or convention adoption; routine tests do not require it.

Supply the design, target files, commands, and exclusions to the lead's review and approval process before generating
tests. Honor approval already given for that scope. A design-only request ends with the reviewed design.

## Generate maintainable tests

- Extend the existing suite and conventions. Reuse sufficient tests instead of duplicating them.
  Keep tests, fixtures, helpers, and test documentation in the target repository.
- Exercise application behavior or the actual declarative contract. Avoid assertions that merely echo the input,
  repeat the implementation algorithm, inspect incidental source text, or verify a mock's configured answer.
- Assert relevant outputs, errors, persisted state, and observable side effects. Prefer public interfaces over private
  helpers unless the project has an established reason to test those helpers directly.
- Keep the subject and the behavior under verification real. Substitute dependencies only at a justified boundary;
  state which integration claims those substitutes cannot establish.
- Control time, randomness, fixture state, and external services where they affect repeatability. Isolate mutable data
  between tests. Use bounded waits and cleanup that also runs after failure. Follow project parallel-execution rules.
- Use disposable test resources and synthetic data. Do not depend on production data, personal credentials, or a
  developer's machine state. Expose required configuration through the project's existing test conventions.
- Use clear behavior-based test names and focused assertions. Add shared helpers only for genuine repeated setup.
  Keep expected values independently derived and review meaningful snapshots before accepting them.
- Preserve production behavior. Implement testability refactors, dependency installations, or CI changes only when
  included in the approved scope. Return missing access or an unavailable environment through the lead.

## Execute and assess the baseline

Run the generated tests against the recorded source state. New baseline tests can pass on their first execution;
an artificial red/green cycle is unnecessary. Inspect whether the assertions could detect the relevant regressions.
Where practical, demonstrate this with a known counterexample or a controlled fault in an isolated disposable copy.
Do not modify the working application's behavior to force a failure or introduce mutation tooling for a checklist.

Use [verify](../verify/SKILL.md) for execution evidence and result statuses. Record actual commands, working directory,
source state, collected tests, results, and environment limits. Check the relevant suite and integration boundaries.
Treat zero expected tests collected, skipped checks, missing services, and harness failures according to their actual
status; none establishes that the intended behavior passed.

Investigate failures to distinguish test or fixture defects, preexisting application defects, and unavailable
infrastructure. Report correct tests that expose existing defects as failures. Do not weaken assertions, accept new
snapshots blindly, or alter requirements to make the baseline green. Send the suite, coverage map, and observed
evidence for the lead's applicable implementation reviews. Resolve findings within the approved scope and budget.

## Hand off and reuse

Update the existing test documentation with the necessary prerequisites, setup, run commands, cleanup, covered
contracts, and known limitations. Keep this concise and colocated with established project guidance.
Keep task plans and execution logs in the conversation or the project's authorized task location; do not add process
reports to the global configuration or commit them without authorization.

When verifying later changes, map changed behavior and affected integration paths to this suite's assertions.
Reuse the tests that still cover the intended contracts. Extend coverage only for meaningful gaps through an approved
implementation assignment; `/verify` itself remains evidence-only. Update expectations only for a reviewed requirement
change, never simply because the implementation changed.
Rerun affected checks on the current source and environment. A passing baseline verifies only the behavior its
assertions exercise. Report uncovered changes and stale evidence instead of claiming full verification.
