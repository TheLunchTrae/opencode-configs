---
name: review
description: "Review code and present findings"
---

<!-- Run this skill as a subtask in the `code-reviewer` subagent for context isolation. -->

# Review: $ARGUMENTS

## Step 1: Determine review target
If $ARGUMENTS clearly specifies the target, use it:
- "branch", "mr", or "merge request" – current branch diff against the merge target
- "staged" – staged/cached changes only
- "local" – all uncommitted local changes
- A file path or glob – those specific files

If $ARGUMENTS is empty or unclear, ask the user which type of review they want before proceeding. Do not guess.

## Step 2: Gather the code

- MR: determine the target branch, run `git diff` against it
- Staged: run `git diff --cached`
- Local: all changes vs the latest commit
- Files: read the specified files directly

## Step 3: Review

Read `@reviewer-standards` and apply its review rules. Read `@review-template` and use
its report format. Read `@global-coding-style` when code-style findings apply. Review
the gathered code using your review methodology.

## Step 4: Present findings

Present the report with the required findings, verification evidence, and verdict.

Stop here. The user will decide what to do next — if they want fixes applied, they will ask.

## Gotchas

- Subagent fork — read-only. The skill stops after presenting findings; do not auto-apply fixes even if the issues look trivial.
- If `$ARGUMENTS` is empty or ambiguous, ask which review target the user wants. Do not default to "everything changed" silently.
- The review covers changed code only by default. Bugs in unchanged surrounding code can be relevant context but are not flagged unless they're CRITICAL security issues.
