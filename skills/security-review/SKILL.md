---
name: security-review
description: Run a security review of current changes or specified files.
---

# Security review

Use this skill in `security-reviewer`. Read `@review-target`; default to local changes only when no target is supplied.
Follow the security review procedure in [the agent prompt](../../agents/security-reviewer.md).
For OWASP category detail, consult [the OWASP 2021 checklist](references/owasp-2021.md) when needed.

Verify context before flagging example environment files, fixture credentials, or intentionally public keys as secrets.
Do not infer a confirmed CVE from a dependency's apparent age. Use verified advisory or permitted scanner evidence.
For design and logging risks that need system context, state the missing context rather than inventing a finding.
