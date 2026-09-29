# Testing standards

Apply these standards when planning, writing, reviewing, or removing tests. Follow applicable project and language
rules. Keep the work within the assigned scope, permissions, and approved verification boundaries.
Read `@agent-prompts/verification-scope.md` before applying these standards. Honor its separate limits on discovery,
test generation, execution, and infrastructure changes throughout the work.

## Decide what evidence is needed

For each proposed test or material test change, identify:

- The observable behavior or independently defined contract, and the source of its expected result.
- A plausible defect that the assertions would detect. Check that failure would occur for the intended reason.
- The gap in existing coverage. Reuse or extend sufficient tests before adding another case or test layer.
- The real entry point and dependencies needed to observe that defect, including any limits introduced by substitutes.

Use the least costly level that can prove the claim. Unit checks can cover detailed rules, integration checks can
cover collaborating components, and end-to-end checks can cover complete journeys through the application.
Do not repeat every case at every level. Explain the distinct risk when more than one level covers related behavior.
Load `end-to-end-tests` when a changed user journey or integration risk needs coverage through the application.
Do not require an end-to-end test for every small edit or an arbitrary coverage percentage.

Prefer public behavior and established interfaces. Do not expose private functions or add runtime flags solely to
make incidental implementation details testable. Propose a necessary testability change explicitly and preserve
production contracts. A legitimate dependency boundary or stable test identifier is not inherently a bad test seam.

Honor explicit exclusions and verification limits approved for the task. Keep their consequences visible in the
coverage map and handoff. Do not invent infrastructure work to satisfy a checklist or report excluded checks as passed.

## Inspect the test's claim

Use independent expectations from requirements, public contracts, approved examples, or reference data.
If observed behavior is the only authority, label it characterization and question suspected defects.
For feature and bug changes, use `test-first` for meaningful failure and passing evidence when execution is available.
Existing-behavior baselines can pass immediately. Do not manufacture a failure or weaken an assertion to claim success.

Inspect for these failure modes:

- Assertions merely repeat inputs, constants, file inventories, or the algorithm that produced the actual value.
- The expected result comes from the same implementation being checked, including unreviewed snapshots.
- Mocks or fixtures supply the behavior that the application was supposed to perform.
- A negative case fails at an earlier guard, so it never reaches the rule named by the test.
- Private call shapes, source spellings, or setup details fail after a change that preserves the contract.
- Repeated cases protect the same failure without adding a distinct boundary or lifecycle risk.
- A check passes without observing an outcome, such as optional assertions, swallowed failures, or no collected cases.
- The name or claimed coverage exceeds the input, execution path, or assertions actually exercised.

Treat these as investigation signals for existing tests, not automatic deletion rules. For new tests, resolve the
problem or identify the independent contract before accepting the test.
Static checks, exact bytes, call order, snapshots, exports, and inventories can be the contract for protocols,
configuration, compatibility, security, packaging, generated artifacts, or migrations. Judge their actual failure
mode and consumer. Preserve a useful contract even when its cheapest independent check inspects source.
Slowness, age, test count, or resemblance to implementation alone does not justify removal.

## Keep evidence trustworthy

Keep the application behavior under test real. Substitute only dependencies outside the claimed boundary and state
what the substitutes cannot establish. A mocked service response does not prove that service's integration works.
Use isolated synthetic data, controlled nondeterminism, bounded synchronization, and cleanup after failures.
Do not add retries or broad tolerances to conceal flaky assertions. Report initial failures and retry results.

When a correct test fails, investigate the product, fixture, and environment separately. Do not delete the test,
skip its assertions, or approve a new snapshot merely to obtain a passing run.
Use `verify` for source-linked execution evidence. Distinguish generated tests, inspected code, and checks actually run.
Keep missing infrastructure, approved exclusions, and uncovered behavior separate from passing results.

Use `test-audit` for an explicit assessment or cleanup of existing suites. Keep ordinary feature reviews within
their requested scope. Do not turn a test-quality observation into an unrequested repository-wide audit.
