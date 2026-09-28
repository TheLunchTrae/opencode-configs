# Planning stage

Use within the active lead's scope and `@agent-prompts/lead-contract.md`. This reference grants no edit authority.

Inspect project instructions, manifests, adjacent implementations, and available checks. Verify paths and installed
versions. Reuse current requirements and decisions before asking for missing information.
For consequential product ambiguity, read `@agent-prompts/spec-interview.md` and resolve it with the user.
Use `architect` when consequential alternatives remain or the user wants to compare approaches.

For non-trivial implementation, dispatch `planner` with verified paths, requirements, constraints, and unresolved
decisions. It owns the planning procedure and output. Mark proposed components as new.
For a verification baseline, pass `verification-tests` and request the coverage design only.
The planner reads `@agent-prompts/phased-plan.md` for an explicitly requested or structurally necessary rollout.
Review outcome, non-goals, data ownership, failure behavior, invariants, and acceptance slices.
Acceptance slices do not imply separate releases. Reuse existing test seams; do not invent a framework for the workflow.

## Independent design review

Send every implementation design to `code-reviewer`. For architecture, system, or high-level designs, also dispatch
`architecture-reviewer` as a sibling. Do not add architecture review without a structural decision.
Use `security-reviewer` for security-sensitive designs: authentication, authorization, user input, database queries,
file operations, external APIs, cryptography, payments, or sensitive data.
Run independent reviews in parallel on stable inputs. Resolve CRITICAL and HIGH findings in the design and repeat
affected reviews before presenting it for approval.
General, architecture, and security reviews are separate requirements.

Return the reviewed plan and any remaining findings. A focused planning request ends here; the workflow lead obtains
implementation approval before progressing. An implementation lead can revalidate an existing design's reviews but
must return a material redesign to planning. Design review neither executes the plan nor authorizes implementation.
