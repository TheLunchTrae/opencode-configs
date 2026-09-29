# Delegation Contract

Common assignment requirements. The current agent file and configured permissions determine whether it can delegate,
to whom, for which purpose, and at what depth. This reference grants no authority.

Read `@agent-prompts/response-formats/catalog.md` and the expected response profile before delegation.
Make each assignment self-contained without copying whole transcripts or repositories:

- Desired outcome and approved scope or plan revision.
- Acceptance examples and preserved invariants.
- Relevant source paths, revision, context, and prior findings.
- Owned files and shared or forbidden files; research-only assignments must say no edits.
- Dependencies, ready conditions, permitted checks, and expected baseline.
- Verification limits, their decision source, and any conditions for continuing without checks.
- Remaining budget and stopping conditions.
- Expected response profile and any task-specific evidence requirements.

Pass task facts and constraints, not the assigning agent's identity or upstream workflow instructions.
An assignment does not require knowledge of who invoked it. Preserve rationale and applicable authorization.
For research-only work, explicitly require the research response profile and prohibit edits and mutating commands.
For assigned verification, specify permitted checks and expected artifact side effects without authorizing repairs.
Validate returned structure and evidence using the catalog. Distinguish observed checks from proposed or supplied
evidence, and task completion from review verdicts or passing checks. Apply routing and approval rules yourself.
For multi-session work, use the project's existing planning location; do not store project state in global configuration.
