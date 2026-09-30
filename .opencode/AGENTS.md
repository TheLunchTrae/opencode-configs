# OpenCode Config Repository

## Scope and instruction loading

- This repository supplies reusable global OpenCode configuration and supporting tests.
  Its files can be installed directly in the live global configuration directory.
- Root `AGENTS.md` applies to all OpenCode sessions. Keep repository maintenance guidance in this file.
  Put repository-only configuration in `.opencode/opencode.jsonc`.
- The local config's `instructions` array names `.opencode/AGENTS.md`. V1 resolves that pattern through the
  project directory ancestry. Do not move it into the shipped root config.
- V2 currently accepts `instructions` without loading its entries. When maintaining this repository in V2,
  read this file explicitly; do not assume that the array loaded it.
- Keep README content relevant to users: overview, installation, configuration, a short workflow quick start,
  upgrades, and operational limits.
  Keep the command and skill reference, workflow guidance, and task examples in `USAGE.md`.
  Link to detailed usage instead of maintaining duplicate explanations in the README.
  Keep editing rules, verification procedures, and implementation notes here.
- Describe the current setup directly. Do not add research catalogs, source-comparison reports, task completion
  reports, or references to unrelated private resources. Put change-specific plans and results in the pull request.
- Keep each lead's role and progression policy in its agent prompt. Shared stage procedures belong in composition
  sources or explicitly loaded references. This maintenance file must not become another copy of the runtime workflow.

