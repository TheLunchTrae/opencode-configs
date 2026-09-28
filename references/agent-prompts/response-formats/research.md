# Research response

Read `@agent-prompts/response-formats/common.md`. Use its envelope with these sections under `Result`:

### Answer

Answer the assigned questions or summarize the requested check results. Distinguish source facts from interpretations.
State whether the evidence supports the requested conclusion; do not replace missing evidence with confidence.

### Coverage

State the files, symbols, interfaces, or checks examined and the search boundaries. Identify exclusions and negative
search results with their actual scope. For verification, relate the checks to the behavior they exercise.

Place citations and execution details in `Evidence`. Put unknowns, uncovered scope, and required follow-up in
`Unresolved items`. Do not edit files or run commands that change files during source-only research.
An explicitly assigned verification command can produce normal build artifacts; that does not authorize repairs.
