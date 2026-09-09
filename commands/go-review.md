---
description: Review Go code for idiomatic patterns and best practices
agent: go-reviewer
subtask: true
---

Review Go code for idiomatic patterns, error handling, concurrency, and performance.

Idiomatic patterns: package names lowercase with no underscores; variables camelCase and short;
interfaces named with "-er" suffix; composition over inheritance.

Error handling: errors wrapped with context using `fmt.Errorf("...: %w", err)`; no silently
ignored errors; sentinel errors and custom types used appropriately.

Concurrency: goroutine lifecycle managed; channels buffered appropriately; `-race` flag used
to detect data races; contexts used for cancellation.

Performance: unnecessary allocations avoided; `sync.Pool` considered for frequent allocations;
receiver types chosen based on struct size.

Supplement with `go vet` and `staticcheck`. Report findings by severity with file, line, and
specific improvement suggestions.

$ARGUMENTS
