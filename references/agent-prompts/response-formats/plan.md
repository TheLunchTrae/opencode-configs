# Plan response

Read `@agent-prompts/response-formats/common.md`. Use its envelope with these sections under `Result`:

### Outcome and constraints

State the outcome, non-goals, confirmed requirements, constraints, decisions, and assumptions.

### Design

Describe component responsibilities, data shape and lifecycle, ownership, failure behavior, and affected files.
Explain consequential alternatives and the rationale for the chosen design. Mark proposed components as new.

### Acceptance

Give user-visible acceptance examples and preserved invariants.

### Task slices

Order small slices by dependency. For each, state the outcome, required specialty or supplied owner, exclusive files,
dependencies, rationale, acceptance evidence, and risk. Identify shared or forbidden files and ready conditions.
Do not invent available delegation targets; name the required specialty when no permitted owner was supplied.

### Verification strategy

Use actual project checks where available. Identify characterization, regression, integration, and measurement needs.
These are proposed checks unless execution evidence was supplied; planning does not imply that they ran.

### Risks and decisions

State risks, mitigations, and decisions that require review. Put blocking questions and remaining inputs in
`Unresolved items`; put source evidence in `Evidence`. A plan does not authorize execution.
