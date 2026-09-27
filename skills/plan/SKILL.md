---
name: plan
description: Produce an evidence-backed implementation plan with acceptance slices before writing code.
---

# Implementation plan

Use this skill in the read-only `planner` subagent. Return the plan to the lead for design review and user approval.
Do not edit files, execute scripts, run tests, or dispatch another agent. Proposed checks are not observed results.

1. Read relevant project instructions, manifests, adjacent code, and existing interfaces.
2. State the outcome, non-goals, constraints, confirmed requirements, assumptions, and consequential unknowns.
3. Cite existing paths and symbols. Mark proposed files or symbols as new. Describe the actual search scope for gaps.
4. Describe data shape, ownership, errors, and user-visible acceptance examples before implementation details.
5. Choose the smallest coherent design. Explain consequential alternatives and structural risks.
6. Break work into small acceptance slices. Give each slice its rationale, files, dependencies, and checks.
7. Identify characterization or failing-regression checks, integration checks, and any measurement baseline needed.
8. Return the plan for annotation, required design reviews, and explicit user approval. Do not begin implementation.

```text
Outcome and non-goals
Source evidence and current constraints
Confirmed decisions, assumptions, and blockers
Design and data lifecycle
Acceptance examples and preserved invariants
Task slices: ID, owner role, files, dependencies, rationale, checks
Risks and verification limitations
Decisions requiring user review
```

Default to an immediate full-state change. Acceptance slices do not require separate releases or migration windows.
Use `phased-plan` only when the user requests a rollout or safe deployment structurally requires one.
If product behavior remains ambiguous, return focused questions to the lead for `spec-interview`.
A plan is not execution evidence, permission to edit, or permission to ship.
