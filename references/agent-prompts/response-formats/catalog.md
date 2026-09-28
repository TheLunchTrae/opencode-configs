# Response format catalog

This directory is the canonical definition of task responses. Agent prompts select a profile; they do not duplicate
its structure. Profiles share `@agent-prompts/response-formats/common.md` and define their own `Result` sections.

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
The task still needs sufficient inputs, scope, permissions, and acceptance conditions; a profile is not an assignment.

On return, check required sections, assigned scope, source state, citations, check evidence, and unresolved items.
Request missing information within the task budget, or report the gap. Do not interpret absent sections as success.
Validate evidence before incorporating it. Preserve supplied versus personally observed evidence when consolidating.
Task `COMPLETE` does not imply passing checks or a passed review. A required review needs both a complete assessment
and a `PASSED` verdict; verification gaps still need separate resolution under the applicable task requirements.
Only the coordinating agent applies its own workflow, approval, and routing rules to the result.
