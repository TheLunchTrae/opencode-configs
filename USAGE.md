# Usage guide

Choose a lead using the [workflow overview](README.md#intended-workflows), describe the outcome and constraints,
and let it coordinate the appropriate specialists. You can ask for a plan alone, implementation of an approved plan,
or a review without edits. State any verification limits with the task; skipped checks are not passing checks.

## Models and prompts

| Command | Purpose |
| --- | --- |
| `/compose-configs` | Select profiles, inspect effective settings, save and explicitly apply changes while idle. |
| `/agent-models` | Edit agent model settings. |
| `/agent-groups` | Edit agent group membership. |
| `/compose-prompts` | Inspect composed prompts and edit optional prompt rules. |

The default `current` profile preserves the existing allocation. `openai-latest` and `anthropic-latest` are optional
model profiles; both preserve the OpenAI background models and global defaults. Check model availability with your
connected provider. Saved profile selections persist per project; they do not change permissions or prompt content.
Existing conversations can retain their selected model and variant: use `/models` and `/variants` after applying a profile.
Restart after editing native agent files or `opencode.jsonc`; applying Composer settings does not reload those files.

Prompt Composer expands shared `prompts/` includes in agent and command bodies at configuration load, and in skills
when OpenCode loads them. Raw reads do not expand includes. Keep the supporting fragments when copying skills.
Use the configuration files for the shipped settings rather than maintaining separate copies of model allocations.

## Inspectors

Open these through the command palette or their slash commands. They are read-only and do not send model requests.
Choose **← Back** or press Escape to return; Escape at the first view closes the panel.

| Command | What you get | Limits |
| --- | --- | --- |
| `/inspect-config` | Choose an agent and compare server-resolved settings, workspace/global defaults, and its last recorded model. | Native APIs do not provide exact file provenance or explain Composer inheritance. Recorded models describe past turns. |
| `/inspect-context` | Latest completed successful request usage, plus recorded attachments, successful Read/Skill calls, and compactions. | Requires an open session; at most 200 recent messages. History is not proof that content remains in the current model context. Use **Refresh** after activity. |

The config view omits credentials and raw configuration. Use Composer commands for model/group or prompt settings.
The context view does not show the exact assembled prompt or per-file token counts; available skills are not assumed loaded.

## Bookmarks and handoff drafts

Open a session, then:

1. Run `/bookmark` to choose a recent message or create a manual note. Select **Note**, **Plan**, **Decision**, or
   **Question**, then enter a label and editable excerpt.
2. Use `/bookmarks` to edit or remove notes and choose which to include in a handoff.
   **Open source session** checks the linked message and opens its conversation; it does not jump to that message.
3. Choose **Build editable handoff draft** or run `/session-handoff`. Edit the draft and press **Ctrl+Y** to copy
   a `/checkpoint` request. Paste it into the composer, review it, and submit it yourself.

Bookmarks persist in local TUI storage, scoped to project, workspace, directory, and session. They survive restarts
on that installation but do not sync between machines. Limits: 100 bookmarks per session, 120-character labels,
2,000-character notes, and 20 selected notes per handoff. Keep credentials out of notes.

The draft supplies selected notes and source IDs alongside checkpoint prompts. It does not verify source state,
tests, or approvals, submit a message, or save a project file. Clipboard copying depends on terminal support;
otherwise copy the draft manually. **Prepare resume request** in `/bookmarks` asks for an existing handoff path
and copies a `/resume-work` request; it does not load or validate the file itself.

## Checkpoint and resume

These agent commands are separate from the bookmark plugin:

- `/checkpoint <task-id or context>` asks the active agent to save an authorized handoff in the work project,
  preserving existing notes. It records scope, source state, decisions, evidence, blockers, and the next action.
  A planning or review lead returns the handoff in chat when it cannot write files.
- `/resume-work <handoff-path>` checks that saved handoff against current instructions, source state, ownership,
  approvals, and review evidence before continuing within the selected lead's role.

Neither command switches agents or grants new authority. Saved approval text is not a new permission grant.
`/resume-work` is distinct from OpenCode's built-in `/resume` session selector.

## Other commands and skills

| Command | Purpose |
| --- | --- |
| `/project-standards [context]` | Propose standards and tooling appropriate to the work project; approve changes before implementation. |
| `/init-docs [path or context]` | Prepare repository documentation rules and terminology, normally in the work project's `AGENTS.md`. |
| `/explain [context]` | Explain code behavior and relevant evidence. |
| `/quiz [context]` | Ask learning questions about the code. |
| `/test-audit [context]` | Select `review-lead` for an assessment of test value and gaps, without edits. |
| `/summarize-branch` | Summarize branch changes. |
| `/commit [context]` | Prepare and create an authorized commit. |
| `/push [context]` | Push an authorized branch. |

Except for `/test-audit`, these utilities retain the selected agent and its permissions.
[Supporting skills](skills/) cover test-first work, end-to-end and verification tests, test audits, performance measurement,
check execution, code learning, standards, checkpoints, commits, and pushes. Agents choose them when useful;
invoking a skill does not expand the task or the agent's permissions.

## Optional panels and plugins

To disable a session panel, remove its entry from `tui.jsonc` and restart:

| Entry | Panel |
| --- | --- |
| `./extensions/session-tools/config.ts` | Configuration inspector |
| `./extensions/session-tools/context.ts` | Context inspector |
| `./extensions/session-tools/bookmarks.tsx` | Bookmarks and handoff drafts |

Keep shared helpers under `extensions/session-tools/` and `extensions/tui/` for the panels you retain.
These panels use native APIs independently of Composer. Keep Prompt Composer for template includes and Config Composer
for model/group controls. To disable quota reporting, remove its entries from both `opencode.jsonc` and `tui.jsonc`.
