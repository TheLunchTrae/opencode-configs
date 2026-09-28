# Usage guide

Use this guide to choose and combine this configuration's commands and skills for development work.
The examples cover common tasks in an existing project and the evidence to expect from each approach.

## Contents

- [Choose the development route](#choose-the-development-route): decide how much planning the task needs.
- [Choose a starting point](#choose-a-starting-point): select a route for your task.
- [Worked examples](#worked-examples): prompts and expected results for common changes.
- [Combine supporting commands](#combine-supporting-commands): understand code, check progress, and finish a change.
- [Continue a long task](#continue-a-long-task): preserve decisions and evidence between work sessions.

## Choose the development route

Use `/workflow` as the default for a development task with a clear outcome.
The lead coordinates planning, implementation, specialist reviews, and final verification.
Start with observable acceptance examples and the behavior that must remain unchanged.
This gives the planner and reviewers a shared basis for judging the result.

Use a separate planning command when you want to settle a specific decision before implementation:

| Decision to settle | Command | Useful result |
| --- | --- | --- |
| What should the feature do? | `/spec` | Confirmed requirements, edge cases, and acceptance examples. |
| Which approach fits the project? | `/design` | Alternatives, tradeoffs, and a recommended design. |
| What will implementation change? | `/plan` | File scope, ordered work, preserved behavior, and planned checks. |
| How can the change roll out safely? | `/phased-plan` | Compatibility, phase checks, and rollback limits. |

Use only the planning steps that resolve an actual uncertainty. A defined feature can go directly to `/workflow`.
A complex feature does not automatically need all four commands or a phased rollout.
When you return to `/workflow`, reference the decisions already made so the lead can reuse them.
Substantial implementation follows a reviewed plan and user approval; trivial corrections use a shorter process.

## Choose a starting point

| Task | Start with |
| --- | --- |
| [Small feature](#small-feature) | `/workflow` with acceptance examples. |
| [Complex feature](#complex-feature) | `/spec` for unclear requirements; `/workflow` when requirements are clear. |
| [Staged migration](#staged-migration) | `/phased-plan` when deployment or compatibility requires stages. |
| [Refactor](#refactor) | `/workflow` with explicit behavior to preserve. |
| [Unused-code cleanup](#unused-code-cleanup) | `/refactor-clean` with a bounded removal scope. |
| [Bug fix](#bug-fix) | `/workflow` with a reproduction and `test-first`. |
| [Performance improvement](#performance-improvement) | `/workflow` with `measured-performance`. |
| [Verification tests for existing code](#verification-tests-for-existing-code) | `/workflow` scoped to tests. |

## Worked examples

### Small feature

Suppose an existing CLI lists records as a table. You want an optional JSON output format.

```text
/workflow Add a --json option to the existing list command.
Keep the current table output as the default. With --json, return an array of the listed records.
An empty result must produce []. Preserve existing filtering and exit codes.
Use the existing test tools and the test-first skill for the new behavior.
```

The expected result is a small plan, tests for the new option, and a change that preserves default output.
After you approve the plan, the lead coordinates implementation and the applicable reviews and checks.
`test-first` makes the acceptance examples executable before the implementation changes.

If you only want the plan, use `/plan` with the same task description.

### Complex feature

Suppose users need to export large reports in the background, but access rules and failure behavior are undecided.
Start with the questions that affect the design:

```text
/spec Add background report exports to the existing application.
Users should request an export, check its progress, and download the result when ready.
Help me decide access rules, cancellation, retries, retention, and behavior after a worker restart.
Inspect the existing report and job infrastructure before asking questions.
```

The expected result is a specification with confirmed decisions, acceptance examples, and unresolved questions.

If a consequential design choice remains, compare the options:

```text
/design For the report-export specification above, compare extending our current job runner with a separate worker.
Use the actual project infrastructure. Explain ownership, failure recovery, operational cost, and tradeoffs.
```

When the requirements and approach are settled, request implementation:

```text
/workflow Implement the report-export feature from the specification and chosen design above.
Reuse the confirmed decisions. Plan observable acceptance cases and identify affected interfaces and checks.
```

Review and approve the implementation plan. The lead selects the relevant developers and reviewers.
Use `/workflow` directly if you already know the requirements; it can request the planning support the task needs.
Complexity alone does not require a staged rollout.

### Staged migration

Use a phased plan when deployment must preserve compatibility across independently released components.
For example, an API field may need to coexist with its replacement while consumers upgrade.

```text
/phased-plan Replace the existing report status field with a structured status object.
The API and its consumers deploy independently. Keep existing consumers working during the transition.
Include compatibility checks, removal criteria, and rollback limits for each phase.
```

The expected result is a plan with independently usable phases and clear conditions for advancing or rolling back.
The command does not implement the migration.

To implement only the first phase after its plan is reviewed and approved:

```text
/workflow Implement only phase 1 of the approved report-status migration plan above.
Keep later phases out of scope. Reuse the phase acceptance criteria and rollback constraints.
```

### Refactor

Use `/workflow` to change structure while preserving behavior.
State which outputs, side effects, and compatibility guarantees must remain the same.

```text
/workflow Separate report input validation from report generation.
Preserve accepted inputs, validation messages, output ordering, side effects, and public interfaces.
Inspect existing tests and add characterization tests for important uncovered behavior before changing structure.
Use the smallest coherent scope. Keep unrelated cleanup out of this change.
```

Characterization tests record agreed existing behavior. They should pass before and after a pure refactor.
Review surprising behavior before preserving it in a test; observed behavior can include a defect.
The expected result is clearer structure with evidence that the agreed behavior remains unchanged.

### Unused-code cleanup

Use `/refactor-clean` for unused code, unused dependencies, or duplicate logic within a defined scope.
This command can edit files, so supply the removal boundaries in the request.

```text
/refactor-clean Remove verified unused internal helpers in the report module.
Preserve public exports and dynamically registered handlers. Leave uncertain candidates for my review.
Run the affected checks between cleanup batches.
```

The cleaner checks references and classifies candidates by risk.
Expect supported safe removals, check results, and a list of uncertain or higher-risk candidates.
Public API removals require explicit authorization covering the removal.

For a read-only assessment before authorizing cleanup, use `/plan` to request a cleanup plan.
Use `/finish` after a standalone cleanup to collect the final checks and applicable reviews.

### Bug fix

Provide the failure, the expected result, and any known reproduction.
Request `test-first` when the existing test setup can exercise the behavior.

```text
/workflow Fix duplicate records when fetching the second page of report results.
Reproduce the overlap with a stable dataset. Adjacent pages must not repeat records under the documented sort order.
Use the test-first skill: observe a regression test fail for this behavior, fix the cause, then rerun relevant tests.
Preserve the public pagination interface.
```

The expected evidence includes the behavioral failure before the fix and passing checks afterward.
A missing dependency or a test syntax error does not demonstrate the defect.
If execution is blocked, the agent should report the missing requirement and which checks remain unrun.

### Performance improvement

Describe the slow operation and the workload that matters. Request a comparable baseline before accepting a speed claim.

```text
/workflow Investigate and improve report generation for a large local fixture dataset.
Use the measured-performance skill. Record a repeatable baseline before selecting a bottleneck to change.
Preserve report contents and ordering. Compare elapsed time and peak memory under matching conditions afterward.
```

The lead routes the work to the appropriate specialist.
Expect the measurement command, workload, environment, baseline, candidate result, and measurement limitations.
If the agent cannot run a safe measurement, the useful result is a measurement plan with an explicit blocker.

### Verification tests for existing code

Use a separate task to establish a reusable test baseline for an existing feature.
Ask the agent to discover the public behavior, fixtures, setup, and test boundaries before proposing cases.

```text
/workflow Design and add verification tests for the existing report-export feature.
This task establishes a baseline for future changes. Preserve application behavior.
Inspect current requirements, interfaces, tests, and test infrastructure before proposing cases.
Cover the main user flow, important failures, and observable side effects with the appropriate test types.
Keep expected results independent of the implementation. Flag ambiguous or apparently defective behavior for review.
Use safe local fixtures. Explain how to run the checks and what they do not cover.
```

Review the proposed cases before approving implementation.
Unit, integration, or end-to-end tests may fit different cases.
The expected result is a runnable baseline with setup instructions, meaningful assertions, and explicit coverage limits.
Tests for unchanged valid behavior can pass from the start. A separate bug fix can require red-to-green evidence.

Future changes can reuse these tests when they cover the changed behavior.
New behavior still needs its own acceptance cases. `/verify` runs available checks; it does not generate these tests.

Use `project-standards` only when you deliberately want to adopt or change test tooling, conventions, or CI.
For a project without a suitable test setup, first request a tooling proposal:

```text
Use the project-standards skill to propose a test setup for this project.
Inspect the current stack and conventions first. Explain the target files, dependencies, and commands for approval.
```

Ordinary test authoring can use the current tools without a standards-adoption task.

## Combine supporting commands

### Investigate before planning a change

Use `/explain` before `/workflow` when you need to understand an unfamiliar code path or a safeguard you plan to change.
Use its source findings to identify behavior that the implementation must preserve.

```text
/explain Trace how a report request reaches the exporter, including validation, data ownership, and failure handling.
```

If the explanation exposes a mechanism you will maintain, use `/quiz` to test your understanding of its failure cases:

```text
/quiz The report-export path we just reviewed, especially its failure handling and data ownership.
```

Use the answers to resolve gaps in your understanding before changing the mechanism.
The implementation still needs its own tests and reviews.

### Check progress or request a focused review

Use `/verify` at a development milestone when you want results from the existing checks without applying fixes.
Use those results to identify the next implementation task.
If the checks do not cover an acceptance case, request the missing test through `/workflow`.

Use a standalone review when you want feedback on a specific concern or on changes made outside `/workflow`:

| Concern | Command |
| --- | --- |
| Correctness or maintainability of local changes | `/code-review` |
| A particular feature, file, or change | `/review <target>` |
| Access control, input handling, or sensitive data | `/security-review <target>` |
| Go-specific correctness and conventions | `/go-review <target>` |

Give the reviewer the intended behavior and the question you want answered.
Bring findings back to the lead for fixes, then repeat the affected checks and reviews.
The normal `/workflow` process already arranges applicable reviews. Reuse current findings for unchanged scope.

### Finish the development task

Use `/update-docs` once the behavior is settled and the change affects user instructions or an interface contract:

```text
/update-docs Update the report-export guide to match the implemented access rules, retries, and failure behavior.
```

Use `/finish` to assess the final change against its acceptance criteria and collect checks and applicable reviews.
This is useful after a standalone cleanup or after changes made outside `/workflow`:

```text
/finish Check the report-export changes against the agreed behavior and collect the applicable reviews.
```

`/workflow` already includes this final handoff. Repeat `/finish` when subsequent changes make the evidence stale.
Use `/summarize-branch` to prepare a review summary of the branch changes.
`/commit` and `/push` remain separate, explicitly authorized steps after the development checks.

## Continue a long task

Use `/checkpoint` when a task has decisions, ownership boundaries, or verification evidence that must survive a handoff.
Useful points include an approved design, a completed migration phase, or a blocker that requires later work.

```text
/checkpoint report-export
```

The checkpoint should capture the approved scope, completed work, current evidence, blockers, and next action.
Resume the task with that handoff:

```text
/resume-work <handoff-path-returned-by-checkpoint>
```

The lead rechecks the source before continuing. Refresh checks and reviews whose inputs have changed.
Keep a checkpoint scoped to the unfinished development work so the next session can resume from a clear decision point.

For the full procedures, see the [lead workflow](agents/lead.md), [command definitions](commands/),
and [skill definitions](skills/).
