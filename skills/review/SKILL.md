---
name: review
description: Review code using the active review agent's specialty, shared target rules, and report format.
---

# Code review

Use this skill in the selected reviewer agent, normally `code-reviewer`.
Read `@agent-prompts/review-target.md` and resolve the caller's scope. Honor any default supplied by the command.
With no explicit target or command default, ask which scope to review.
Follow the current review agent's procedure, `@agent-prompts/reviewer-standards.md`, and
`@agent-prompts/review-template.md`.
Return findings and verification limits to the caller.
