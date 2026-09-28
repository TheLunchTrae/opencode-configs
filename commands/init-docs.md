---
description: Initialize or refresh repository documentation rules and scoped technical vocabulary.
subtask: false
---

Initialize the current work repository's documentation settings for this request:

$ARGUMENTS

Read `@agent-prompts/asd-ste100.md` for precedence, writing defaults, terminology, and formal-compliance requirements.
Follow the selected agent's role, permissions, and approval policy. Do not switch agents or expand its authority.
If the selected role cannot perform initialization, return the proposed setup within that role's scope.

## Resolve the destination

1. Establish the work repository's root and requested scope using available read-only tools.
   Do not initialize an installed global configuration directory or a repository that supplies global configuration.
   If the work-repository boundary is unclear, resolve it before proposing file writes.
2. With no destination argument, use `AGENTS.md` at the repository root.
   Add or update documentation rules in that file when it exists. Create it when it does not.
3. If the user supplies a file path, use that file instead of the default.
   If the user supplies a directory, use `AGENTS.md` inside that directory.
   Resolve relative paths from the repository root. Absolute paths must remain inside the same repository.
   Treat a non-existent path with a trailing slash as a directory. Clarify other ambiguous destinations before writing.
4. Treat remaining arguments as scope or preferences. Keep every resolved destination inside the work repository,
   including symlink targets. Do not interpret arguments as shell commands.

## Inspect current policy and vocabulary

Read the destination, applicable agent instructions, contribution guides, documentation policies, templates, glossaries,
and existing documentation-tool configuration. Preserve authoritative standards and link to existing term definitions.
Do not create competing copies of established policy or vocabulary.

Inspect manifests, representative source, public APIs, and documentation for the requested areas.
Identify languages, frameworks, naming conventions, and domain terms from current evidence.
Do not infer a stack solely from filenames or populate a generic language dictionary.
Identify conflicts and gaps. Preserve explicit definitions, exclusions, and local overrides.
Keep different meanings scoped to their language, package, path, or domain.

Before creating an `AGENTS.md`, check existing `CLAUDE.md` or other fallback instructions that it could mask.
Preserve their effect with an explicit read instruction when needed. Do not replace them with a partial policy.
For a nested destination, respect its actual instruction scope and applicable ancestor rules.

## Propose the rules

Add or update a bounded documentation section in the selected file. Preserve all unrelated instructions.
Include concise, usable rules in that section, not only a link to the global reference.
Use the shared STE defaults for choices that the repository leaves unspecified.
Keep the section specific to the repository rather than copying the full global reference.

Include:

- Applicable documentation scope and the current authoritative style guides or templates.
- Repository preferences and deliberate exceptions to the shared STE defaults.
- Core writing rules: consistent terms, clear actors, separate instructions, and explicit conditions.
  Preserve actions that must occur simultaneously.
- Sentence-length guidance and preservation of meaning, uncertainty, requirement strength, and exact literals.
- The local terminology entries or an explicit instruction to read an existing terminology source.
- Formal STE requirements and the specified issue only when the user or repository explicitly requires them.
- Existing documentation checks and actual commands when relevant.

Treat local terminology as a technical-word allowlist and usage glossary that supplements ordinary English.
It does not replace ASD's official approved-word dictionary.
Propose a small set of terms actually used in the requested scope, with these fields:

| Field | Required content |
| --- | --- |
| Term | Preferred spelling and case, including exact identifiers when needed. |
| Kind and meaning | Noun, verb, acronym, or identifier, with its repository-specific definition. |
| Scope | Applicable language, framework, package, path, or domain. |
| Usage | Required wording and known misleading alternatives, when supported by repository evidence. |
| Source | A verified repository path or authoritative definition that supports the entry. |

Keep new entries in the selected file unless the repository already maintains a terminology source.
In that case, reference the current source and include any necessary edits to it in the proposed scope.
Keep inferred terms as proposals until reviewed. Leave unsupported definitions unresolved instead of inventing them.
Preserve established technical terms even when they fall outside a plain-language vocabulary.
Do not convert prose alternatives into code-renaming instructions or import ASD's full dictionary.

For a custom destination, check how agents will read it. Do not claim that an arbitrary file loads automatically.
Report any required read instruction. Include edits to another instruction file only in the approved setup.

Present the destination, proposed rules, terminology entries, supporting-file changes, and conflicts.
Do this before applying the setup.
Reuse valid approval for that exact scope. Obtain the approval required by the task or repository when it is missing.

## Apply and verify

After the setup is approved, create missing files and merge approved additions into existing ones.
Do not alter global configuration, install tools, or rewrite application documentation as part of initialization.
Do not stage, commit, push, or publish the generated files.

On later runs, retain established definitions and overrides. Update only supported changes or approved new entries.
If the current setup already covers the request, report that no changes are needed.

Verify terminology evidence, scope, literal preservation, and the intended instruction-loading path.
Check relative links, document structure, and applicable existing documentation checks.
Review the diff for lost instructions, unintended policy changes, and unrelated edits.
Report created or updated paths, the applied policy, check results, and unresolved terminology.
