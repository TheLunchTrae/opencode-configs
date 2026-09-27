# Workflow validation and activation

Validation date: September 27, 2026. Baseline commit: `a41b56da13c7aac8241e706deef48b1d69a75e96`.
Validation used a local copy of the affected files. Existing source files and initial skill files were checked against
GitHub blob hashes before use. This is not a claim of a complete authenticated OpenCode environment.

## Automated checks

Run these commands from the repository root with Node.js 22.16.0 or a compatible later release:

```sh
node --test tests/workflow-config.test.mjs
node --experimental-strip-types --test tests/block-secrets.test.ts
```

The workflow test suite passed all 22 tests. It checks skill metadata, command routing, agent wiring, reserved command
names, license retention, and verification result categories. It uses Node built-ins and needs no package installation.
It validates the authored flat metadata subset, not arbitrary YAML or the full OpenCode schema.

The `/verify` regression check was run before the routing change. It failed on `subtask: true` as expected.
It then passed with `subtask: false`. This proves the configuration correction, not live delegation behavior.

The unchanged secret-blocking plugin passed all seven existing tests.
Node emitted its normal experimental type-stripping warning.

The prescribed type check was attempted with package downloads disabled:

```sh
npx --no-install tsc --project tsconfig.json
```

It exited with code 2 and `TS2688: Cannot find type definition file for 'node'`.
The tracked repository does not contain a root `package.json`. The editor dependency environment was unavailable.
This check is blocked, not passed. No dependencies were added or installed to hide that limitation.
The new `.mjs` structural tests are outside the existing TypeScript include patterns.

No CI workflow is present at the baseline. CI is not reported as passed.
No OpenCode executable or authenticated model session was available on this host.
Native discovery, live delegation, and end-to-end behavior remain unverified.
The current model pins and permission configuration were not changed or re-certified.

A self-review checked scope, conflicting instructions, source attribution, and the permission boundaries.
It is not an independent reviewer run. Obtain the applicable code, language, and security reviews before merge.
The full official ASD-STE100 dictionary and rules were unavailable; formal compliance was not verified.

## Local activation checks

1. Review the branch diff and the [synthesis](WORKFLOW-SYNTHESIS.md). Complete the outstanding reviews.
2. Back up the active global configuration. Preserve local overrides and credentials.
3. Merge the changed agent, command, and skill files into a disposable configuration first.
   Include existing `references/` and supporting license files. Do not copy `.opencode/` maintenance documents.
4. Use the existing authenticated provider. Confirm the installed OpenCode version and available model pins.
   Do not enable an API-billing fallback merely to complete these checks.
5. Restart OpenCode in a disposable work project. Confirm `lead`, the commands, and the named skills are discovered.
6. Run `/plan` on a small behavior fix. Confirm the planner remains read-only and returns acceptance examples.
   Confirm implementation waits for the existing design-review and user-approval gates.
7. Approve the small test change. Observe an intended red test, then green and the required independent reviews.
8. Run `/verify`. Confirm it does not create a nested lead task. Check PASS, FAIL, BLOCKED, and SKIP reporting.
9. Save `/checkpoint smoke-task`. Verify the destination is in the work project and contains no secrets.
   Change a cited source file in that disposable project, then run `/resume-work <handoff-path>`.
   Confirm the saved evidence is marked stale rather than silently reused.
10. Run `/finish`. Confirm it reports remaining blockers without committing, pushing, opening a PR, or merging.
11. Run `/explain <feature>` and `/quiz <topic>`. Confirm they do not edit code or create a quiz-based merge gate.
12. Check a leaf agent's denied Task target and an approved parent's permitted target.
    Stop if behavior differs from the existing allowlist; do not widen permissions to make the smoke test pass.

These steps are a manual checklist, not results already observed.
Stop after the task budget is exhausted or an access limit blocks progress.

## Rollback

Before activation, leaving the branch unmerged leaves `main` and the active setup unchanged.
After a local trial, restore the backed-up configuration files and restart OpenCode.
For files newly introduced by the trial, remove only the confirmed trial files after approval.
Do not delete work-project checkpoints or unrelated local changes.
If the change is merged, use a normal revert through review. Do not rewrite published history.