Read the relevant source before editing it.
Use [the user README](../README.md) and [usage guide](../USAGE.md) to check documented behavior.
Check the installed version against the [V1 documentation](https://opencode.ai/docs/) or
[V2 documentation](https://opencode.ai/v2/docs/). Do not infer runtime compatibility from JSON parsing alone.

## Agents and model settings

- Custom agent `groups`, explicit `model`, and `variant` settings belong in `agents/*.md` frontmatter.
  Root `opencode.jsonc` owns global defaults, the Config Composer server registration, and built-in overrides.
  `config-composer.jsonc` owns shared `sourceDirectories` and agent-specific `agent.modelPresets`, `agent.groups`,
  `agent.prompts.defaults`, and `agent.prompts.overrides`.
  Keep top-level `command` and `skill` objects empty until their composition is supported.
  Reserve those objects for their own member types. Do not apply agent models to them.
  Preserve explicit exceptions. Group inheritance fills missing models before native agent initialization.
- Agent Markdown bodies are prompts. Declare shared fragments with explicit includes at their intended positions.
  Keep the shipped guidance in those bodies. Configuration prepend and append layers remain optional capabilities.
  Do not add a separate `prompt` frontmatter field.
- `workflow-lead` is the default primary agent. Focused leads are alternative primary entrypoints, never children.
  Built-in `build` and `plan` are disabled; custom `planner` is a separate subagent.
- Read the affected agent definitions for identities, models, and permissions. Do not maintain a second allocation
  table or hardcoded role inventory in documentation.
- The existing allocation was checked against OpenCode 1.18.29. Before changing it, inspect current provider
  metadata with `opencode models openai --verbose` when available. Verify model IDs and variant support.
  Metadata is not proof of actual model dispatch or quality.
- Preserve explicit `options.reasoningEffort` defaults for built-in `title` and `compaction`.
  In V1, small calls skip variant selection and request variants can override agent options.
  Keep fallback values aligned with the selected agent variant; do not assume a title setting controls every
  `small_model` call. Check the runtime request path before removing a fallback.
- Check model sampling capabilities before adding temperature settings. A metadata capability of
  `temperature: false` means unsupported; it is not an agent configuration value.
  Do not add null or boolean temperature overrides to the title agent.
- Model-pinned children do not inherit the lead's model. Diagnose the effective configuration and session
  selection before changing pins. Reload or restart after a model change and check the affected route.

## Prompt ownership, commands, and skills

- Apply root `AGENTS.md`'s Instruction Authoring rules to runtime prompts. Compare obligations before and after edits,
  including conditional reads and standalone consumers. Keep behavioral changes explicit and separately reviewable.
- The active lead owns its stage, coordination, approval handling, and user-visible conclusions.
  [The lead contract](../config-composer/agent/prompts/lead-contract.md) supplies lead coordination and
  approval procedures.
  [Planner](../agents/planner.md) owns planning procedure. Each specialist owns its scope and stopping conditions.
- Composition fragments belong in `config-composer/agent/prompts/`.
  Map the `agent-prompts` entry in `sourceDirectories` to that directory in `config-composer.jsonc`.
  Register the same directory once as the hidden native `agent-prompts` reference, with a description,
  for task-specific reads and standalone consumers.
  Keep conditional guidance in `references/agent/`, registered as the hidden native `agent-references` reference.
  Use full paths such as `@agent-prompts/reviewer-standards.md`; verify every referenced file exists.
- Hidden affects interactive visibility. It does not remove agent context or grant tool permissions.
- Config Composer resolves explicit `{{include:@agent-prompts/reviewer-standards.md}}` directives
  and prepend/append fragments when configuration loads.
  Bare `@` references remain conditional reads. Do not expand every reference automatically.
  Agent group prompt content follows the listed `groups` order. Keep model and prompt precedence deterministic.
  Framework agents do not inherit another agent's body. Include shared language guidance in each owning agent body.
  Preserve every condition on task-specific reads.
  Prompt fragments must stay readable without Config Composer because reusable skills can consume them separately.
  Supply required unconditional agent prompt fragments through explicit body includes.
  Prefer body includes. Use configuration prepend/append as a last choice for additional layers.
  Invalid includes must fail configuration loading.
  Standalone skill consumers must explicitly read their required shared guidance.
  Avoid include cycles and duplicate fragments.
  Preserve primary-lead opt-outs from specialist standards and response envelopes.
- Put universal task-agent rules in root `AGENTS.md`. OpenCode loads them for primary and subagent task sessions.
  A child does not inherit its parent's role prompt. Keep role-specific guidance explicit through includes or reads,
  but do not repeat global rules or their read directives in each agent.
  Put conditional reads for universal coding and verification guidance in root `AGENTS.md` too.
  Preserve prerequisites in reusable skills and their reference dependencies when they can be installed separately.
  Keep task-specific reporting fields, role boundaries, and stricter restrictions.
- Canonical task responses belong in `config-composer/agent/prompts/response-formats/`.
  Keep the envelope in `common.md`, task sections in profiles, and the consumer index in `catalog.md`.
  Each specialist includes the envelope and its selected profile in its body.
  Do not duplicate response structures in agent prompts or reusable skills.
  Delegating agents read the catalog and expected profile, then validate returned scope, source state, and evidence.
  Specialists need task context and constraints, not the invoking agent's identity or workflow.
  Keep task completion, review verdicts, and check results distinct. Preserve required empty sections with `None`.
- Lead selection supplies general workflow entrypoints. Keep stage procedures in shared sources or references instead of
  discoverable wrapper skills or generic role commands. Preserve supporting files and notices when moving procedures.
  The focused `/test-audit` command explicitly selects `review-lead` and reuses the `test-audit` skill.
  Keep `subtask: false` so this primary lead is not invoked as a child. Keep audit procedure in the skill.
- Utility commands retain the selected agent and its permissions. Do not silently switch a focused lead to a writer.
  Preserve argument handling and the built-in `/resume` session selector; `/resume-work` consumes a project handoff.
- Skills do not grant permissions. Preserve their supporting files and applicable license notices when moving content.
  Keep project contracts, checkpoints, and lessons in their work project, not in this global configuration.
- `project-standards` handles deliberate tooling and convention changes. Ordinary tests, routine checks, and defect
  fixes do not require adopting new tooling through that skill.

## Third-party material

- Compare the actual source and check its license before copying or adapting third-party text or code.
- Store required third-party notices in the top-level `notices/` directory. Preserve the complete required text,
  and identify the covered files and upstream source in the root README. Create the directory when a notice is needed.
- Keep references used only for inspiration in a short section at the end of the root README.
  Do not add a third-party license solely for general ideas, standard methods, or independently authored guidance.
  Base retention decisions on the material reused and its license, not an earlier attribution label.
- Include applicable notices when distributing covered material, including standalone agents or skills.
  Keep the repository's own root `LICENSE` separate from third-party notices.

## Permissions and delegation

- Preserve explicit Bash `ask` rules. A project wildcard override can coexist with inherited specific rules.
  Do not remove specific rules merely because the global wildcard currently has the same value.
- Keep global Task access denied by default. Exact agent allowlists are authoritative; do not expand them during
  documentation cleanup or infer permissions from a role description.
- Planning and review leads must not have delegation routes to editing agents. No lead may delegate to another lead.
  Verify transitive reachability as well as each lead's direct allowlist.
- Preserve leaf restrictions and the configured depth limit. When changing permissions, verify that leaf delegation
  is denied and approved parents can reach only their listed targets in a fresh session.
- Research-only assignments limit the task, not the developer's edit capability. Preserve the parent's sole-editor
  requirement and validation of citations, scope, and uncertainty in the relevant agent prompts.
- Keep GitHub and Playwright MCP definitions typed and disabled, without credential-file interpolation.
  V2 discards enabled-only V1 MCP entries without a `type`; `{ "enabled": false }` is not a portable disable rule.
- Never inspect or inline secret files while checking configuration.

## Plugin tooling

Run `npm ci` from the repository root before editing plugins or extensions. Use the workspace TypeScript version
in the editor. Reopen the project or restart its TypeScript service if dependencies remain unresolved.
Preserve the TypeScript compiler settings and OpenTUI JSX import source.
The DOM type library supports Solid's declarations. ESLint runtime globals remain limited to Node.js.

| Command | Purpose |
| --- | --- |
| `npm run lint` | Run strict type-aware ESLint checks with zero warnings. |
| `npm run lint:fix` | Apply available ESLint fixes. Review the changes. |
| `npm run format` | Format plugin and extension code, tests, and tooling configuration. |
| `npm run format:check` | Check formatting without changing files. |
| `npm run check` | Run type checking, lint, formatting checks, and `npm test`. |

Formatting uses single quotes, semicolons, two-space indentation, LF endings, and a 120-character print width.
Markdown prompts are excluded. Git normalizes text files and checks them out with LF on every platform.
Binary files retain automatic detection.

Keep loader-required default exports and Promise-returning host hooks. Use narrow, justified lint exceptions
when these contracts or terminal UI APIs require them. Each suppression must name the rule and explain its reason.
Do not replace npm, adopt Effect, or change the runtime APIs solely to match the upstream standards.

## Plugin maintenance

Read [block-secrets.ts](../plugins/block-secrets.ts) and its tests before changing the plugin.
Preserve these contracts:

- Check `filePath`, `file_path`, and `path`; treat `pattern` as a path only for glob.
- Normalize backslashes and match case-insensitively, including on POSIX systems.
- A complete `secrets` path segment takes precedence over allowed template basenames.
- Bash token checks are heuristic. They do not parse shell expansion or resolve symlinks and aliases.
  A search from a parent directory can avoid a sensitive path argument.
- Reject the tool call even when the best-effort error toast fails.
- Keep the user-facing error's documentation pointer aligned with the README's secret-path protection section.
  Document access limitations there; do not describe the plugin as a sandbox.

The current plugin uses the V1 `@opencode-ai/plugin` hook API. A V2 port is a separate implementation change.
V2 also ignores top-level `subagent_depth`; its supported setting is `experimental.subagent_depth`.
Consult the [migration guide](https://opencode.ai/v2/docs/migrate-v1/) and verify behavior before claiming V2 support.

Config Composer entrypoints are in `extensions/config-composer/`, outside auto-discovery, and explicitly registered in
the server and TUI configuration files. Keep their runtime metadata out of provider request options.
Register the server with `configFile: "config-composer.jsonc"`.
Relative `sourceDirectories` paths resolve from that file's directory.
Keep `schema.json` in `extensions/config-composer/` and point the dedicated configuration's `$schema` field to it.
Keep the schema, dedicated configuration, extension, sources, references, and templated prompts compatible
during upgrades.
Preserve customized Config Composer files.
Legacy inline options remain an upgrade route, not a second registered instance.
Dedicated files use the structured shape.
Keep agent settings under `agent` and shared source mappings at the top level.
Reject mixed old and structured file layouts.
Built-in agents without authored prompts must retain native prompts. Do not add prompt defaults to them.
The settings editor must preserve unrelated configuration, prompts, comments, explicit exceptions, and permissions.
Group names and membership are discovered from configuration; do not hardcode a group inventory in the UI.
Use the provider API for model and variant choices. Do not synthesize model IDs from display names.
The global update API disposes all server workspaces. Keep reload explicit and the current-workspace busy check intact.

Session tool entrypoints are in `extensions/session-tools/`. Register each TUI panel separately in `tui.jsonc`
and the status tool in `opencode.jsonc`. Share helpers without placing them in auto-discovered plugin directories.
Keep workflow stages attributed to completed tool records. Never infer completion or approval from idle status.
Keep config and context views read-only. Show evidence limits instead of inventing provenance or prompt contents.
Bookmark storage must remain scoped by project, workspace, directory, and session. Preserve invalid data on errors.
Handoff drafts reuse checkpoint fields and require an explicit copy action; never submit a prompt automatically.

## Verification

Run applicable existing checks from the repository root:

```sh
npm ci
npm run check
npm run test:native
```

- Configuration tests check metadata, routing, and shared references. They do not launch OpenCode or prove behavior.
- Plugin tests use mocked hooks and synthetic paths. They do not access real secrets or establish V2 compatibility.
- Type checking includes `plugins/**/*.ts`, `extensions/**/*.ts`, `extensions/**/*.tsx`, and `tests/**/*.ts`.
  It does not validate Markdown, JSONC, or `.opencode/` code.
- Root dependency manifests are shipped with the local extension. Keep runtime and development dependencies pinned.
  `.opencode/` dependency manifests remain local editor support. The checks require Node 22.18 or newer.
- Native tests require OpenCode V1 1.18.29 on PATH, or its executable path in `OPENCODE_BIN`.
  They use temporary configuration and a synthetic local provider, with no real credentials or paid model calls.
  They verify inheritance, provider dispatch, live reload, workflow tool loading, and report persistence after restart.
  They do not render terminal dialogs. Use a native TUI check for JSX loading, command discovery,
  and dialog interaction.
  Set `SESSION_TOOLS_KEEP_FIXTURE=1` to retain the session-tools fixture for that check; the test prints its location.
- Report unavailable dependencies and checks explicitly. Do not install unrelated tooling to hide a missing check.
- Check internal links, moved-file consumers, command routing, and unchanged model and permission fields.
  After runtime configuration changes, restart OpenCode and test the relevant discovery and permission behavior
  when the native runtime is available. A harmless approval check must not use real secrets.
- Distinguish source checks, mocked tests, native loading, and model-assisted execution in the pull request.
  Do not claim an independent review for a self-review.

## Markdown and documentation

Read `@agent-references/asd-ste100.md` for technical documentation. Repository documentation rules take precedence.
Use its practical defaults for unspecified choices. Formal-compliance reporting applies when explicitly required.
Preserve code, identifiers, commands, paths, URLs, literal values, and quotations.

- Use LF line endings and GitLab Flavored Markdown.
- Limit lines to 120 characters, except indivisible URLs, literal output, or frontmatter strings.
- Use two spaces for YAML indentation and four spaces for indented code blocks.
- Keep user documentation in the root `README.md` and `USAGE.md`.
  Do not recreate per-directory README instruction catalogs.
