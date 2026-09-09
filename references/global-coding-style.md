# Global Coding Style

These are generic, cross-project style defaults. Project-specific conventions,
language style guides, and repository rules always override them.

## Immutability (CRITICAL)

Create new objects; never mutate existing ones. Immutable data prevents hidden
side effects, makes debugging easier, and enables safe concurrency.

## Core Principles

- **KISS** — prefer the simplest solution that works; optimize for clarity over cleverness.
- **DRY** — extract repeated logic once the repetition is real, not speculative.
- **YAGNI** — don't build abstractions before they're needed. Start simple; refactor under real pressure.

## File Organization

Many small files over few large ones. High cohesion, low coupling. 200–400 lines
typical, 800 max. Organize by feature/domain, not by type.

## Error Handling

Handle errors explicitly at every level. User-friendly messages in UI-facing
code, detailed context in server logs. Never silently swallow errors.

## Input Validation

Validate at system boundaries. Use schema-based validation where available. Fail
fast with clear messages. Never trust external data (user input, API responses,
file content).

## Naming Conventions

- Variables and functions: `camelCase` with descriptive names
- Booleans: `is`, `has`, `should`, or `can` prefixes
- Types, interfaces, components: `PascalCase`
- Constants: `UPPER_SNAKE_CASE`
- React hooks: `use` prefix

## Smells to Avoid

- Deep nesting — use early returns once logic stacks past 3–4 levels
- Magic numbers — name meaningful thresholds, delays, limits
- Long functions (>50 lines) — split into focused pieces
- Large files (>800 lines) — extract modules
