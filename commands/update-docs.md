---
description: Update documentation to reflect code changes
agent: doc-updater
subtask: true
---

Keep documentation synchronized with code changes.

Process: identify modified files via `git diff --name-only` → locate relevant docs →
update to reflect implementation changes → verify accuracy.

Scope:
- README: setup steps, capabilities summary, configuration options
- API docs: endpoint descriptions, request/response formats, error codes
- Code comments: function docs, complex logic explanations
- Guides: how-to content, design rationale, troubleshooting

Standards: follow ASD-STE100 Simplified Technical English for all technical
documentation created or revised. Use the project's specified issue, or Issue 9
(January 15, 2025) if none is specified. Keep content current and accurate; include
working examples; handle edge cases. Preserve exact code, identifiers, commands,
paths, URLs, literal values, and quotations. Review prose against the official
writing rules and dictionary. Report unresolved deviations. If the official
reference is unavailable, state that compliance could not be verified. Do not
claim verified compliance from a general language review alone. Update
documentation alongside code, not as an afterthought.

$ARGUMENTS
