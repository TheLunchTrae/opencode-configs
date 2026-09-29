---
name: end-to-end-tests
description: Design and implement reliable end-to-end tests for new features or existing user journeys across real application boundaries. Use for browser, CLI, API, or worker workflows whose integration risks need complete-path coverage.
---

# End-to-end coverage

Read `@agent-prompts/testing-standards.md` and applicable project and language guidance.
Use this procedure within the assigned role, approved scope, and verification limits. Design-only work does not edit
or execute. Test implementation requires a reviewed and approved design, including any harness or dependency changes.
Reuse the feature plan's approval when it already covers this work.

## Design the evidence

1. Inspect the feature contract, existing suites, manifests, installed tools, configuration, CI, and run instructions.
   Reuse the existing runner and fixtures. Do not assume a browser application or select a framework without evidence.
2. Trace the actual user or system entry point through the components needed to produce the outcome.
   State the boundary being verified: for example browser through API and persistence, CLI through saved state, or
   request through worker completion. An in-process handler test does not prove deployment or transport behavior.
3. Define a small set of independent journeys from requirements. For each, identify the actor, initial state, action,
   observable outcome, credible failure, existing coverage, and risk requiring this level of execution.
4. Cover the important success path and consequential failure or recovery paths. Consider authorization, invalid input,
   persistence, retries, duplicate delivery, and asynchronous completion only where the feature makes them relevant.
   Keep detailed permutations at lower levels when they add no new integration evidence.
5. Map each journey to real components, substituted external dependencies, fixtures, isolated resources, target files,
   setup and cleanup, execution command, and remaining gaps. State the source of expected outcomes.
6. Include required application startup, readiness, service versions, migrations, and CI discovery in the design.
   Identify missing capabilities without silently adding dependencies or expanding infrastructure work.
   Honor approved exclusions, report their effect, and continue independently verifiable work within scope.

For new behavior or bug fixes, combine this design with `test-first`.
For established behavior, use `verification-tests` for the broader baseline and label characterization assumptions.
These procedures share a coverage map. Do not create competing plans or duplicate tests for the same claim.

## Exercise the application

- Invoke the supported entry point. Use the real browser, launched command, network endpoint, or worker path needed
  by the stated claim. Keep the owned application components on that path real.
- Seed only prerequisite state. Let the application perform the action being tested. Do not write the expected final
  database row, inject the completion event, or stub the success response that the journey claims to verify.
- Assert the resulting behavior, not merely navigation, a process starting, a success status, or a mock invocation.
  Observe persisted state through a fresh read or process when persistence is part of the contract.
  For denied operations, check both the intended denial and relevant absence of side effects.
- Keep the relevant guards reachable. A test of object ownership must use an authenticated actor who reaches the
  ownership check. An expired token cannot establish ownership enforcement.
- Substitute uncontrolled third parties at an explicit external boundary when necessary. Report which real provider
  interactions remain unverified. Mocking the application's own API makes a browser test partial frontend coverage.
  Do not describe it as evidence for the full application path.
- Use disposable synthetic accounts and data with per-test or per-worker isolation. Avoid order-dependent tests,
  shared mutable fixtures, production resources, personal credentials, and unintended external effects.
  Stop owned processes and remove resources after success or failure without deleting another test's state.
- For browser tests, prefer accessible roles, names, labels, or established stable test identifiers over DOM structure.
  Use the runner's waiting assertions or bounded polling of meaningful conditions instead of fixed sleeps.
  Await asynchronous outcomes before asserting their effects. Apply bounded readiness and operation timeouts.
- Capture useful diagnostics with the existing runner, such as exit output, server logs, traces, or screenshots.
  Keep secrets and personal data out of artifacts. Reuse simple helpers for repeated setup without hiding assertions.

## Demonstrate and report

For a new behavior or bug, observe the intended failure before implementation when execution is available, then rerun
the same test after the change. A missing service, syntax error, or unrelated guard failure is not regression proof.
If the harness cannot yet execute, report that limit and establish meaningful failure evidence as soon as it can.
Do not reconstruct an unobserved failure. Existing-behavior baselines can pass on their first run.

Run the focused journeys and relevant adjacent tests using `verify`. Confirm that the expected tests were collected
and that the configured command or CI job discovers them. Check isolation or repeatability when there is a concrete
risk. Do not add retry loops, unconditional waits, or optional assertions to hide failures.
Record failures that pass only on retry and their unresolved reliability implications.

Return the coverage map, real and substituted boundaries, commands, source state, results, and remaining gaps.
Separate authored tests from executed proof. Unavailable integrations and approved exclusions do not count as passes.
Update the project's existing test instructions with necessary setup, execution, and cleanup details.
Use `@agent-prompts/response-formats/plan.md` for design and
`@agent-prompts/response-formats/implementation.md` for implementation.
Use `@agent-prompts/response-formats/research.md` for execution-only assignments.
Do not apply repairs during verification.
