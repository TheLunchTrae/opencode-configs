# Response format catalog

The supplied contracts define canonical task responses. Agents select profiles without duplicating their structure.
Profiles share the Common task response envelope and define their own `Result` sections.

| Task | Profile |
| --- | --- |
| Source research, inspection, or checks without repairs | `research` — Research response |
| Implementation planning and acceptance slices | `plan` — Plan response |
| Architecture proposals and trade-offs | `design` — Design response |
| Implementation, simplification, or cleanup | `implementation` — Implementation response |
| Code, security, language, or architecture review | `review` — Review response |
| Documentation and codemap updates | `documentation` — Documentation response |
| Performance investigation and optimization | `performance` — Performance response |

Before delegation, apply the supplied common structure and applicable profile. Name the expected profile in the assignment.
For review assignments, apply the supplied Reviewer Standards and Review Criteria
to interpret reviewers' conduct and reports. Those rules govern the review assignment.
The coordinator retains its own role and permissions.
Research-only assignments use the research profile. For a built-in agent without a local prompt, explicitly instruct it
to use the profile and common structure, and include those requirements in its assignment.
Assignments still need sufficient inputs, scope, permissions, and acceptance conditions.

On return, check required sections, assigned scope, source state, citations, check evidence, and unresolved items.
Request missing information within budget or report the gap. Absent sections do not establish success.
Validate evidence before incorporating it. Preserve supplied versus personally observed evidence when consolidating.
Task `COMPLETE` does not imply passing checks or a passed review. A required review needs both a complete assessment
and a `PASSED` verdict; verification gaps still need separate resolution under the applicable task requirements.
Only the coordinator applies its workflow, approval, and routing rules to the result.
