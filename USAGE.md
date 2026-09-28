# Usage guide

Use `/workflow [task]` for guided development work. The lead selects the relevant skills and coordinates each stage.
This guide explains that workflow, focused commands, and the evidence to expect from common tasks.

## Contents

- [Run a complete workflow](#run-a-complete-workflow): start once, answer questions, and approve the plan.
- [Command reference](#command-reference): find the available entry points.
- [Supporting skills](#supporting-skills): understand automatic selection and request a procedure by name.
- [Choose the development route](#choose-the-development-route): request a focused planning step when useful.
- [Choose a starting point](#choose-a-starting-point): select a route for your task.
- [Worked examples](#worked-examples): prompts and expected results for common changes.
- [Verification tests](#verification-tests-for-existing-code): build and reuse a baseline for existing behavior.
- [Combine supporting commands](#combine-supporting-commands): understand code, check progress, and finish a change.
- [Continue a long task](#continue-a-long-task): preserve decisions and evidence between work sessions.

## Run a complete workflow

Describe the task once. Include known constraints and acceptance examples; leave uncertain decisions for discussion.

```text
/workflow Add background report exports. Help me decide access rules, retries, and retention.
```

You can also start with `/workflow` alone. The lead uses an established task from the conversation, or asks what you
want to accomplish if there is none. `[task]` means optional free-form text; do not type the brackets.

The lead coordinates the applicable stages in order:

| Stage | What happens |
| --- | --- |
| Inspect and clarify | Read source and prior decisions; use `spec-interview` for consequential missing requirements. |
| Design and plan | Select planning support; compare consequential alternatives and use `phased-plan` when needed. |
| Review and approve | Review the design, resolve blocking findings, and request approval for implementation. |
| Implement | Assign specialists and relevant skills; include affected documentation within the approved scope. |
| Review and verify | Review changes and use `finish` with `verify`; refresh affected evidence after approved repairs. |
| Hand off | Report changed behavior, checks, review findings, unresolved gaps, and the next action. |

Answer questions and give approval in the same conversation. You can approve the plan, request changes or alternatives,
or cancel. Approval covers its stated scope. The lead continues between stages without asking you to run another
command. Existing decisions and valid approvals carry forward; a material scope change needs renewed review and
approval. Missing access, exhausted repair budgets, and other blockers can also require a pause.

The route depends on the task. A known bug does not need a requirements interview, and a small correction does not
need every planning step. The lead selects `test-first` for testable behavior changes, characterization evidence for
refactors, `verification-tests` for baseline coverage, and `measured-performance` for performance work.
You do not need to name those skills. Existing tests and sufficient current reviews are reused.

You can state a stopping point in the request, such as "design only" or "implement only phase 1 after approval."
The lead respects that boundary. Standalone `/plan`, `/design`, and `/verify` retain their read-only scope.
Verification reports distinguish checks that passed, failed, were blocked, or were skipped.
Commits, pushes, pull requests, merges, deployments, and other shipping actions need authorization for that action.
Saving or committing task-process files also needs authorization.

## Command reference

Use the focused commands when you want a particular result without starting a complete development task.
The placeholders describe task text; replace them with your scope. Square brackets indicate optional text.

| Command | Purpose |
| --- | --- |
| `/workflow [task]` | Guide clarification, planning, approved implementation, docs, reviews, and verification. |
| `/spec <feature>` | Clarify requirements and return a specification without implementation. |
| `/plan <task>` | Produce a read-only implementation plan. |
| `/phased-plan <task>` | Plan a phased rollout and rollback when requested or needed. |
| `/design <problem>` | Compare architecture and design alternatives without implementation. |
| `/verification-tests [scope]` | Design and generate verification tests for established repository behavior. |
| `/verify` | Run available project checks and report results without fixes. |
| `/finish` | Collect final verification and reviews without committing or publishing. |
| `/checkpoint <task-id>` | Save a handoff in the current work project. |
| `/resume-work <handoff-path>` | Resume from a handoff after checking saved state. |
| `/explain <feature>` | Explain the current implementation from source. |
| `/quiz <topic>` | Ask optional questions about the code and wait for answers. |
| `/review <target>` | Review the requested scope; ask when it is unclear. |
| `/code-review [target]` | Review code; default to local changes. |
| `/security-review [target]` | Review security risks; default to local changes. |
| `/go-review [target]` | Review Go code; default to local changes. |
| `/refactor-clean <scope>` | Find and remove verified dead code and duplicates. |
| `/update-docs <scope>` | Update documentation from current code. |
| `/commit` | Stage and commit authorized changes with secret checks. |
| `/push` | Push the current branch with authorization. |
| `/summarize-branch` | Summarize branch commits before a pull request. |

See the [command definitions](commands/) for routing and prompts.
`/resume-work` reads a project handoff. The built-in `/resume` selects an OpenCode session.
Checkpoints stay in the work project. Learning questions and quiz scores are optional.

## Supporting skills

Skills provide procedures for the lead and its specialists. The lead selects them as needed, and the owning agent
loads each skill for its assignment. You can also request a skill by name to emphasize a particular procedure.
Naming a skill does not expand the agent's permissions or bypass planning and approval.

| Skill | Purpose |
| --- | --- |
| [development-workflow](skills/development-workflow/SKILL.md) | Start the lead's development workflow. |
| [spec-interview](skills/spec-interview/SKILL.md) | Resolve consequential requirements before planning. |
| [plan](skills/plan/SKILL.md) | Prepare the implementation plan through the planner. |
| [phased-plan](skills/phased-plan/SKILL.md) | Add compatibility, phase checks, and rollback analysis when needed. |
| [test-first](skills/test-first/SKILL.md) | Observe a behavioral test fail, implement the change, and verify it. |
| [verification-tests](skills/verification-tests/SKILL.md) | Build reusable coverage for established behavior. |
| [measured-performance](skills/measured-performance/SKILL.md) | Compare performance under matching conditions. |
| [verify](skills/verify/SKILL.md) | Run configured checks and report source-linked evidence without fixes. |
| [review](skills/review/SKILL.md) | Apply the selected reviewer's specialty and reporting rules. |
| [security-review](skills/security-review/SKILL.md) | Review current changes or a specified security scope. |
| [finish](skills/finish/SKILL.md) | Collect final verification, applicable reviews, and handoff evidence. |
| [checkpoint](skills/checkpoint/SKILL.md) | Save or resume an authorized task handoff. |
| [code-learning](skills/code-learning/SKILL.md) | Explain source behavior and optionally ask learning questions. |
| [project-standards](skills/project-standards/SKILL.md) | Propose deliberate convention, tooling, or CI changes. |
| [commit](skills/commit/SKILL.md) | Stage, inspect, and commit authorized changes. |
| [push](skills/push/SKILL.md) | Push an authorized branch. |

`project-standards` is for deliberate tooling changes. Routine tests, verification, and fixes do not need that skill.
The examples below sometimes name skills to show the intended evidence. Those names are optional with `/workflow`.

## Choose the development route

`/workflow` handles the planning steps needed for the task, including clarification when the outcome is incomplete.
Provide observable acceptance examples and behavior that must remain unchanged when you know them.
The lead helps resolve missing decisions before implementation.

Use a separate planning command when you want to settle a specific decision before implementation:

| Decision to settle | Command | Useful result |
| --- | --- | --- |
| What should the feature do? | `/spec` | Confirmed requirements, edge cases, and acceptance examples. |
| Which approach fits the project? | `/design` | Alternatives, tradeoffs, and a recommended design. |
| What will implementation change? | `/plan` | File scope, ordered work, preserved behavior, and planned checks. |
| How can the change roll out safely? | `/phased-plan` | Compatibility, phase checks, and rollback limits. |

These are optional entry points. You do not need to invoke them in sequence before `/workflow`.
A complex feature does not automatically need all four commands or a phased rollout.
When starting `/workflow` after focused planning, reference the decisions already made so the lead can reuse them.
Substantial implementation follows a reviewed plan and user approval; trivial corrections use a shorter process.

## Choose a starting point

| Task | Start with |
| --- | --- |
| [Small feature](#small-feature) | `/workflow` with acceptance examples. |
| [Complex feature](#complex-feature) | `/workflow`; the lead asks about consequential missing requirements. |
| [Staged migration](#staged-migration) | `/workflow` with deployment constraints and the phase scope. |
| [Refactor](#refactor) | `/workflow` with explicit behavior to preserve. |
| [Unused-code cleanup](#unused-code-cleanup) | `/workflow`, or `/refactor-clean` for a focused cleanup. |
| [Bug fix](#bug-fix) | `/workflow` with a reproduction and expected behavior. |
| [Performance improvement](#performance-improvement) | `/workflow` with the slow operation and relevant workload. |
| [Verification baseline](#verification-tests-for-existing-code) | `/workflow` or `/verification-tests [scope]`. |

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
Start the workflow with the known outcome and the decisions you need help making:

```text
/workflow Add background report exports to the existing application.
Users should request an export, check its progress, and download the result when ready.
Help me decide access rules, cancellation, retries, retention, and behavior after a worker restart.
Inspect the existing report and job infrastructure before asking questions.
If the infrastructure choice matters, compare extending our current job runner with a separate worker.
Explain ownership, failure recovery, operational cost, and tradeoffs before recommending a design.
```

The lead uses `spec-interview` for unresolved requirements and architectural assistance for consequential alternatives.
Answer the questions in the same conversation. The lead carries confirmed decisions into planning and design review,
then presents the plan for approval. It coordinates implementation, documentation, reviews, and verification afterward.
You do not need separate `/spec`, `/design`, or `/finish` commands. Complexity alone does not require a staged rollout.

Use `/spec` or `/design` separately when you want to end with those results before deciding whether to implement.

### Staged migration

Describe deployment constraints when a migration must preserve compatibility across independently released components.
For example, an API field may need to coexist with its replacement while consumers upgrade.

```text
/workflow Replace the existing report status field with a structured status object.
The API and its consumers deploy independently. Keep existing consumers working during the transition.
Include compatibility checks, removal criteria, and rollback limits for each phase.
Plan the full migration, but implement only phase 1 after I approve it. Leave later phases out of scope.
```

The lead has the planner load `phased-plan`. Expect independently usable phases with conditions for advancing or
rolling back. Review and approve the first phase in the same conversation. The lead implements, reviews, and verifies
only that phase, then hands off its results. Later phases require authorization for their scope.
Use `/phased-plan` separately when you want the rollout plan without implementation.

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

Use `/workflow` to coordinate cleanup through final verification. Use `/refactor-clean` for a focused cleanup of
unused code, unused dependencies, or duplicate logic within a defined scope.
The focused command can edit files, so supply the removal boundaries in the request.

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
Starting the same task with `/workflow` includes those final steps automatically.

### Bug fix

Provide the failure, the expected result, and any known reproduction.
The lead selects `test-first` when the existing test setup can exercise the behavior.
You can name the skill explicitly, as in this example, but the workflow does not require it.

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
The lead selects `measured-performance` for this route; naming the skill in the prompt is optional.

```text
/workflow Investigate and improve report generation for a large local fixture dataset.
Use the measured-performance skill. Record a repeatable baseline before selecting a bottleneck to change.
Preserve report contents and ordering. Compare elapsed time and peak memory under matching conditions afterward.
```

The lead routes the work to the appropriate specialist.
Expect the measurement command, workload, environment, baseline, candidate result, and measurement limitations.
If the agent cannot run a safe measurement, the useful result is a measurement plan with an explicit blocker.

### Verification tests for existing code

Use `/verification-tests [scope]` to design and generate reusable tests for established repository behavior.
Describing the same baseline task to `/workflow` selects this procedure automatically.
Generated tests and run instructions belong in the repository being verified.
The [command](commands/verification-tests.md) uses the [verification-tests skill](skills/verification-tests/SKILL.md).
It follows the lead's planning, approval, implementation, and review process.

#### When to use it

Use this command when an existing feature has little coverage, a workflow is difficult to test, or a refactor needs
a baseline. The suite can include unit, integration, contract, CLI, API, or end-to-end tests.
The agent selects test types from the behavior and boundaries you need to verify.

| Your goal | Use |
| --- | --- |
| Add reusable coverage for established behavior. | `/verification-tests [scope]`. |
| Run existing checks against the current source. | `/verify`. |
| Implement a new behavior or fix a defect. | `/workflow` with `test-first` when a test seam is available. |

Baseline tests can pass on their first run. They do not need an artificial failure before they can be useful.
Characterization tests record observed behavior when its intended contract is unconfirmed.
Review surprising behavior before accepting it as a requirement; an existing result can be defective.

#### Choose a scope

`[scope]` means optional free-form task text. Replace the placeholder with a capability, module, workflow, or repository
scope. You can include requirements and constraints in the same message; special flags are unnecessary.
Provide known interfaces, examples, test commands, environment limits, and behavior that must remain unchanged.

For example, suppose a CLI has a documented configuration contract:

```text
/verification-tests The existing CLI configuration loading and error handling.
Use the documented configuration precedence and validation rules as the expected behavior.
Cover valid files, missing optional files, malformed input, exit codes, and user-visible error output.
Reuse the current test runner and exercise the real CLI where process behavior matters.
Preserve application behavior. Include isolated fixtures, cleanup, and repeatable run instructions.
```

The expected result is a reviewed coverage design followed by tests and execution instructions for that scope.
Existing tests should be reused where their assertions already establish the required behavior.

If you do not know where to start, omit the scope:

```text
/verification-tests
```

The lead inspects the repository and proposes coverage before generating tests.
For an explicit repository-wide request, ask it to map important workflows and order work by risk.
Review the proposed coverage and exclusions. A repository-wide request does not guarantee that every path is tested.

#### Request a design before generating tests

Use a design-only request when the scope, test boundaries, or environment costs need review:

```text
/verification-tests Design only: a verification suite for the existing report-export workflow.
Inspect requirements, public interfaces, current tests, and available infrastructure.
Map expected results to existing coverage and proposed cases. Identify fixtures, setup, cleanup, and run commands.
Explain assumptions, missing infrastructure, and behavior that will remain unverified. Do not generate files.
```

This request ends with the reviewed design. To continue in the same lead session, approve a concrete scope:

```text
Implement the verification-test design above for the report-export workflow.
The listed tests, fixtures, and run documentation are approved. Preserve application behavior.
```

For a normal generation request, the lead presents the design through its usual approval process.
Review the expected behavior, target files, prerequisites, commands, and exclusions before approving.
Approval already given for that scope remains valid.

#### Handle complex or missing infrastructure

Describe the real boundary you need to test. For example, database behavior can require persisted-state assertions
and transaction checks that a mocked database cannot establish:

```text
/verification-tests The existing database import workflow.
Use the documented import and transaction contracts. Cover valid imports, invalid records, duplicates, and rollback.
Check persisted state through the real database boundary using synthetic data and isolated test resources.
Inspect our current fixtures and setup first. Include bounded waits, cleanup after failures, and run instructions.
If the database environment is unavailable, identify the blocked cases and the setup required to execute them.
```

If no suitable harness exists, the design proposes the smallest setup for the project's language and tools.
New dependencies, CI changes, and testability refactors must be listed in the approved scope.
Use `project-standards` when you deliberately want broader changes to test tooling or conventions.
Routine test authoring does not need a separate standards task.

The agent can still design coverage and generate approved tests when execution is unavailable.
The result must distinguish executable checks that ran from tests that remain unverified.
A mocked dependency does not prove that the real integration works.

#### Read the result

Expect these outputs for the agreed scope:

- A coverage map with expected behavior, its source, reused tests, new cases, and remaining gaps.
- Test files, necessary fixtures, and helpers that follow the repository's conventions.
- Setup, configuration, run commands, and cleanup instructions in the project's test documentation.
- Actual execution results tied to the source state, with failures and environment limits explained.

Requirements and public contracts should determine expected values independently of the implementation.
When a correct test exposes an existing defect, the result remains a failure. Request a separate fix when needed.
Missing services, skipped checks, and zero expected tests collected do not establish a passing baseline.
Read the [verification result statuses](skills/verify/SKILL.md#results) before treating a suite as ready for reuse.

#### Reuse the suite for later changes

The generated tests use the project's test tools. Run the documented commands directly, through existing CI,
or ask `/verify` to use the suite for current changes:

```text
/verify Check the current CLI configuration changes against the existing verification suite.
Map changed behavior and affected integrations to the actual assertions. Run the relevant checks on this source state.
Report uncovered behavior, stale expectations, and unavailable integration checks separately from test results.
```

A passing run can serve as verification for changed functionality when the assertions cover its intended behavior
and affected boundaries. An earlier passing run is not evidence for a later source state or different environment.

`/verify` runs checks and reports gaps.
Ask the lead for a test-generation task when existing behavior needs more coverage.
Use `test-first` as part of implementation when adding new behavior or fixing a bug.
Change test expectations only for a reviewed requirement change; a changed implementation alone is insufficient.

#### Request the skill directly

You can also name the skill in an ordinary message to the lead:

```text
Use the verification-tests skill to establish a baseline for the existing report-export workflow.
Reuse our current tests and tooling. Propose coverage for missing behavior and document how to rerun the suite.
```

The slash command is a convenient entry point to the same procedure.
Specialists can use the skill within their assigned scope. Naming it does not expand their permissions or assignment.

## Combine supporting commands

### Investigate before planning a change

The workflow inspects the relevant source as part of the task. Use `/explain` separately when you want to understand
an unfamiliar code path or a safeguard before deciding to change it.
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

`/workflow` coordinates documentation updates within the approved scope before its final checks.
Use `/update-docs` separately for documentation changes outside that workflow:

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
