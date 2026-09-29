# Tool Selection

Apply this policy to every task, including exploration, implementation, review, and verification.
It does not grant permissions or expand the agent's role or the user's authorization.

## Dedicated tools

Always use dedicated built-in tools for the operations they support:

| Operation | Tools |
| --- | --- |
| Read files or list directories | `read` |
| Find file paths | `glob` |
| Search file contents | `grep` |
| Create or modify files | `write`, `edit`, `apply_patch` |
| Retrieve web information | `webfetch`, `websearch` |

Use enabled dedicated service tools for supported integrations. Follow each tool's permissions and limits.
Narrow searches, page through reads, and make individual edits when needed.
Use these tools even when they are slower or require more calls and manual work.
Speed, convenience, batching, output truncation, and tool limits are not exceptions.

## Prohibited shortcuts

- NEVER create or execute ad hoc scripts or inline code for task inspection, extraction, file changes, or verification.
- Never substitute shell commands for dedicated tools. This includes shell-based file reads, searches, and edits.
- Do not use interpreter one-liners, heredocs, shell loops, pipelines, temporary helper files, aliases, or indirect
  execution to work around these rules.
- The prohibition applies to Bash, Python, Node.js, PowerShell, Ruby, PHP, and other shells and runtimes.
  Examples include `python -c`, `node -e`, `ruby -e`, `php -r`, and `bash -c`.
- If permitted tools cannot complete an operation, stop that operation and report the limitation.
  Do not invent a script fallback, route prohibited work through another agent, or bypass a tool denial or approval.

## Project commands and deliverables

Standard build, test, lint, formatter, static-analysis, documentation-generation, and Git commands remain available
within the agent's role, permissions, and required approvals. Use existing project scripts only for their established
purpose. Never use these commands or scripts as substitutes for dedicated tools or as workarounds for this policy.

Implement requested application code, tests, and project scripts with the editing tools when authorized.
Do not create helper files merely to reclassify a prohibited shortcut as an existing project script or deliverable.
