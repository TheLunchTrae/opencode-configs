# Usage guide

Use this guide to choose commands and skills for work in an existing project.
For installation, configuration, and the full command list, see the [README](README.md).

## Contents

- [Start a task](#start-a-task): commands, skills, and useful prompt details.
- [Choose a starting point](#choose-a-starting-point): select a route for your task.
- [Worked examples](#worked-examples): prompts and expected results for common changes.
- [Inspect, review, and finish](#inspect-review-and-finish): understand code and check a change.
- [Pause and resume](#pause-and-resume): continue work across sessions.
- [Further reference](#further-reference): source procedures and OpenCode documentation.

## Start a task

After setup, start OpenCode from the project you want to change and confirm that `lead` is active.
Enter the examples in OpenCode chat. Each code block is a separate message.
The examples describe hypothetical project features; replace their details with your actual requirements.

| Tool | How to use it |
| --- | --- |
| Command | Enter a slash command, such as `/workflow`, followed by the task description. |
| Skill | Ask for a named procedure, such as `test-first`, in your prompt. The agent loads it when needed. |
| Agent | Let `lead` select the specialist for the task. Command definitions can also select a specialist. |

The files in [commands/](commands/) define the custom slash commands.
The procedures in [skills/](skills/) support those commands and other agent work.
A skill name does not by itself define a slash command.

Use `/workflow` when you want the agent to take a task through planning, implementation, review, and verification.
It selects the necessary supporting procedures. You do not need to invoke every planning and review command yourself.
For substantial changes, review the proposed plan and approve it before implementation starts.
Trivial corrections use a shorter process. Project instructions and tool permissions still apply.

Use `/spec`, `/design`, or `/plan` when you want to examine requirements or an approach before implementation.
These commands return their findings without implementing the change.
When ready, return to `/workflow` in the same lead session and refer to those findings.
The lead checks the plan, required reviews, and existing approval before continuing.

Give the agent these details when available:

- The result you want and a concrete example of correct behavior.
- The feature or files in scope, with actual paths when known.
- Behavior that must remain unchanged, including error cases and public interfaces.
- Relevant constraints, such as compatibility, dependencies, or rollout requirements.
- Existing test commands or a reproducible failure.

You can describe a feature without knowing its file paths. Ask the agent to locate and inspect the implementation.

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
There is no need for a separate requirements interview when the behavior is already clear.

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
The specification stays in the conversation unless you authorize saving it.

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
For example, send this message to the lead if the project has no suitable test setup:

```text
Use the project-standards skill to propose a test setup for this project.
Inspect the current stack and conventions first. Explain the target files, dependencies, and commands for approval.
```

Ordinary test authoring can use the current tools without a standards-adoption task.

## Inspect, review, and finish

### Understand the code before changing it

```text
/explain Trace how a report request reaches the exporter, including validation, data ownership, and failure handling.
```

Expect an explanation tied to actual source paths, with unknowns identified.
For optional learning questions, follow it with:

```text
/quiz The report-export path we just reviewed, especially its failure handling and data ownership.
```

The agent waits for your answers before explaining them. Quiz results are a learning aid.

### Select the check you need

| Command | Use it when you want to... |
| --- | --- |
| `/code-review` | Review staged and unstaged changes, or pass an explicit target. |
| `/review <target>` | Review a specified feature, file, or change. It asks for scope if none is supplied. |
| `/security-review` | Inspect security concerns in local changes, or pass an explicit target. |
| `/go-review` | Request a Go-specific review of local changes or an explicit target. |
| `/verify` | Run configured project checks and report results without applying fixes. |
| `/finish` | Collect final checks, applicable reviews, blockers, and readiness evidence. |
| `/update-docs <scope>` | Update the requested documentation from the current source. |

Standalone reviews return findings. Ask the lead to address findings when you want implementation work to follow.
The normal `/workflow` process already includes applicable reviews and final verification.
Use a standalone command when you need that step independently or the relevant source has changed.

For example, after making changes outside the workflow:

```text
/finish Check the report-export changes against the agreed behavior and collect the applicable reviews.
```

Read the reported checks and limitations. `PASS` means a check ran successfully on the stated source.
`FAIL` means it ran and found a failure. `BLOCKED` means it could not complete.
`SKIP` means the check does not apply or is not configured.
Local results do not establish CI success, and review findings alone do not establish merge readiness.

### Commit and push when ready

`/finish` ends with a handoff.
Commits, pushes, pull requests, merges, and deployments need authorization for each action.
When you want to commit, name the files or scope you intend to include:

```text
/commit Commit only the report-export implementation, tests, and related documentation from this task.
```

After confirming the commit and branch, you can request:

```text
/push
```

These requests authorize their stated actions, subject to project rules and tool permissions.
Keep task notes and checkpoints out of commits unless you explicitly authorize their inclusion.
Use `/summarize-branch` when you want a summary of branch changes before preparing a pull request.

## Pause and resume

For work that spans sessions, save a task handoff in the work project:

```text
/checkpoint report-export
```

This request authorizes a new checkpoint. The agent confirms the destination and preserves unrelated notes.
Use the exact handoff path returned by that command when you resume:

```text
/resume-work <handoff-path-returned-by-checkpoint>
```

Replace the placeholder with the actual path. The lead checks current source, instructions, evidence, and authorization
before continuing. Changed inputs can make earlier checks or reviews stale.
The built-in `/resume` selects an OpenCode session; `/resume-work` reads a project handoff.
For short tasks, the current conversation may contain all the context you need.

## Further reference

- [Lead workflow](agents/lead.md) and [planner procedure](agents/planner.md).
- [Command definitions](commands/) and [skill definitions](skills/).
- [Test-first](skills/test-first/SKILL.md) and [measured-performance](skills/measured-performance/SKILL.md).
- [Verification](skills/verify/SKILL.md) and [finish](skills/finish/SKILL.md).
- OpenCode documentation for [commands](https://opencode.ai/docs/commands/)
  and [skills](https://opencode.ai/docs/skills/).

These examples follow this repository's current configuration. Use the README's setup and compatibility guidance
for your installed OpenCode version.
