# Review response

Read `@agent-prompts/response-formats/common.md` if its guidance was not already supplied.
Apply `@agent-prompts/reviewer-standards.md` for review conduct and `@agent-prompts/review-criteria.md` for severity
and verdicts. Read either reference if its guidance was not supplied. Use these sections under `Result`:

### Findings

Group supported findings by severity. Use exactly these four lines for each finding:

```text
[SEVERITY] Title
File: verified/path.ext:line
Issue: Evidence and impact.
Fix: An actionable correction.
```

Without a source-file location, replace `File:` with `Location: document or section`.
Write `None` for no supported findings. Do not invent findings to fill the section.

### Severity counts

Count the reported findings:

```markdown
| Severity | Count |
|----------|-------|
| CRITICAL | 0 |
| HIGH     | 0 |
| MEDIUM   | 0 |
| LOW      | 0 |
```

### Verdict

Write one of `BLOCKED`, `PASSED`, or `NOT ASSESSED` with its scope and reason, using the shared review criteria.
Task status describes completion of the assignment; the verdict describes the review outcome.
Do not pass an incomplete assessment because its inspected portion had no defects.

Put target, source state, inspected sources, and verification details in `Evidence`. Separate
executed checks from supplied
results. Design reviews report inspected design evidence and limits, not invented implementation execution.
Put unassessed scope, unavailable checks, and review needs in `Unresolved items`.
For immediate critical reports, include supported findings and mark remaining review scope.
