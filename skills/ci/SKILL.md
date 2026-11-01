---
name: ci
description: Use when planning, implementing, or reviewing GitHub Actions or GitLab CI pipelines, actions, includes, credentials, or runner trust boundaries.
---

# CI safety and behavior

Trace callers, includes, reusable workflows, triggers, inherited settings, required check names, and job dependencies.
Inspect inaccessible dependencies as explicit gaps. Preserve the intended graph and existing project conventions.

For GitHub Actions, read the current
[shared workflow guidance](https://github.com/lunchbox-labs/.github/blob/main/agent-guidance/workflows.md)
before selecting naming, performance, or failure-diagnostics changes. It owns those defaults; do not maintain a second copy.
Honor local exceptions. Report unavailable guidance rather than guessing. Do not apply GitHub-specific defaults to GitLab.
Normal command logs and failure status are the default. Upload existing results on failure only where useful.
Deep diagnostics are opt-in for a specific investigation, not a mandatory pipeline stage. Preserve original failures.

- Grant minimum job permissions. Keep secrets out of source, logs, artifacts, and caches. Masking does not make
  transformed secrets safe. Never execute untrusted fork code with deploy credentials or privileged runner access.
- In GitHub Actions, pin third-party actions by full commit SHA. Pass untrusted event values through environment
  variables and quote them in shell scripts; do not interpolate expressions into executable shell text.
  Assess `pull_request_target`, `workflow_run`, reusable-workflow permissions, and token exposure as trust boundaries.
- In GitLab, inspect the merged configuration and `workflow`/job rules for duplicate and unintended pipelines.
  Protect sensitive variables and runner isolation. Verify cross-project `CI_JOB_TOKEN` allowlists.
- Prefer scoped OIDC federation to long-lived cloud credentials when supported. Verify audience, subject, environment,
  and deployment gates. Changes to trust policy require explicit authorization.
- Use artifacts for required job handoffs and caches only for acceleration. Bound retention, key caches appropriately,
  and ensure cache poisoning cannot cross trust levels. Set concurrency/cancellation only where cancellation is safe.
- Use configured local validation and existing tests. Do not push or trigger hosted CI merely to obtain evidence.
  Local checks do not prove hosted permissions, runner isolation, or branch protection.

Pause affected work for missing security decisions involving privileged triggers, public self-hosted runners,
credential exposure, or approval automation. Request separate security review for these high-risk changes.
Report actual checks, unresolved includes, and hosted verification limits.
