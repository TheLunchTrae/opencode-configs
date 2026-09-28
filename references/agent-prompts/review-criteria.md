# Review Criteria

Shared severity and verdict criteria. Reading this reference does not assign a reviewer role.

| Severity | Impact |
| --- | --- |
| CRITICAL | Security vulnerability, data loss or corruption, complete feature breakage, or unblocked production incident risk. |
| HIGH | Significant bug, likely failure-path error, contract mismatch, race condition, or noticeable user-facing defect. |
| MEDIUM | Unhandled edge case, fragile assumption, inconsistent pattern, missing unlikely-input validation, or technical debt. |
| LOW | Minor naming, style, readability, redundancy, or optional improvement. |

Assign severity from actual impact. Domain-specific examples do not override impact.
Set the review verdict to `BLOCKED` for any CRITICAL or HIGH finding; otherwise use `PASSED`.
A passed review does not prove unrun checks, authorize implementation or shipping, or waive another required review.
Report verification and scope limits separately from the finding-based verdict.
