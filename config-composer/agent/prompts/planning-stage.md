# Planning stage

Use within the active lead's scope and the supplied Lead contract.

Inspect project instructions, manifests, adjacent implementations, and checks within the agreed verification scope.
Reuse current requirements and decisions before asking questions.
For consequential product ambiguity, read `@agent-references/spec-interview.md` and resolve it with the user.
Use `architect` when consequential alternatives remain or the user wants to compare approaches.

For non-trivial implementation, dispatch `planner` with verified paths, requirements, constraints, and unresolved
decisions. It owns the planning procedure and output. Mark proposed components as new.
For a verification baseline, pass `verification-tests` and request the coverage design only.
The planner reads `@agent-references/phased-plan.md` for an explicitly requested or structurally necessary rollout.
Review outcome, non-goals, data ownership, failure behavior, invariants, and acceptance slices.
Acceptance slices do not imply separate releases. Reuse existing test seams; do not invent a framework for the workflow.

Review the design and planner's context and verification gaps. Resolve consequential product unknowns before approval.
Separate accepted verification limits from unmet prerequisites. Without an applicable decision, present a bounded
correction or proposed limitation for the user with the plan.
Include necessary documentation, coverage, or tooling changes within verification scope using existing procedures.
Use `project-standards` only for deliberate tooling adoption.
Keep optional improvements separate from blocking prerequisites.
Missing docs alone require no new file and do not block implementation when verified source supplies context.

{{include:@agent-prompts/design-review.md}}

Return the reviewed plan and remaining findings. Focused planning ends here; workflow leads obtain implementation
approval before proceeding. Implementation leads can revalidate existing design reviews but return material redesign
to planning.
