# Usage guide

Select a lead and describe the desired outcome in an ordinary message.
The default `workflow-lead` coordinates a complete development task. Focused leads cover individual stages.

## Contents

- [Choose a lead](#choose-a-lead): select the scope and stopping point.
- [Agent groups and models](#agent-groups-and-models): change models, defaults, and group membership in the TUI.
- [Run a complete workflow](#run-a-complete-workflow): start once, resolve questions, and approve the plan.
- [Move between focused stages](#move-between-focused-stages): reuse reviewed plans, approvals, and evidence.
- [Command reference](#command-reference): utility shortcuts and the focused audit command.
- [Supporting skills](#supporting-skills): reusable procedures selected by agents.
- [Worked examples](#worked-examples): common development tasks.
- [Test-suite audits](#audit-existing-test-suites): assess existing coverage and plan justified cleanup.
- [End-to-end tests](#end-to-end-tests-during-feature-development): verify complete application journeys.
- [Verification tests](#verification-tests-for-existing-code): build and reuse coverage for existing behavior.
- [Limit verification](#limit-verification): accept impractical checks without blocking the requested implementation.
- [Continue a long task](#continue-a-long-task): retain decisions and evidence between sessions.

## Choose a lead

Use Tab or the configured agent-switch key to select a primary agent in OpenCode.
Selecting a primary lead changes the active role in the main conversation. An `@` subagent mention starts bounded
specialist work; it does not replace primary lead selection.
See [OpenCode agents](https://opencode.ai/docs/agents/).

| Lead | Scope and result |
| --- | --- |
| `workflow-lead` | Default. Complete development process through reviewed and verified implementation. |
| `planning-lead` | Requirements, design, and reviewed plans. No implementation or test execution. |
| `implementation-lead` | Approved plan through implementation, docs, reviews, and verification. No new design scope. |
| `review-lead` | Reviews or existing checks. Findings and evidence without repairs, generated tests, or shipping. |

The workflow lead directly coordinates specialists. It does not delegate to the focused leads.
All leads use the same applicable stage procedures, approval rules, review standards, and evidence requirements.
Focused leads stop at their boundary even if an adjacent stage becomes useful.

The planning lead cannot edit files or run shell commands. The review lead cannot edit files, but can run requested
checks with ordinary tool approvals. Checks can produce normal build artifacts; verification does not apply repairs.
Neither lead can delegate to writing agents. Configured permissions still apply to every task.

Specialists use [canonical response formats](references/agent-prompts/response-formats/catalog.md) for bounded tasks.
Each response separates task completion, the result, evidence, and unresolved items. A completed task can still report
failed checks or blocking findings. The selected lead validates the evidence and handles follow-up under its own scope.
Specialists receive task inputs and constraints without needing the lead's identity or workflow instructions.

## Agent groups and models

Open the command palette and look under **Config**, or run `/agent-models` and `/agent-groups`.
These are local settings controls. They do not send a prompt to an agent.
The model picker reads the running server's provider catalog, including custom provider models and supported variants.
Connect providers with `/connect` first. Models are checked again before saving.

| Scope in `/agent-models` | Effect |
| --- | --- |
| Global defaults | Change the main or small model. Group defaults and agent pins still take precedence. |
| All defaults | Set the main model, small model, and every group's model. Preserve explicit agent overrides. |
| A group name | Set that group's model and optional variant. Agents without explicit models inherit it. |
| Individual agent overrides | Select an agent to set a model exception, clear its override, or change its group. |

Use `/agent-groups` to create groups, select their defaults, and move agents between them.
The list combines group names in the configuration with `agent_group` values found in agent files.
New groups appear without a code change. Empty configured groups remain available.
Agents without a group appear under **Ungrouped**. Disabled agents are excluded.
Each agent belongs to one group. Moving an agent preserves its explicit model and variant.
Choose **Use group defaults** to clear those overrides and use the new group's settings.
Grouping does not change prompts, permissions, delegation routes, or agent colors.

Review the scope and retained-override count before saving. Saved changes can be applied with **Reload now**,
or left until the next restart. Reload affects every workspace on the same OpenCode server.
Wait for all of their agents to finish first. The editor checks running agents in the current workspace;
it cannot check activity in every other workspace. An existing session model selection can still take precedence.
Use OpenCode's `/models` command when you also want to change the current session's selected model.

### Configure group defaults

Add group defaults to the server plugin's options in `opencode.jsonc`. For example:

```jsonc
"plugin": [
  ["./extensions/agent-groups/server.ts", {
    "groups": {
      "developers": { "model": "provider/model-id", "variant": "medium" },
      "reviewers": { "model": "provider/another-model-id" },
      "research": {}
    }
  }]
]
```

Keep your other plugin entries. Register `./extensions/agent-groups/tui.ts` in the `plugin` array of `tui.jsonc`.
Group names use lowercase letters, digits, and hyphens, start with a letter, and contain at most 64 characters.
Use a model and variant supported by your provider. An empty group object uses OpenCode's normal fallback.

Assign a custom agent in its Markdown frontmatter:

```yaml
---
description: Review implementation changes.
mode: subagent
agent_group: reviewers
---
Review the assigned changes.
```

For a built-in agent, add `"agent_group": "reviewers"` to its entry under `agent` in `opencode.jsonc`.
Membership is real configuration metadata. The server plugin consumes it and removes `agent_group` from
request options before provider dispatch.

An explicit agent `model` takes precedence over the group model and prevents inheritance of the group's variant.
With no explicit model, the agent inherits the group model and uses its own `variant` if present, then the group's.
With neither an agent model nor a group model, OpenCode applies its normal global or parent-model fallback.
Project configuration and session selections retain OpenCode's normal precedence.
Groups therefore let new agents inherit defaults without adding a model to every file.

### Editing and compatibility

The editor manages this installation's global `opencode.jsonc` or `opencode.json` and its `agents/` or `agent/` files.
Run it where the TUI and server share the same global configuration filesystem. Remote configuration editing and
project-local agent editing are not supported. The editor rejects ambiguous duplicate files, agent symlinks,
invalid configuration, and settings that changed after a dialog opened.
Merge legacy `config.json` settings into `opencode.jsonc` before using the editor.
An installation in a separate `OPENCODE_CONFIG_DIR` can save edits, but needs a restart to apply them.
JSONC comments, YAML comments, prompt bodies, and unrelated settings are preserved; edited fields can be reformatted.
An interrupted write can leave `.agent-groups.lock`. Remove that lock only after confirming no editor is saving.

The server and TUI entrypoints require OpenCode V1; they were checked against 1.18.29.
V2 needs a separate port. Install the complete `extensions/agent-groups/` directory and the package manifest.
Keep these entrypoints outside the automatically discovered `plugins/` directory to avoid loading them twice.
Live reload records an internal `reloadToken` in the server plugin options so OpenCode invalidates its global cache.
You do not need to edit that value.

## Run a complete workflow

With `workflow-lead` selected, describe the task once. Include known constraints and observable acceptance examples:

```text
Add background report exports. Help me decide access rules, retries, and retention.
```

The lead coordinates applicable stages:

| Stage | What happens |
| --- | --- |
| Inspect and clarify | Read source and prior decisions; resolve consequential missing requirements. |
| Design and plan | Compare approaches and prepare the implementation plan. Add rollout phases when needed. |
| Review and approve | Obtain independent design reviews, resolve blocking findings, and request your approval. |
| Implement | Assign specialists, integrate the work, and update affected documentation within scope. |
| Review and verify | Collect required reviews and check evidence; repair approved issues within the remaining budget. |
| Hand off | Report changed behavior, observed checks, review findings, unresolved gaps, and the next action. |

Answer questions and approve the reviewed plan in the same conversation. You can request changes or alternatives,
or cancel. Approval covers its stated scope. The lead advances without additional commands or agent switches.
Existing decisions and valid approvals carry forward. Material scope changes require affected reviews and renewed
approval. Missing access, consequential unanswered questions, and exhausted repair budgets can require a pause.

The route depends on the task. A known bug does not need a requirements interview. A small correction does not need
every planning step. The lead selects test-first evidence for behavior changes, characterization checks for refactors,
baseline verification tests for existing behavior, and comparable measurements for performance work.
Existing tests and sufficient current reviews are reused.

For substantial work, planning identifies consequential gaps in architecture guidance, domain invariants, verification
commands, and access to relevant fixtures or runtime evidence. The plan separates blockers from optional improvements
and proposes the smallest necessary correction using existing project documentation, tools, and tests.

Primary agents and specialists use the [project learning procedure](references/agent-prompts/project-learning.md)
for assigned failure-prevention assessments, evidenced recurring mistakes, or repeated attempts that stop at a blocker.
Leads also invoke it when the repair budget is exhausted. Specialists return assessments in their existing task reports.
The lead validates the evidence, combines duplicate recommendations, and selects at most one justified
preventive change. The assessment does not authorize another repair or a broader scope.
Persistent changes still require applicable approval.
If no preventive change is justified, report the missing prerequisite or next bounded investigation.

You can request a stopping point such as "design only" or "implement only phase 1 after approval."
Read-only questions do not start implementation. A plan or reviewer verdict is not implementation approval.
Commits, pushes, pull requests, merges, deployments, and other shipping actions require authorization for that action.
Saving or committing task-process files also requires authorization.

## Move between focused stages

Use `planning-lead` to settle requirements or an approach before deciding to implement:

```text
Plan a background export feature. Compare our existing job runner with a separate worker.
Include access rules, retry behavior, acceptance examples, and the existing checks we can reuse.
```

It coordinates the planner, architect when needed, and independent design reviewers. It returns the reviewed plan
and stops. For a narrower result, say "specification only," "compare designs only," or "plan the rollout phases."

When ready, select `implementation-lead` in the same conversation and give approval for the reviewed scope:

```text
Implement the reviewed plan above. The listed files, tests, and documentation changes are approved.
```

The implementation lead checks the plan, review evidence, source currency, and authorization before editing.
If they remain valid, it reuses them. It asks for missing approval, refreshes affected review evidence when possible,
and returns material design gaps to planning. It continues through integration, reviews, and verification.
You can instead select `workflow-lead` to continue the full process from the first incomplete stage.

Select `review-lead` for a separate assessment:

```text
Review the current branch against main. Focus on correctness, failure handling, and integration risks.
```

An untargeted code review defaults to local changes and states that scope. An explicit branch, PR, design, or file
target takes precedence. Ask for a named specialty when you only need that assessment; its result covers that specialty.
The review lead reports fixes as follow-up work. It does not apply them.

For verification without a review:

```text
Run the existing checks for the current CLI changes. Report failures and coverage gaps without applying fixes.
```

For a final assessment, ask it to collect applicable reviews and final checks and report readiness.
Missing or failing CI does not prevent review, but missing required evidence blocks readiness.
Verification reports distinguish checks that passed, failed, were blocked, or were skipped.

## Command reference

`/test-audit [context]` runs a focused audit under `review-lead` in the main session.
It explicitly selects that read-only lead and uses the existing `test-audit` skill.
See [test-suite audits](#audit-existing-test-suites) for scope, focus, and examples.

The utility commands below retain the active agent and cannot expand its role or permissions.
For example, a planning or review lead cannot execute `/commit` or `/push`.

| Command | Purpose |
| --- | --- |
| `/checkpoint <task-id>` | Save an authorized project handoff, or return it in chat if writing is blocked. |
| `/resume-work <handoff-path>` | Revalidate evidence and identify the next action within the selected lead's scope. |
| `/explain <feature>` | Explain current behavior from source. |
| `/quiz <topic>` | Ask optional source-grounded learning questions and wait for answers. |
| `/init-docs [path] [notes]` | Add or update repository documentation rules and scoped technical vocabulary. |
| `/commit [scope]` | Stage and commit authorized changes with secret checks. |
| `/push` | Push the current branch with authorization. |
| `/summarize-branch` | Summarize branch changes before a pull request. |

The built-in `/resume` selects an OpenCode session. `/resume-work` reads a project handoff.
Checkpoints stay in the work project. Learning questions and quiz scores are optional.
See the [command definitions](commands/) for prompts.
See [upgrade instructions](README.md#upgrade-an-existing-installation) for retired commands and skills.

### Initialize repository documentation

Run `/init-docs` from a work repository to prepare its documentation rules and technical terminology.
By default, it updates the repository's `AGENTS.md` or creates that file when absent.
Pass a file path to choose another destination. Pass a directory to use `AGENTS.md` inside that directory.
Relative paths start at the repository root. Use a trailing slash for a new directory.
All destinations must stay inside the work repository.

```text
/init-docs
/init-docs docs/documentation-rules.md
/init-docs packages/api/ Focus on the public API and its existing terminology.
```

The command reads current instructions, manifests, source, and documentation.
It proposes a concise documentation section while preserving existing standards and unrelated instructions.
New terminology entries stay in the selected file unless an existing glossary already owns them.
Each entry records its spelling, meaning, grammatical use, scope, usage, and supporting source.
The list supplements ordinary English. It does not contain ASD's official dictionary or establish formal STE compliance.

Repository documentation standards override the [shared STE defaults](references/agent-prompts/asd-ste100.md).
The defaults apply to choices that the repository leaves unspecified.
Rerunning `/init-docs` preserves established rules and terms while proposing supported updates.
Review the setup under the active lead's approval policy before implementation.
The command retains that lead. A planning lead can propose the setup but cannot write it.

A custom file might need an explicit read instruction before agents use it.
A nested `AGENTS.md` follows its directory scope. The command reports the applicable loading path.
Initialization writes only to the work repository and does not publish the generated files.

## Supporting skills

Agents select reusable procedures as needed. You do not need to invoke a skill to start a workflow stage.
Naming a skill never expands the current agent's role, permissions, or approval scope.

| Skill | Purpose |
| --- | --- |
| [test-first](skills/test-first/SKILL.md) | Observe a test fail, implement the approved change, and verify it. |
| [test-audit](skills/test-audit/SKILL.md) | Assess existing suites and support approved, evidence-based cleanup. |
| [end-to-end-tests](skills/end-to-end-tests/SKILL.md) | Verify journeys through real application boundaries. |
| [verification-tests](skills/verification-tests/SKILL.md) | Design and generate coverage for established behavior. |
| [measured-performance](skills/measured-performance/SKILL.md) | Compare performance under matching conditions. |
| [verify](skills/verify/SKILL.md) | Run configured checks and report evidence without fixes. |
| [checkpoint](skills/checkpoint/SKILL.md) | Save or resume an authorized task handoff. |
| [code-learning](skills/code-learning/SKILL.md) | Explain source behavior and optionally ask learning questions. |
| [project-standards](skills/project-standards/SKILL.md) | Propose deliberate convention, tooling, or CI changes. |
| [commit](skills/commit/SKILL.md) | Stage, inspect, and commit authorized changes. |
| [push](skills/push/SKILL.md) | Push an authorized branch. |

These procedures support more than one lead or specialist. Requirements interviews, phased planning, review routing,
and completion procedures are internal [agent references](references/agent-prompts/).
They are loaded by their owning agents and do not appear as separate skill entrypoints.
Routine tests, verification, and fixes do not require the `project-standards` skill.

## Worked examples

Use `workflow-lead` for the examples below unless a focused lead is specified.
State required behavior and known constraints. The agent selects relevant procedures and specialists.

### Small feature

```text
Add a --json option to the existing list command. Keep the table output as the default.
Return an array with --json and [] for an empty result. Preserve filtering and exit codes.
```

Expect a proportionate reviewed plan, approval before substantial implementation, meaningful tests, and verification.
Select `planning-lead` for the plan alone.

### Complex feature

```text
Add background report exports. Users should request an export, check progress, and download the result when ready.
Help me decide access rules, cancellation, retries, retention, and behavior after a worker restart.
Inspect our existing report and job infrastructure before asking questions.
Compare extending our job runner with a separate worker if that choice matters.
```

The lead resolves consequential requirements, compares approaches when needed, and carries confirmed decisions into
planning and design review. After approval it coordinates implementation, affected docs, reviews, and checks.

### Staged migration

```text
Replace the report status field with a structured status object. The API and its consumers deploy independently.
Preserve existing consumers during the transition. Include compatibility checks, removal criteria, and rollback limits.
Plan the full migration, but implement only phase 1 after I approve it.
```

Expect independently usable phases with advancement and rollback conditions. Later phases remain outside the approved
implementation scope. Select `planning-lead` when you only want rollout analysis.

### Refactor and cleanup

```text
Separate report input validation from report generation. Preserve accepted inputs, error messages, ordering,
side effects, and public interfaces. Add characterization checks for important uncovered behavior before refactoring.
Keep unrelated cleanup out of scope.
```

For dead-code cleanup, specify removal boundaries and preserve uncertain candidates, public exports, and dynamically
registered handlers. Public API removals need explicit authorization. The workflow includes final reviews and checks.
Observed behavior can contain defects; confirm surprising behavior before preserving it as a requirement.

### Bug fix

```text
Fix duplicate records on the second page of report results. Reproduce the overlap with a stable dataset.
Adjacent pages must not repeat records under the documented sort order. Preserve the public pagination interface.
```

Expect meaningful failing-regression evidence before the fix and passing checks afterward when a test seam is available.
A missing dependency or test syntax error is not evidence that the defect was reproduced.

### Performance improvement

```text
Investigate and improve report generation for a large local fixture dataset.
Record a repeatable baseline before selecting a bottleneck. Preserve report contents and ordering.
Compare elapsed time and peak memory under matching conditions afterward.
```

Expect the workload, command, environment, baseline, candidate result, and measurement limits.
If measurement is blocked, the result must identify the missing prerequisite instead of inventing a speedup.

## Audit existing test suites

Run `/test-audit [context]` to start the audit workflow under `review-lead`.
The lead coordinates permitted reviewers with the `test-audit` skill and returns an assessment without edits.
The context can identify a feature, module, source directory, test suite, or the current conversation's task.
Relevant tests can live elsewhere in the repository. Explicit file restrictions still apply.

```text
/test-audit authentication
/test-audit packages/cli - unit tests only
/test-audit checkout - E2E only
/test-audit the export feature we just implemented
```

Context and focus are natural-language instructions, not shell flags.
The default assessment includes unit and end-to-end coverage, including unchanged tests.
With no arguments, the command uses an unambiguous current task. Otherwise it inventories suites and asks for scope.
It does not silently start a repository-wide audit. Ordinary diff reviews retain their narrower scope.
You can also select `review-lead` and request the same assessment directly:

```text
Audit the existing tests for configuration loading, including tests outside the current diff.
Identify useful coverage, duplicated assertions, misleading mocks, and missing important failure cases.
Recommend what to retain, consolidate, rewrite, or remove, with evidence and remaining coverage for each change.
Do not edit files.
```

Expect a coverage map, prioritized findings, candidate decisions, and a proposed improvement plan.
Evidence includes test locations, protected behavior, actual failure modes, relevant history, remaining coverage,
risk, and observed or proposed checks. Requested verification limits remain in effect.
The command stops after assessment without edits or saved task reports.
Uncertain candidates remain visible. Static tests and exact-value assertions can protect real
contracts. A failing test can identify a product defect. Neither category is an automatic removal target.

Use `workflow-lead` when you also want cleanup. It reviews and obtains approval for the proposed changes before
assigning edits. An approved implementation plan can instead go to `implementation-lead`.
Replacing tests requires preserving their useful assertions. Removing production support requires evidence about
its real consumers and any applicable approval. The audit does not authorize a commit or pull request.

## End-to-end tests during feature development

Describe the feature and its observable outcome to `workflow-lead`. Planning selects end-to-end coverage when the
journey's integration risks justify it. You can request `end-to-end-tests` explicitly without changing the lead's role.
The skill supports browser, CLI, API, and worker journeys. It reuses the project's test runner and normal approval flow.

```text
Add background CSV exports. Users must be able to request an export, wait for completion, and download their file.
Include end-to-end tests through the real API, worker, and persistence path using isolated synthetic data.
Check the downloaded contents and prevent another user from downloading the export.
Reuse the current test tooling. Include the coverage design in the feature plan before implementation.
```

The design maps each selected journey to requirements, existing coverage, real components, substituted external
dependencies, fixtures, setup, cleanup, and execution commands. Tests verify outcomes and important failure paths.
They do not seed the final result or mock the application's own behavior and then claim complete-path evidence.
Browser tests use stable user-facing locators and bounded waiting. All journeys isolate mutable state and clean up
owned resources. Detailed rule permutations stay at lower levels unless they expose another integration risk.

For new behavior and bug fixes, `test-first` supplies meaningful failure and passing evidence when execution is
available. An established-behavior baseline can pass immediately. Missing services or unrelated failures are not proof
that the intended regression was detected.

Authors and reviewers share the [testing standards](references/agent-prompts/testing-standards.md).
Checks that cannot run and verification exclusions approved for the task remain explicit. They do not count as passes.
New tools, CI changes, or infrastructure work must be in the approved scope.
Use `planning-lead` for design alone and `review-lead` to assess or execute existing tests without repairs.

## Verification tests for existing code

Ask `workflow-lead` to establish reusable coverage when a feature has little coverage, a workflow is difficult to test,
or a refactor needs a baseline. The lead uses `verification-tests` and the normal design, approval, and review process.
Use `planning-lead` for a coverage design alone, `implementation-lead` for an approved design, or `review-lead` to run
existing tests. A review lead does not generate a missing suite.

```text
Establish verification tests for the existing CLI configuration loading and error handling.
Use documented precedence and validation rules as expected behavior. Cover valid files, missing optional files,
malformed input, exit codes, and user-visible errors. Reuse the current runner and exercise the real CLI where needed.
Preserve application behavior. Include isolated fixtures, cleanup, and repeatable run instructions.
```

The suite can include unit, integration, contract, CLI, API, or end-to-end tests according to the requested boundaries.
Provide known interfaces, examples, commands, environment limits, and behavior to preserve.
Baseline tests can pass on their first run. They do not need an artificial red/green cycle.
Characterization records observed behavior; review surprising results before accepting them as requirements.

Expect a coverage design before generation. It identifies expected behavior and its source, reused tests, new cases,
fixtures, prerequisites, target files, execution commands, and remaining gaps. Requirements and public contracts should
determine expected values independently of the implementation.

For database behavior, ask for persisted-state assertions and transaction checks through the real database boundary
using isolated synthetic data. A mocked dependency does not establish that the real integration works.
New dependencies, CI changes, and testability refactors must be explicit in the approved scope.
If infrastructure is unavailable, distinguish generated tests from checks that actually ran.

The result includes test files, fixtures, necessary helpers, setup and cleanup instructions in the work repository,
and source-linked execution evidence. A correct test that exposes an existing defect remains a failure.
Missing services, skipped checks, and zero expected tests collected do not establish a passing baseline.
See the [verification result statuses](skills/verify/SKILL.md#results).

Reuse the suite through its documented commands, existing CI, or `review-lead`:

```text
Check the current CLI changes against the existing verification suite.
Map changed behavior and affected integrations to actual assertions. Run relevant checks on this source state.
Report uncovered behavior, stale expectations, and unavailable integration checks separately from test results.
```

An earlier pass is not evidence for a later source state or different environment. Extend coverage through an approved
implementation assignment. Change expectations only for reviewed requirement changes, not merely changed code.
You can name `verification-tests` explicitly in a lead request, but doing so does not expand its scope or permissions.

## Limit verification

You can limit agent verification for a task or establish a default in the work project's existing instructions.
The [verification scope rules](references/agent-prompts/verification-scope.md) apply to primary agents and specialists.
State whether the limit covers capability discovery, test generation, check execution, or infrastructure changes.
An instruction to skip execution alone still permits requested test generation.

For a large codebase with costly or inaccessible integration environments:

```text
Limit verification to existing focused checks that are practical here. Do not investigate broader verification
capabilities, generate tests, or add infrastructure for this task. If the focused checks cannot reasonably run,
report the limitation and continue the implementation. Do not ask again about that limitation.
```

To exclude agent verification entirely:

```text
Skip verification capability assessment, test generation, and check execution for this task.
Implement the approved change and complete the required code reviews. Report the implementation as unverified.
```

The lead retains your boundary with the plan and passes it to specialists, reviews, and authorized handoffs.
Accepted limits remain effective across stages, agent switches, and resumed work while their scope still applies.
They do not trigger repeated approval requests, infrastructure work, or failure-prevention recommendations solely
because checks remain absent. Repository size alone does not establish an exclusion.

Excluded checks are reported as `SKIP`, with the decision source and unverified scope. Other unavailable required
checks remain `BLOCKED`. Earlier attempts remain visible, and observed failures remain `FAIL`.
An accepted limitation does not block completion of the requested implementation. It does not establish a passing
check, a performance improvement, a resolved defect, or merge readiness. Required reviews, permission boundaries,
and external CI or branch-protection requirements still apply.

## Continue a long task

Use `/checkpoint <task-id>` or ask the active lead to save a handoff before changing sessions.
The handoff records the selected lead and stopping point, source state including relevant untracked changes, plan
revision, approved scope, verification limits and their source, owners, checks, review findings, remaining budget,
blockers, and the next bounded action.
It belongs in the work project. A planning or review lead returns it in chat when its permissions prevent saving.

In the next session, select the appropriate lead and use `/resume-work <handoff-path>`.
The lead checks current instructions, source, ownership, evidence, and authorization before proceeding.
It refreshes stale evidence without discarding valid decisions or restarting the repair budget.
A saved agent name does not change the selected role. A saved approval claim is not a new permission grant.
Do not reset files or change branches to make a handoff match.

For the underlying procedures, see the [workflow lead](agents/workflow-lead.md),
[lead contract](references/agent-prompts/lead-contract.md), and [agent references](references/agent-prompts/).
