# OpenCode configuration maintenance

## Scope

This repository supplies reusable global OpenCode configuration. Root `AGENTS.md` ships to every session.
Keep repository-only maintenance rules here; `.opencode/opencode.jsonc` loads this file through `instructions` in V1.
Read this file explicitly in V2, whose instruction loading differs. Do not move maintenance rules into global config.
Keep `README.md` to a brief personal-configuration description, except for required license notices.
Do not add a usage guide or store task reports, private conversations, or research dumps here.
Read affected source before editing. Follow root authorization, tool-selection, security, and verification rules.

## Configuration and prompts

- Native agent files own prompts, modes, colors, ordered group membership, and final permission exceptions.
  `opencode.jsonc` owns global defaults, built-ins, plugin registrations, and native boundaries.
  `config-composer.jsonc` owns shared groups, named patches, model aliases, and profiles.
- Preserve provider/model choices unless explicitly requested. Inspect installed dependencies and current native
  behavior before changing runtime assumptions. Do not infer loading or permissions from JSON parsing alone.
- Preserve system edit approval, title/compaction `options.reasoningEffort`, global edit/Task denials,
  ordered shell rules, and secret Read guards. Distinct permission patterns combine; exact replacements move last.
- Builder is the primary integrator. Planner/reviewers are read-only leaves. Built-in general is an editing worker;
  explore retains native restrictions. Keep delegation exact and deny by default. No routes from reviewers to writers.
  Verify transitive reachability and the depth ceiling without granting tools to make a check pass.
- Skills are native `skills/<name>/SKILL.md` files with discoverable descriptions. Load stack guidance only for
  relevant work. Do not recreate language personas, automatic stage fan-out, or universal response envelopes.
- Use Prompt Composer for shared implementation/review fragments. Includes belong explicitly in agent/command bodies.
  Conditional references remain under the hidden `agent-references` reference in `references/agent/`.
  Verify moved-file consumers and includes during migrations; hidden visibility grants no permission.
- Skill includes expand only through the native `skill` tool, not raw reads or skill-derived slash commands.
  Keep required references and fragments with standalone skills. Skills cannot override role or authorization limits.
- OpenCode loads global instructions for task sessions; children do not inherit parent role prompts.
  Built-ins without authored prompts must retain native fallback prompts.
- Keep utility commands in the selected role. `/test-audit` explicitly invokes a fresh reviewer subtask.
  Preserve `$ARGUMENTS`, the native `/resume` selector, and `/resume-work` handoff behavior.
- Register pinned Config Composer and Prompt Composer packages once each in both server/TUI lists, in that order.
  Use Config Composer's installed schema. Its only plugin option is `configFile`; Prompt Composer uses `prompts/`.
  Keep runtime metadata out of provider request options. Do not add compatibility layers for removed roles.
- `/profiles` selects default/shared-only/named worktree choices. Selection persists outside definitions.
  Shared-only retains shared permissions and fixed system settings, without profile alias variants.
  Restart the server after editing definitions, prompts, or native files. Existing sessions may retain model selections.
- `/view-prompts` is read-only, shows full loaded agents/commands, and does not expose full model context or skills.
  Inspect loaded text and diagnostics after restart; host hook errors can leave unresolved includes.
- Keep GitHub/Playwright MCP typed and disabled without credential interpolation. Do not inspect secrets for verification.
  V2 ignores V1 plugins and top-level `subagent_depth`; a V2 port is separate work.

## Plugin tooling

Keep local plugin entrypoints in `plugins/` unless a documented loader or runtime constraint requires another location.
Keep shared helper modules outside auto-discovered plugin directories so their exports are not treated as plugins.
Document placement exceptions in source or these maintenance notes. Verify native discovery before moving or
registering entrypoints, and do not register an auto-discovered entrypoint again.

Run `npm ci` before editing plugins/extensions. Use workspace TypeScript and preserve compiler/OpenTUI JSX settings.
The DOM library supports Solid declarations; runtime ESLint globals remain limited to Node.js.
Keep npm, pinned dependencies, loader-required exports, and Promise-returning hooks. Explain narrow lint suppressions.

| Command | Purpose |
| --- | --- |
| `npm run check` | Type check, strict lint, formatting check, and unit tests. |
| `npm run format` | Format plugin/extension code, tests, and tooling configuration. |
| `npm run test:native` | Install and verify newest supported V1 runtime, then exercise native integration. |
| `npm run test:native:minimum` | Same checks on oldest published supported runtime. |
| `npm run test:package` | Fresh registry install, extension independence, and minimum/current native checks. |

Use Node 22.18 or newer. Rendered bookmark tests need Bun (`BUN_BIN` can override PATH).
Native installation supports x64 Linux/Windows. Source TUI activation needs Linux `script`; report skips elsewhere.
Set `npm_config_cache` to a writable task-local directory when necessary.

Keep meaningful tests for local plugin and extension behavior. Do not add unit or native snapshot assertions for
personal config shapes, fixed agent names/counts, model inventories, or exact permission maps.
Use ad hoc reference and permission inspection during migrations. Native integration should exercise behavior such
as profile application/persistence and real panel activation. Composer internals belong in their owning repositories.
The optional `CONFIG_CONSUMER_EVIDENCE` prefix captures native diagnostic JSON for manual migration inspection.
It is not a snapshot oracle. Report native loading separately from model-assisted execution.
Do not send paid provider requests or use real credentials in test fixtures.

The native runner selects from the published supported range and uses fresh temporary state. Registry/installation
failures stop the run; do not silently fall back to a cached binary. Report unavailable checks and preexisting failures.
Package validation copies the checkout, installs its lockfile, hides Config Composer for local extension tests,
then restores it for native checks. It must not mutate installed-user configuration.

## Plugin contracts

Read `plugins/block-secrets.ts`, `extensions/security/secret-paths.ts`, and their tests before modifying them.
Secret path patterns are shared with `git_inspect`. Preserve path keys `filePath`, `file_path`, and `path`;
`pattern` is a path only for glob. Match case-insensitively and normalize backslashes. A complete `secrets` segment
overrides template basenames. Reject calls even when the error toast fails. Keep denial diagnostics accurate.
Bash token checks are heuristic; expansion, aliases, symlinks, and parent-directory searches limit protection.
`plugins/scrub-secrets.ts` blanks variables only for session shell calls; keep terminal panels unscrubbed.
Use synthetic credential-shaped values in its tests.
Do not describe the plugin as a sandbox.

Session tools live in `extensions/session-tools/` with shared UI helpers outside auto-discovered plugin directories.
Their TUI-only entrypoints are registered in `tui.jsonc` and stay outside server plugin auto-discovery.
Keep config/context views read-only and preserve evidence limits. Bookmark storage stays scoped by project,
workspace, directory, and session; preserve malformed records on errors. Handoff drafts require explicit copy
and must never submit prompts automatically. Do not add workflow-stage tracking to these panels.

## Documentation and third-party material

Read `@agent-references/asd-ste100.md`; apply repository rules first. Use LF, readable Markdown, and 120-character
lines except indivisible URLs or literals. Preserve code, paths, identifiers, uncertainty, and requirement strength.
Use two spaces for YAML indentation. Keep skill bodies concise without weakening safeguards.
Before adapting third-party text, inspect the source and license. Required notices belong in `notices/` with covered
files identified in the README. Keep the root license separate and include notices with standalone distributions.
Do not add licenses merely for general ideas or independently authored guidance.
