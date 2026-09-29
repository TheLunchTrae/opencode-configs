# Response format catalog

This directory defines canonical task responses. Agents select profiles without duplicating their structure.
Profiles share `@agent-prompts/response-formats/common.md` and define their own `Result` sections.

| Task | Profile |
| --- | --- |
| Source research, inspection, or checks without repairs | `@agent-prompts/response-formats/research.md` |
| Implementation planning and acceptance slices | `@agent-prompts/response-formats/plan.md` |
| Architecture proposals and trade-offs | `@agent-prompts/response-formats/design.md` |
| Implementation, simplification, or cleanup | `@agent-prompts/response-formats/implementation.md` |
| Code, security, language, or architecture review | `@agent-prompts/response-formats/review.md` |
| Documentation and codemap updates | `@agent-prompts/response-formats/documentation.md` |
| Performance investigation and optimization | `@agent-prompts/response-formats/performance.md` |

Before delegation, read the common structure and the applicable profile. Name the expected profile in the assignment.
Research-only assignments use the research profile. For a built-in agent without a local prompt, explicitly instruct it
to read the profile and common structure, or include their requirements if those references are unavailable.
Assignments still need sufficient inputs, scope, permissions, and acceptance conditions.

On return, check required sections, assigned scope, source state, citations, check evidence, and unresolved items.
Request missing information within budget or report the gap. Absent sections do not establish success.
Validate evidence before incorporating it. Preserve supplied versus personally observed evidence when consolidating.
Task `COMPLETE` does not imply passing checks or a passed review. A required review needs both a complete assessment
and a `PASSED` verdict; verification gaps still need separate resolution under the applicable task requirements.
Only the coordinator applies its workflow, approval, and routing rules to the result.
