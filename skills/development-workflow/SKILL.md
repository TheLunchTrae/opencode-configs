---
name: development-workflow
description: Start the lead-owned implementation workflow for planning, bounded work, review, and handoff.
---

# Development workflow

Use this skill in the active `lead` session. Follow the workflow in [the lead agent](../../agents/lead.md).
The lead owns route selection, approvals, specialist routing, retry limits, review gates, and shipping authorization.
Do not create a nested lead. If the caller is another agent, return the request through the caller to the lead.
Load only the supporting skills needed for the selected route.

Retain [the MIT notice](LICENSE-pstack.txt) with the adapted workflow in the lead prompt.
