# Review Target

Use an explicit target from the user or caller. The active lead may supply a default when the target is absent.
If the target is ambiguous and no default is supplied, ask which scope to review.

| Target | Scope and evidence |
| --- | --- |
| Branch, PR, MR, or merge request | Confirm the target branch and inspect changes since the merge base, such as `git diff target...HEAD`. State unresolved target or ref currency. |
| Staged | Inspect `git diff --cached`. |
| Local | Inspect tracked changes with `git diff HEAD`, plus `git status --short`; read relevant untracked files separately. |
| File path or glob | Resolve and read the named files. State whether the request covers complete files or only changes. |

Do not silently substitute a different target or treat a missing commit/ref as an empty diff.
Read surrounding code needed to assess changed behavior. State the source revision or working-tree scope.
Preserve explicit file restrictions when gathering context. Do not read secret files as review material.
