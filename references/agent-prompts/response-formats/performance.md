# Performance response

Read `@agent-prompts/response-formats/common.md`. Use its envelope with these sections under `Result`:

### Objective and hypothesis

State the affected user path, objective, supported bottleneck, and falsifiable hypothesis. Separate measurements from
untested explanations. When required measurement is unavailable, give a measurement plan within scope and identify
the missing prerequisite. For excluded measurements, state the accepted limitation without requiring a new plan.

### Change

Describe the approved change and affected files, or state that no edit was made. Include preserved correctness and
resource-ownership constraints.

### Comparison

For baseline and candidate, record revision, command, input shape and size, environment, cache state, repetitions,
metric, and observed values in `Evidence`. Compare only compatible measurements. Report variance or measurement limits
and the supported user-visible consequence. Do not invent a speedup or generalize a microbenchmark to the application.

Include correctness checks in `Evidence`. Put remaining hypotheses, incomparable or missing measurements, regressions,
risks, and required review in `Unresolved items`. Missing measurements do not establish an improvement.
