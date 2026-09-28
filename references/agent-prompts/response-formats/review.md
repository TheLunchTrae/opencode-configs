# Review response

Read `@agent-prompts/response-formats/common.md`. Apply `@agent-prompts/reviewer-standards.md` for review conduct
and `@agent-prompts/review-criteria.md` for severity and verdicts. Use these sections under `Result`:

### Findings

Group supported findings by severity. Use exactly these four lines for each finding:

```text
[SEVERITY] Title
File: verified/path.ext:line
Issue: Evidence and impact.
Fix: An actionable correction.
```

For a finding without a source-file location, replace the `File:` line with `Location: document or section`.
Write `None` when there are no supported findings. Do not invent a finding to fill the section.

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
Do not label an incomplete assessment as a passed review because no defect was found in the inspected portion.

Use `Evidence` for the review target, source state, inspected sources, and verification details. Separate personally
run checks from supplied results. For design reviews, report inspected design evidence and limits without inventing
implementation execution. Put unassessed scope, unavailable checks, and other review needs in `Unresolved items`.
For an immediate critical report, include supported findings and explicitly mark any remaining review scope.
