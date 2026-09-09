# Review Template

Use this template after you apply `@reviewer-standards`.

## Findings

Group findings by severity. Use exactly these four lines for each finding:

```text
[SEVERITY] Title
File: verified/path.ext:line
Issue: Evidence and impact.
Fix: An actionable correction.
```

For a finding without a source-file location, replace the `File:` line with:

```text
Location: document or section
```

## Verification

For an implementation review, add a `## Verification` section after the findings.
Identify commands you personally ran and their results. Identify supplied evidence and
its source. State steps not run, blocked steps, and verification limits.

For a design review, do not add an implementation command section. State design limits
outside that section when they apply.

## Verdict

After all findings and any verification section, add this table:

```text
| Severity | Count |
|----------|-------|
| CRITICAL | 0 |
| HIGH     | 0 |
| MEDIUM   | 0 |
| LOW      | 0 |
```

Then add one heading. Determine `BLOCKED` or `PASSED` with
`@reviewer-standards`.

```text
## Verdict: BLOCKED
```

Use either heading.

```text
## Verdict: PASSED
```
