---
name: commit
description: "Stage and commit changes"
---

Stage and commit the specified changes:

1. Run `git status` to inspect staged and unstaged changes. Abort and report unresolved merge conflicts.
2. Stage only files or scope specified by `$ARGUMENTS`; otherwise stage all relevant changes.
   Include untracked files only when named.
3. Review `git diff --cached` for secrets: API keys, tokens, passwords, connection strings, and private keys.
   Stop and notify the user of anything suspicious. Unstage real secrets and repeat the scan; never bypass it.
4. Write a concise commit message explaining why. Pass it with a HEREDOC.
5. Commit, then confirm success with `git status`. If a pre-commit hook fails, fix the issue and create a new commit.
   Never amend the previous commit to recover.

Repository-level AGENTS.md instructions take precedence over these defaults.

$ARGUMENTS
