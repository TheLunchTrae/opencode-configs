---
name: verify
description: Run configured checks and report source-linked PASS, FAIL, BLOCKED, or SKIP evidence without fixes.
---

# Verify

Run in the active lead session, or as an explicitly permitted evidence-only assignment.
Do not spawn a nested lead. Do not edit application code or apply fixes while verifying.
Commands can produce normal build artifacts; inspect side effects and retain ordinary permission checks.

1. Inspect project instructions, manifests, and configured scripts. Confirm the installed toolchain when available.
2. Record the source state and working directory. Include relevant dirty and untracked changes, not just Git HEAD.
3. Run the smallest relevant acceptance check first. Then run configured type, lint, unit, integration, and build
   checks.
   Use project ordering where required. Independent read-only checks can run in parallel if outputs cannot conflict.
4. Use bounded commands and concise diagnostics. Report timeouts and missing access instead of retrying indefinitely.
5. Record each command, status, exit code when available, and useful evidence such as test count or artifact path.
6. Inspect coverage only when configured. Compare with the project's actual policy; do not invent an 80 percent gate.
7. Report CI separately when available. Local checks do not prove CI success, native configuration loading, or UX
   behavior.
8. Invalidate affected results when source, dependencies, generated inputs, or configuration change.

| Status | Meaning |
| --- | --- |
| PASS | The check ran on the stated source state and satisfied its actual acceptance conditions. |
| FAIL | The check ran and found a relevant failure. Distinguish pre-existing failures from regressions. |
| BLOCKED | A required check could not finish because environment, permission, or access is missing. |
| SKIP | The check does not apply or is not configured. State why; do not count it as a pass. |

An exit code of zero with no expected tests collected is not proof that the acceptance target passed.
Do not fall back to an invented runner or install packages to hide missing configuration.
Do not suppress warnings or weaken assertions. Record warnings against the project's policy.
Report action items for the implementer. A verification report does not authorize edits or remote actions.
