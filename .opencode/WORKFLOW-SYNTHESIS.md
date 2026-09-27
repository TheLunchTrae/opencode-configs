# Integrated workflow design

Reviewed September 27, 2026. The available collection contains 20 documented workflows, dated September 14, 2026.
This update selects portable practices from that collection. It does not combine the 40 standalone tool configurations.
Source links below identify the upstream accounts. They do not imply author endorsement or a fresh runtime evaluation.

## Integration decision

Keep the existing lead, planner, developers, and reviewers.
Keep all model pins, permissions, plugins, and provider settings.
Add seven on-demand skills and seven command entry points. Strengthen the existing plan and verify skills.
Use the current specialist roles instead of installing a second agent hierarchy.
Do not add project-specific instructions to the global `AGENTS.md`.

The default sequence is:

```text
Inspect -> select route -> plan -> design review -> user approval
        -> bounded implementation -> current checks -> independent review -> handoff
```

The lead owns task integration. Workers return candidates and evidence, not self-approved completion.
For long work, use a project-local checkpoint. Recheck the actual source before trusting a saved handoff.
Keep trivial tasks lightweight. Interviews, task graphs, measurements, and quizzes apply only when useful.

## Contribution from each workflow

The contribution column states our integration choice. The limits distinguish it from the original environment.
Each row maps to the procedure named in the final column.

| Source | Selected contribution | Procedure |
| --- | --- | --- |
| [Boris Tane][tane] | Annotate a grounded plan before approving implementation. | `plan` |
| [Harper Reed][reed] | Translate the specification into small acceptance slices. | `plan` |
| [Simon Willison][willison] | Observe the intended failing test before making it pass. | `test-first` |
| [Addy Osmani][osmani] | Keep changes inspectable and use a separate review context. | `development-workflow` |
| [Armin Ronacher][ronacher] | Use fast, bounded checks and useful diagnostics. | `verify` |
| [Peter Steinberger][steinberger] | Expose behavior through a small executable seam. | `development-workflow` |
| [Jesse Vincent][vincent] | Give each worker a complete task and obtain independent review. | `development-workflow` |
| [Geoffrey Huntley][huntley] | Preserve state and use finite, evidence-driven retries. | `checkpoint` |
| [Ryan Lopopolo][lopopolo] | Put recurring constraints in discoverable docs and executable checks. | `finish` |
| [Nicholas Carlini: simplify][carlini-small] | Simplify while preserving characterized behavior. | `test-first` |
| [Kun Chen][kun] | Settle consequential decisions and require outcome evidence. | `plan`, `finish` |
| [Lauren Tan: pstack][pstack] | Route by evidence; measure the relevant path. | `measured-performance` |
| [Steve Yegge: Wheelhouse][yegge] | Track dependencies, ownership, and reviewed completion. | `development-workflow` |
| [Jeffrey Emanuel][emanuel] | Preserve intent and evidence in each task. | `development-workflow` |
| [Mitchell Hashimoto][hashimoto] | Calibrate delegation before increasing scope. | `development-workflow` |
| [Dex Horthy][horthy] | Refresh context deliberately and detect stale source evidence. | `checkpoint` |
| [Nicholas Carlini: team][carlini-team] | Use independent tests and disjoint writers. | `development-workflow` |
| [Boris Cherny][cherny] | Make simplification, verification, and lesson review repeatable. | `finish` |
| [Thariq Shihipar][thariq] | Interview for non-obvious requirements before implementation. | `spec-interview` |
| [Kieran Klaassen][kieran] | Learn mechanics separately from verification. | `code-learning` |

