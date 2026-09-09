---
name: security-review
description: Run a security review of current changes or specified files
---

<!-- Run this skill as a subtask in the `security-reviewer` subagent for context isolation. -->

# Security review: $ARGUMENTS

Analyze code for vulnerabilities and present findings. Use when changes touch authentication, user input handling, database queries, cryptography, external APIs, or file I/O — anything with a plausible security blast radius.

## Process

1. Determine the review target:
   - If the user specified files or a path, review those
   - If arguments look like a branch or commit, diff against that
   - Otherwise, review staged + unstaged changes (`git diff HEAD`)

2. Review the target against OWASP Top 10 and common vulnerability patterns. For category-by-category detail when a finding needs deeper context, see [references/owasp-2021.md](references/owasp-2021.md).

3. Present findings grouped by severity (CRITICAL → HIGH → MEDIUM)

4. If CRITICAL or HIGH issues are found, surface them prominently and note that they must be resolved before merging

## Gotchas

- Subagent fork — read-only. The skill reports findings; the implementer applies fixes.
- `.env.example`, `.env.sample`, fixture/test credentials, and intentionally-public API keys frequently trip secret-detection patterns. Verify context before flagging as CRITICAL.
- The skill does not run `npm audit`, `pip-audit`, or other dependency-vulnerability scanners. It can flag a dependency that *looks* outdated but cannot confirm a CVE — defer that to the implementer or to a CI job.
- OWASP A04 (Insecure Design) and A09 (Logging Failures) require system-level context that diff-only review often misses; surface them as questions rather than firm findings when the diff is narrow.
