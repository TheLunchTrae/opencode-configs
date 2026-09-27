---
name: review
description: Review code using the active review agent's specialty, shared target rules, and report format.
---

# Code review

Use this skill in the selected reviewer agent, normally `code-reviewer`.
Read `@review-target` and resolve the caller's scope. Honor any default supplied by the command.
With no explicit target or command default, ask which scope to review.
Follow the current review agent's procedure, `@reviewer-standards`, and `@review-template`.
Return findings and verification limits to the caller.
