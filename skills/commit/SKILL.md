---
name: commit
description: "Stage and commit changes"
---

Stage and commit the specified changes. Follow these steps:

1. Run `git status` to review what is staged and unstaged.
2. If $ARGUMENTS specifies files or a scope, stage only those. Otherwise stage all relevant changes.
3. Run `git diff --cached` to review what will be committed. Scan for potential secrets or credentials — API keys, tokens, passwords, connection strings, private keys. If anything suspicious is found, stop and flag it to the user before proceeding.
4. Write a concise commit message focused on the "why" not the "what". Use a HEREDOC to pass it.
5. Commit and confirm success with `git status`.

Repository-level AGENTS.md instructions take precedence over these defaults.

$ARGUMENTS

## Gotchas

- The secret scan in step 3 is a hard stop, not a warning. If it fires on a real secret, unstage the file and re-run — do not bypass.
- Only files matching `$ARGUMENTS` are staged when `$ARGUMENTS` is non-empty. Untracked files won't be picked up unless you name them.
- Won't resolve merge conflicts. If the working tree has unresolved conflicts, abort and surface them to the user.
- Pre-commit hook failures leave the commit uncreated; do not amend the previous commit to "recover" — fix the issue and create a new commit.
