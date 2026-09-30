# Review stage

Use within the active lead's scope and `@agent-prompts/lead-contract.md`.
When interpreting findings, read `@agent-prompts/review-criteria.md` if its guidance was not already supplied.
When resolving scope, read `@agent-prompts/review-target.md` if its guidance was not already supplied.

## Required implementation reviews

Dispatch `code-reviewer` after code changes, before commits to shared branches, and before merging a pull request.
Obtain matching language review for TypeScript/JavaScript, Go, C#, or PHP changes.
For structural changes, dispatch `architecture-reviewer`.
Use `security-reviewer` for authentication, authorization, user input, database queries, file operations, external APIs,
cryptography, payments, or sensitive data. Arrange general, architecture, and security reviewers as sibling tasks.
For design assessments, apply `@agent-prompts/planning-stage.md`'s review requirements.

Supply current source or diff, intended behavior, surrounding context, verification limits, and check evidence.
Review can start while CI is missing, pending, or failing. State those limits; unavailable evidence is not a pass.
Reuse current complete findings for the same scope, including language evidence collected by a review coordinator.
Delegate only uncovered scope. Reuse identical reviews; refresh those affected by changes.
Validate citations, source currency, scope, uncertainty, and findings before incorporating them.
Use `@agent-prompts/response-formats/review.md` for the expected return. Require a complete assessment and `PASSED`
verdict for each required review. `NOT ASSESSED`, unfinished scope, and missing reports do not satisfy that requirement.
Resolve verification gaps within the agreed scope. Preserve accepted limitations without reopening them as blockers.
Even a complete, passed review does not prove unrun checks.

## Findings and escalation

CRITICAL and HIGH findings block acceptance until resolved. Address MEDIUM findings when reasonable within authorized
implementation; report remaining lower-severity findings for the user's decision.
In an implementation workflow, return repairs to implementation within the approved scope and remaining budget.
In a review-only session, return findings and required follow-up without edits or repair delegation.

On a CRITICAL security finding, stop affected work, preserve evidence, and notify the user immediately.
Arrange `security-reviewer` as a sibling if that assessment is not already current. Do not ask a child to exceed the
depth limit or repeat completed review. Report the block explicitly and retain it until supported remediation evidence.

A narrow specialty review establishes only its stated coverage. Missing required evidence blocks readiness, not review.
