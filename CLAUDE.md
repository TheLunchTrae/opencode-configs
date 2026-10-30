# Claude Code instructions

@AGENTS.md

@.opencode/AGENTS.md

## Claude Code notes

- Root `AGENTS.md` is the global instruction file this repository ships to every OpenCode session. It also governs
  work in this checkout. `.opencode/AGENTS.md` holds repository maintenance rules; OpenCode loads it through
  `.opencode/opencode.jsonc`, Claude Code loads it through the import above.
- Dedicated tools named in the `AGENTS.md` tool-selection table map to Claude Code tools as follows:
  `read` is `Read`, `glob` is `Glob`, `grep` is `Grep`, `write`/`edit`/`apply_patch` are `Write`/`Edit`,
  `webfetch`/`websearch` are `WebFetch`/`WebSearch`. The prohibited-shortcut rules apply to the `Bash` tool.
- Conditional references under `references/agent/` are addressed as `@agent-references/<file>` in `AGENTS.md`.
  Read them from `references/agent/<file>`.
- Install with `npm ci`. `npm run check` runs typecheck, lint, format check, and unit tests.
  `npm run test:package` validates the packaged consumer.
- `npm run test:native` installs the newest OpenCode release in the `engines.opencode` range from `package.json`
  into a temporary directory and runs `tests/*.native.ts`; `npm run test:native:minimum` uses the oldest release
  in that range. Both need x64 Linux or Windows and npm registry access, and must run through npm.
- This configuration pins `@lunchbox-labs/opencode-config-composer` and `@lunchbox-labs/opencode-prompt-composer`
  in `package.json`, `opencode.jsonc`, and `tui.jsonc`. Their sources are the sibling repositories
  `lunchbox-labs/opencode-config-composer` and `lunchbox-labs/opencode-prompt-composer`. Change the pinned
  versions together in all three files.
