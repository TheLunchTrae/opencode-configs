---
name: development-workflow
description: Coordinate evidence-backed planning, bounded implementation, independent review, and handoff.
---

# Development workflow

Use this skill in `lead` for implementation work. It refines the existing workflow; it does not replace approval gates.
Keep the existing agents, model assignments, Task allowlists, review requirements, and maximum delegation depth.
Load only the supporting skills needed for the selected route. A skill never grants tools or delegation permission.

## Select the route

- Investigation: trace the actual caller-to-effect path. Separate source facts, history, hypotheses, and unknowns.
  Return an explanation without edits. Use `code-learning` when the objective is human understanding.
- Ambiguous feature: use `spec-interview`, then `plan`. Settle behavior, data ownership, errors, and acceptance
  examples.
- Defined feature: inspect adjacent implementations, then use `plan`. Build small end-to-end acceptance slices.
- Bug: reproduce the relevant behavior, then use `test-first`. Fix the cause, not an unrelated symptom.
- Performance: delegate to `performance-optimizer` with `measured-performance`. Require a baseline before a speed claim.
- Refactor: state preserved behavior. Obtain characterization evidence before simplifying the smallest coherent scope.

Keep trivial changes lightweight. Do not create a specification, task board, or interview for an obvious correction.
The existing mandatory reviews still apply. Read-only questions do not enter the implementation workflow.

## Research and approve

1. Read project instructions, manifests, nearby implementations, and available checks. Verify source paths and versions.
2. Use bounded, read-only research tasks when exploration is large. Request citations, constraints, and unknowns.
   Do not copy transcripts or entire repositories into each worker prompt.
3. Dispatch `planner` for non-trivial work. Use `architect` for consequential alternatives.
4. Define the user-visible outcome, non-goals, data shape, ownership, and failure behavior.
5. Ask the planner for small, dependency-ordered acceptance slices. A slice is not a deployment phase.
6. Arrange the existing design reviews. Present the plan for user annotations and approval.
   Incorporate corrections before implementation. Material scope changes return to design review and approval.

A cheap CLI, API, or test seam can make behavior executable before a UI exists. Reuse an existing seam where possible.
Do not create a new framework, runner, or abstraction just to satisfy this workflow.

## Delegate with a task contract

Give each implementer a self-contained contract. Use conversation state for short tasks.
For multi-session work, keep the contract in the project's existing planning location, using `checkpoint` as needed.
Never store project state in the global configuration repository.

```text
Task ID and desired outcome:
Approved plan revision and scope:
Acceptance examples and preserved invariants:
Relevant source paths and source revision:
Owned files; forbidden/shared files:
Dependencies and ready conditions:
Existing checks; expected failure or baseline:
Budget and stopping conditions:
Required return: diff, check evidence, risks, blockers, review requests
```

Translate the plan without dropping rationale or acceptance criteria. A task title alone is not a contract.
An implementer returns a candidate, not an approved result. The lead owns integration and user-visible conclusions.
For unfamiliar task classes, trial one small acceptance target before increasing scope or concurrency.
Compare accepted results, review effort, and retries. Do not create work merely to keep an agent occupied.

## Ownership and task state

Start with one writer. Use at most two concurrent writers only after confirming independent acceptance targets,
non-overlapping file ownership, and satisfied dependencies. Use a smaller limit when the project requires it.
Read-only research and reviews can run in parallel when their inputs are stable.

Treat lockfiles, generated outputs, schemas, and shared configuration as shared files. Serialize their changes.
Task tools can share a checkout: separate contexts do not create isolated filesystems or atomic locks.
Use existing worktrees only with clear branch ownership and approval. Do not create or delete worktrees automatically.

For durable tasks, track `planned -> ready -> active -> review -> done`, with `blocked` available from any state.
Only the lead marks a task done after current verification and required independent reviews.
A writer must not approve its own task. Record dependencies explicitly; do not start a dependent task early.
After parallel work, verify the integrated result, not just each worker's individual result.

## Implement and challenge

Use the matching developer agent. Pass the `test-first` skill for observable behavior changes.
For a refactor, compare against the original characterization checks. Prefer deletion over speculative generalization.
Do not change an acceptance test's expected behavior merely to make a candidate pass.

Send the exact current diff, intended behavior, surrounding source, and check evidence to the existing reviewers.
Ask for independent counterexamples, missing cases, data-lifecycle risks, and unnecessary complexity.
Keep specification compliance distinct from code quality. Reuse current, complete language-review findings.
Resolve blocking findings and re-review affected scope. A second context is not proof of model diversity or correctness.

## Bound retries and preserve progress

Set a finite task budget before work starts. By default, allow two repair attempts for the same failed acceptance
target.
Count attempts across resumed sessions. These limits are operating defaults, not claims about an original author.
Stop earlier on repeated failure without new evidence, unclear requirements, a permission denial, or an access limit.
Report the blocker and preserve a checkpoint. Do not restart indefinitely, switch billing routes, or widen permissions.
A fresh session is a deliberate handoff, not a background loop. Use `checkpoint` before a context reset.

## Finish

Use `finish` to verify the final state, collect required reviews, and report remaining limits.
Suggest one evidence-backed project lesson only when useful. A test or lint rule is stronger than repeated prompt prose.
Ask before changing persistent instructions or tooling. Keep general configuration free of project-specific lessons.
No automatic commit, push, pull request, merge, installation, or deployment is authorized by this skill.

The route guidance includes adaptations of pstack principles. Retain [the MIT notice](LICENSE-pstack.txt) when copying
it.