[tane]: https://boristane.com/blog/how-i-use-claude-code/
[reed]: https://harper.blog/2025/02/16/my-llm-codegen-workflow-atm/
[willison]: https://simonwillison.net/guides/agentic-engineering-patterns/red-green-tdd/
[osmani]: https://addyosmani.com/blog/ai-coding-workflow/
[ronacher]: https://lucumr.pocoo.org/2025/6/12/agentic-coding/
[steinberger]: https://steipete.me/posts/2025/shipping-at-inference-speed
[vincent]: https://blog.fsck.com/2025/10/09/superpowers/
[huntley]: https://ghuntley.com/ralph/
[lopopolo]: https://openai.com/index/harness-engineering/
[carlini-small]: https://nicholas.carlini.com/writing/2024/how-i-use-ai.html
[kun]: https://blog.bytebytego.com/p/an-ex-meta-l8s-agentic-engineering
[pstack]: https://github.com/cursor/plugins/tree/5bf2b1544db739998121a306340631963c2ff3de/pstack
[yegge]: https://yegge.ai/essays/the-shape-of-things-to-come/
[emanuel]: https://agent-flywheel.com/complete-guide
[hashimoto]: https://mitchellh.com/writing/my-ai-adoption-journey
[horthy]: https://www.humanlayer.dev/blog/advanced-context-engineering
[carlini-team]: https://www.anthropic.com/engineering/building-c-compiler
[cherny]: https://x.com/bcherny/status/2007179832300581177
[thariq]: https://x.com/trq212/status/2005315275026260309
[kieran]: https://every.to/source-code/to-read-or-not-to-read-the-code

## Deliberate limits

Do not import complete source payloads, old model defaults, or another orchestration hierarchy.
The annotation process does not install visual-plan tooling. The CLI seam does not install browser or remote-host tools.
Characterization checks do not prove complete behavioral equivalence.

Task state is a small operating convention, not Wheelhouse, Beads, or a distributed lock service.
It does not install a database-backed queue.
Start with one writer. Use at most two only for disjoint files and independent acceptance targets.
Separate agent contexts can share a filesystem. The ownership rule is cooperative, not enforced isolation.
Do not run concurrent writers against shared generated files, lockfiles, or migrations.

Use at most two repair attempts for the same failed acceptance target, unless a smaller approved budget applies.
These numerical limits are local integration choices, not claims about the source authors.
Keep used attempts in the checkpoint. Do not add an unbounded Ralph loop, a daemon, or a background retry process.

The lesson step proposes a targeted project improvement. It does not auto-edit global memory or install a new linter.
The learning loop does not require exhaustive code reading, a perfect quiz score, or an extra merge gate.
No workflow automatically commits, pushes, opens a pull request, merges, or deploys.

## Files and compatibility

`agents/lead.md` loads the development-workflow skill in normal implementation sessions.
`agents/planner.md` loads the strengthened plan skill. Its existing edit and Bash denials remain unchanged.
`agents/performance-optimizer.md` loads measured-performance and returns observed values rather than guessed speedups.
The remaining agent definitions and the root configuration remain unchanged.

`/plan` remains a planner subtask. Lead commands use `subtask: false` to avoid nested lead delegation.
`/resume-work` avoids the built-in `/resume` alias. Commands contain no automatic shell interpolation.

This follows the documented [command format](https://opencode.ai/docs/commands/),
[skill format](https://opencode.ai/docs/skills/), and [TUI aliases](https://opencode.ai/docs/tui/).
The repository describes an OpenCode 1.18.29 installation. That installation was not available on this validation host.
Do not treat current documentation or structural tests as proof of native loading on every OpenCode release.

The setup instructions now include `references/`, which the existing configuration already requires.
Copy the complete skill folders, including the pstack MIT notices. No new dependency installation is needed.
The source collection and daily research task are unchanged.
Other configuration repositories and the active local installation are unchanged.

## Review notes

The design keeps approval, review, and delegation-depth constraints intact.
It avoids the global-state and model-setting conflicts that a direct payload merge would introduce.
Static tests check the authored contract, not whether a model follows it.
No independent agent review or authenticated OpenCode session was available during this update.
See [validation and activation checks](WORKFLOW-VALIDATION.md) before merging or installing.
