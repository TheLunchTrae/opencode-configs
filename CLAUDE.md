# Claude Code instructions

@.opencode/AGENTS.md

## Shipped configuration is not session guidance

- Root `AGENTS.md` is the global instruction file this repository installs into OpenCode configuration directories.
  It is product content for OpenCode sessions, not instructions for agents working in this checkout.
  Do not follow it in Claude Code sessions. Edit it as a deliverable under the rules in `.opencode/AGENTS.md`.
- The same applies to `agents/`, `commands/`, `skills/`, `prompts/`, and `references/agent/`.
  They configure OpenCode sessions and do not govern this one.
- `.opencode/AGENTS.md` says to follow root authorization, tool-selection, security, and verification rules.
  That sentence does not apply in Claude Code sessions. Use Claude Code's own tool and permission behavior and the
  user's instructions instead. The other rules in `.opencode/AGENTS.md` apply.
- Where `.opencode/AGENTS.md` names `@agent-references/<file>`, read `references/agent/<file>`.

## Commands and dependencies

- Install with `npm ci`. `npm run check` runs typecheck, lint, format check, and unit tests.
  `npm run test:package` validates the packaged consumer and runs the Bun-rendered bookmark test.
- `npm run test:native` installs the newest OpenCode release in the `engines.opencode` range from `package.json`
  into a temporary directory and runs `tests/*.native.ts`; `npm run test:native:minimum` uses the oldest release
  in that range. Both need x64 Linux or Windows and npm registry access, and must run through npm.
- This configuration pins `@lunchbox-labs/opencode-config-composer` and `@lunchbox-labs/opencode-prompt-composer`
  in `package.json`, `opencode.jsonc`, and `tui.jsonc`. Their sources are the sibling repositories
  `lunchbox-labs/opencode-config-composer` and `lunchbox-labs/opencode-prompt-composer`. Change the pinned
  versions together in all three files.
