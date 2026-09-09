---
name: push
description: "Push the current branch to the remote"
---

Push the current branch to its remote. Follow these steps:

1. Run `git status` to confirm the working tree is clean and there are no uncommitted changes that should be included.
2. Run `git branch -vv` to check whether the current branch already tracks a remote branch.
3. Push:
   - If a tracking branch exists: `git push`
   - If no tracking branch: `git push -u origin <branch-name>`
4. If the push fails due to a network error, retry up to 3 times with brief pauses between attempts.
5. If the push is rejected (non-fast-forward), stop and report the situation to the user — do not force-push unless explicitly instructed.
6. Confirm success by reporting the remote URL and branch that was pushed to.

Repository-level AGENTS.md instructions take precedence over these defaults.

$ARGUMENTS

## Gotchas

- The retry loop in step 4 covers network errors only. Auth, permission, or repo-not-found failures fail fast — do not retry them.
- Non-fast-forward rejections in step 5 stop the skill. Never force-push to recover unless the user has explicitly authorized it for this push.
- First push to a new branch needs `-u origin <branch>` (handled in step 3); skipping the upstream flag leaves the branch untracked locally.
