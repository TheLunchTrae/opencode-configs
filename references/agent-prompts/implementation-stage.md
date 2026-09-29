# Implementation stage

Use only under the active lead's approved implementation scope and `@agent-prompts/lead-contract.md`.

Dispatch the matching specialist with `@agent-prompts/delegation-contract.md`. Pass the reviewed and approved plan,
rationale, acceptance examples, owned files, dependencies, and existing checks.
Include verification limits and stopping conditions.
Use `test-first` for testable behavior changes and characterization checks for refactors within that verification scope.
For verification suites, pass the approved coverage map and `verification-tests`. Reuse sufficient existing coverage.
For performance work, use `measured-performance` and compare matching workloads and conditions.
A candidate result is not accepted work until integration and review finish.

Include necessary documentation in the planned file scope. When behavior or interfaces change, route affected user
or developer documentation to `doc-updater` before final verification. Preserve the same scope and approval boundaries.

Start with one writer. Allow at most two writers for independent acceptance targets with disjoint file ownership.
Serialize shared configuration, schemas, generated files, and lockfiles. Separate contexts can share files.
Use permitted existing worktrees only with clear branch ownership; never overwrite unrelated work.
Research and reviews may run in parallel on stable inputs. Do not start dependent tasks early.
Verify the integrated result after parallel work.

For authorized durable tracking, use the project's existing planning location and statuses such as planned, ready,
active, review, done, or blocked. Do not store project state in global configuration.
Carry the lead contract's finite repair budget. On a material design blocker, return to design review and user approval.

## Specialist selection

Use only targets permitted by the active lead. This table describes roles, not an authorization grant.

| Scope | Specialist |
| --- | --- |
| TypeScript / JavaScript; React / Next.js / Remix | `typescript-developer`; `react-developer` |
| Go | `go-developer` |
| C# / .NET; Entity Framework Core | `csharp-developer`; `efcore-developer` |
| PHP; Laminas / Mezzio; Doctrine | `php-developer`; `laminas-developer`; `doctrine-developer` |
| GitHub Actions; GitLab CI | `github-actions-developer`; `gitlab-ci-developer` |
| Simplification; dead code | `code-simplifier`; `refactor-cleaner` |
| Performance; documentation | `performance-optimizer`; `doc-updater` |
| Bounded general work; exploration | `general`; `explore` |
