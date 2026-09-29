import assert from "node:assert/strict"
import { test, type TestContext } from "node:test"
import { mkdtemp, mkdir, readFile, writeFile, rm, symlink, readdir } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import type { PluginInput, Hooks } from "@opencode-ai/plugin"
import type { TuiPluginApi, TuiDialogSelectProps, TuiDialogConfirmProps, TuiDialogPromptProps } from "@opencode-ai/plugin/tui"
import { registerSettings } from "../extensions/agent-groups/tui.ts"
import { applyEdits, modify } from "jsonc-parser"
import {
  applyDefaults, catalogModels, readGroups, resolveChoice, validateChoice, type AgentSettings,
} from "../extensions/agent-groups/settings.ts"
import { AgentGroupsPlugin } from "../extensions/agent-groups/server.ts"
import { groupNames, loadSnapshot, parseConfig, planChange, savePlan, reloadConfiguration } from "../extensions/agent-groups/storage.ts"

const groups = { developers: { model: "example/fast", variant: "medium" }, reviewers: { model: "example/deep" } }
const config = `{
  // Keep this comment and trailing comma.
  "plugin": [["./extensions/agent-groups/server.ts", {"groups": ${JSON.stringify(groups)}}]],
  "model": "example/global",
  "small_model": "example/small",
  "permission": {"edit": "ask"},
  "agent": {
    "builtin": {"agent_group": "developers", "permission": {"edit": "deny"}},
    "disabled": {"disable": true, "agent_group": "hidden"},
    "nested/pinned": {"model": "example/lower-pin", "variant": "low"},
  },
}
`
const prompt = "---\n\n# Prompt\nPreserve this exact text.\n  Two spaces.\n"
const pinned = `---
description: 'Keep my quotes' # and this comment
agent_group: developers
model: example/exception
variant: high
permission:
  edit: deny
${prompt}`

export async function fixture(t: TestContext): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "agent-groups-"))
  t.after(() => rm(root, { recursive: true, force: true }))
  await mkdir(join(root, "agents", "nested"), { recursive: true })
  await writeFile(join(root, "opencode.jsonc"), config)
  await writeFile(join(root, "agents", "nested", "pinned.md"), pinned)
  await writeFile(join(root, "agents", "new.md"), `---\nagent_group: custom-team\n${prompt}`)
  return root
}

test("defaults honor pins, variant overrides, unknown groups, and disabled agents", () => {
  const agents: Record<string, AgentSettings> = {
    inherited: { options: { agent_group: "developers" } },
    override: { agent_group: "developers", model: "other/model" },
    variant: { agent_group: "developers", variant: "low" },
    discovered: { agent_group: "new-group" },
    ungrouped: {},
    disabled: { disable: true, agent_group: "INVALID" },
  }
  applyDefaults(agents, groups)
  assert.equal(agents.inherited.model, "example/fast")
  assert.equal(agents.inherited.variant, "medium")
  assert.equal(agents.override.variant, undefined, "do not pass a group variant to another model")
  assert.equal(agents.variant.variant, "low")
  for (const name of ["discovered", "ungrouped", "disabled"]) assert.equal(agents[name].model, undefined)
  assert.deepEqual(agents.inherited.options, { agent_group: "developers" }, "keep metadata for agent discovery")
  const invalid = { good: { agent_group: "developers" }, bad: { agent_group: "invalid/group" } }
  assert.throws(() => applyDefaults(invalid, groups))
  assert.equal((invalid.good as AgentSettings).model, undefined, "validate before mutating")
})

test("provider catalog exposes configured models and supported variants", () => {
  const models = catalogModels([{ id: "example", name: "Example", models: {
    fast: { name: "Fast", variants: { low: { reasoningEffort: "low" }, hidden: { disabled: true } } },
    old: { status: "deprecated" },
  } }])
  assert.deepEqual(models.map((model) => model.id), ["example/fast"])
  assert.deepEqual(Object.keys(models[0].variants), ["low"])
  assert.equal(validateChoice({ model: "example/fast", variant: "low" }, models)?.id, "example/fast")
  assert.throws(() => validateChoice({ model: "example/fast", variant: "high" }, models))
  assert.throws(() => validateChoice({ model: "missing/model" }, models))
  assert.throws(() => catalogModels(undefined))
  for (const options of [ { groups: { developers: { variant: "high" } } },
    { groups: { "../bad": {} } }, { groups: { developers: { model: "bad" } } }, { other: {} } ]) {
    assert.throws(() => readGroups(options))
  }
  assert.deepEqual(readGroups({ groups, reloadToken: "refresh" }), groups)
})

test("server hook strips group metadata and aligns built-in variant fallbacks", async () => {
  const hooks = await AgentGroupsPlugin({} as PluginInput, { groups })
  const config = { agent: {
    title: { options: { agent_group: "developers", reasoningEffort: "old" } },
    compaction: { options: { agent_group: "developers", reasoningEffort: "old" } },
  } }
  await hooks.config!(config)
  assert.equal((config.agent.title as AgentSettings).model, "example/fast")
  const hook = hooks["chat.params"]!
  type Params = Parameters<NonNullable<Hooks["chat.params"]>>
  for (const agent of ["worker", "title", "compaction"]) {
    const model: Record<string, unknown> = { providerID: "example", id: "fast",
      variants: { medium: { reasoningEffort: "medium" } } }
    const input = { agent, model } as unknown as Params[0]
    const output = { options: { agent_group: "developers", reasoningEffort: "old", unrelated: true } } as unknown as Params[1]
    await hook(input, output)
    assert.equal(output.options.agent_group, undefined)
    assert.equal(output.options.unrelated, true)
    assert.equal(output.options.reasoningEffort, agent === "worker" ? "old" : "medium")
    if (agent !== "worker") {
      model.variants = {}
      await hook(input, output)
      assert.equal(output.options.reasoningEffort, undefined, "remove stale fallback on models without that variant")
    }
  }
  assert.equal(config.agent.title.options.agent_group, "developers")
  const input = { agent: "compaction", message: { variant: "high" }, model: {
    providerID: "example", id: "fast", variants: { medium: { reasoningEffort: "medium" },
      high: { reasoningEffort: "high" } },
  } } as unknown as Params[0]
  const output = { options: { reasoningEffort: "high" } } as unknown as Params[1]
  await hook(input, output)
  assert.equal(output.options.reasoningEffort, "high", "keep a supported request variant during compaction")
})

test("group saves preserve JSONC settings, discover new groups, and retain pins", async (t) => {
  const root = await fixture(t)
  let snapshot = await loadSnapshot(root)
  assert.deepEqual(groupNames(snapshot), ["custom-team", "developers", "reviewers"])
  assert.ok(!snapshot.agents.some((agent) => agent.name === "disabled"))
  const originalAgent = await readFile(join(root, "agents/nested/pinned.md"), "utf8")
  const plan = planChange(snapshot, { kind: "all", choice: { model: "other/new", variant: "low" } })
  assert.equal(await readFile(snapshot.configFile.path, "utf8"), config, "planning must not write")
  await savePlan(plan)
  snapshot = await loadSnapshot(root)
  assert.match(snapshot.configFile.text, /Keep this comment and trailing comma/)
  assert.deepEqual(snapshot.config.permission, { edit: "ask" })
  assert.equal(snapshot.config.model, "other/new")
  assert.equal(snapshot.config.small_model, "other/new")
  assert.deepEqual(snapshot.groups["custom-team"], { model: "other/new", variant: "low" })
  assert.equal(await readFile(join(root, "agents/nested/pinned.md"), "utf8"), originalAgent)
  assert.equal(resolveChoice(snapshot.agents.find((a) => a.name === "nested/pinned")!.settings,
    snapshot.groups).model, "example/exception")
  assert.equal(resolveChoice(snapshot.agents.find((a) => a.name === "builtin")!.settings,
    snapshot.groups).model, "other/new")
})

test("moving and unpinning Markdown agents preserves prompts, YAML comments, and lower-layer permissions", async (t) => {
  const root = await fixture(t)
  const path = join(root, "agents/nested/pinned.md")
  await writeFile(path, pinned.replaceAll("\n", "\r\n"))
  await savePlan(planChange(await loadSnapshot(root), { kind: "membership", agent: "nested/pinned", group: "new-team" }))
  const moved = await readFile(path, "utf8")
  assert.ok(moved.endsWith(prompt.replaceAll("\n", "\r\n")))
  assert.match(moved, /description: 'Keep my quotes' # and this comment/)
  assert.match(moved, /model: example\/exception/)
  assert.ok(!/(?<!\r)\n/.test(moved), "preserve CRLF")
  await savePlan(planChange(await loadSnapshot(root), { kind: "override", agent: "nested/pinned", choice: {} }))
  const snapshot = await loadSnapshot(root)
  const agent = snapshot.agents.find((agent) => agent.name === "nested/pinned")!
  assert.equal(agent.settings.model, undefined)
  assert.equal(agent.settings.variant, undefined)
  assert.deepEqual(agent.settings.permission, { edit: "deny" })
  assert.equal(resolveChoice(agent.settings, snapshot.groups).source, "native")
  await savePlan(planChange(snapshot, { kind: "membership", agent: "nested/pinned" }))
  assert.equal((await loadSnapshot(root)).agents.find((a) => a.name === "nested/pinned")!.settings.agent_group, undefined)
  assert.ok((await readFile(path, "utf8")).endsWith(prompt.replaceAll("\n", "\r\n")))
})

test("stale snapshots and locked files cannot overwrite other edits", async (t) => {
  const root = await fixture(t)
  const plan = planChange(await loadSnapshot(root), { kind: "group", name: "developers", choice: { model: "other/new" } })
  await writeFile(join(root, "opencode.jsonc"), config + "\n// External edit\n")
  await assert.rejects(savePlan(plan), /Settings changed/)
  assert.match(await readFile(join(root, "opencode.jsonc"), "utf8"), /External edit/)
  const fresh = planChange(await loadSnapshot(root), { kind: "group", name: "developers", choice: {} })
  await writeFile(join(root, "agents/extra.md"), `---\nagent_group: developers\n${prompt}`)
  await assert.rejects(savePlan(fresh), /agent list changed/)
  await writeFile(join(root, ".agent-groups.lock"), "")
  await assert.rejects(savePlan(fresh), /Another settings edit/)
  assert.ok(!(await readdir(root)).some((name) => name.endsWith(".tmp")))
})

test("invalid, duplicate, and ambiguous files fail without writes", async (t) => {
  const root = await fixture(t)
  for (const bad of ['{"x":1,"x":2}', '{"broken":'] ) assert.throws(() => parseConfig(bad))
  await writeFile(join(root, "agents/new.md"), `---\nagent_group: a\nagent_group: b\n${prompt}`)
  await assert.rejects(loadSnapshot(root), /invalid agent frontmatter/)
  await rm(join(root, "agents/new.md"))
  await symlink(join(root, "agents/nested/pinned.md"), join(root, "agents/link.md"))
  await assert.rejects(loadSnapshot(root), /symlinks/)
  await rm(join(root, "agents/link.md"))
  await writeFile(join(root, "opencode.json"), "{}")
  await assert.rejects(loadSnapshot(root), /one opencode.json/)
  await rm(join(root, "opencode.json"))
  await writeFile(join(root, "config.json"), "{}")
  await assert.rejects(loadSnapshot(root), /Merge legacy config.json/)
  assert.equal(await readFile(join(root, "opencode.jsonc"), "utf8"), config)
})

test("a later file failure rolls back earlier edits and removes temporary files", async (t) => {
  const root = await fixture(t)
  const snapshot = await loadSnapshot(root)
  const plan = planChange(snapshot, { kind: "override", agent: "nested/pinned", choice: {} })
  assert.equal(plan.edits.length, 2)
  // Force a real filesystem failure at the second write without changing the first file's write behavior.
  plan.edits[1] = { ...plan.edits[1], file: { ...plan.edits[1].file, path: join(root, "missing", "config.jsonc") } }
  await assert.rejects(savePlan(plan), /ENOENT/)
  assert.equal(await readFile(join(root, "agents/nested/pinned.md"), "utf8"), pinned)
  assert.equal(await readFile(join(root, "opencode.jsonc"), "utf8"), config)
  assert.ok(!(await readdir(root)).some((name) => name === ".agent-groups.lock" || name.endsWith(".tmp")))
})

test("reload does not overwrite a concurrent comment edit", async (t) => {
  const root = await fixture(t)
  const path = join(root, "opencode.jsonc")
  await assert.rejects(reloadConfiguration(await loadSnapshot(root), async (plugin) => {
    const before = await readFile(path, "utf8")
    await writeFile(path, applyEdits(before, modify(before, ["plugin"], plugin,
      { formattingOptions: { insertSpaces: true, tabSize: 2 } })) + "\n// Another editor's comment\n")
  }), /Settings changed during reload/)
  assert.match(await readFile(path, "utf8"), /Another editor's comment/)
})

const shipped = await loadSnapshot(fileURLToPath(new URL("../", import.meta.url)))

test("shipped groups resolve shared sources and preserve deliberate agent exceptions and built-in fallbacks", () => {
  const snapshot = shipped
  const context = { native: snapshot.config, modelPresets: snapshot.modelPresets }
  for (const field of ["model", "small_model"]) {
    assert.match(String(snapshot.config[field]), /^[^\s/]+\/\S+$/, `${field}: missing configured model`)
  }
  assert.deepEqual(snapshot.groups, {
    workflow: { modelRef: "opencode:model", variant: "high" },
    planning: { modelRef: "opencode:model", variant: "high" },
    developers: { modelRef: "preset:balanced" },
    reviewers: { modelRef: "opencode:model", variant: "high" },
    refactoring: { modelRef: "preset:balanced" },
    documentation: { modelRef: "preset:lightweight" },
    research: { modelRef: "preset:lightweight" },
    system: { modelRef: "preset:lightweight" },
  })
  for (const agent of snapshot.agents) {
    const effective = resolveChoice(agent.settings, snapshot.groups, context)
    assert.ok(effective.group, `${agent.name}: missing group`)
    assert.ok(Object.hasOwn(snapshot.groups, effective.group), `${agent.name}: unknown group`)
    assert.ok(effective.model, `${agent.name}: missing model`)
    assert.ok(effective.variant, `${agent.name}: missing variant`)
    assert.equal(effective.source, agent.settings.model ? "agent" : "group", agent.name)
  }
  const pins = snapshot.agents.filter((agent) => agent.settings.model).map((agent) => agent.name).sort()
  assert.deepEqual(pins, ["doctrine-developer", "efcore-developer", "implementation-lead", "performance-optimizer", "title"])
  for (const name of ["title", "compaction"]) {
    const agent = snapshot.agents.find((agent) => agent.name === name)!
    assert.equal(agent.settings.options?.reasoningEffort,
      resolveChoice(agent.settings, snapshot.groups, context).variant, `${name}: align the built-in variant fallback`)
  }
  assert.equal(snapshot.agents.find((agent) => agent.name === "title")!.settings.variant, "low")
})

for (const modelRef of ["opencode:model", ...Object.keys(shipped.modelPresets).map((name) => `preset:${name}`),
  "opencode:small_model"]) {
  const target = modelRef.slice(modelRef.indexOf(":") + 1)
  test(`changing shipped ${target} updates only linked, unpinned agents`, () => {
    const snapshot = shipped
    const original = JSON.stringify({ config: snapshot.config, groups: snapshot.groups,
      modelPresets: snapshot.modelPresets, agents: snapshot.agents.map((agent) => agent.settings) })
    const native = { ...snapshot.config }
    const modelPresets = structuredClone(snapshot.modelPresets)
    if (modelRef.startsWith("opencode:")) native[target] = "fixture/replacement"
    else modelPresets[target] = { model: "fixture/replacement", variant: "low" }
    const context = { native, modelPresets }
    const agents = Object.fromEntries(snapshot.agents.map((agent) => [agent.name, structuredClone(agent.settings)]))
    applyDefaults(agents, snapshot.groups, context)
    let inherited = 0
    for (const agent of snapshot.agents) {
      const group = agent.settings.agent_group ?? agent.settings.options?.agent_group
      assert.ok(typeof group === "string", `${agent.name}: missing group`)
      const defaults = snapshot.groups[group]
      assert.ok(defaults, `${agent.name}: unknown group`)
      const preset = defaults.modelRef?.startsWith("preset:") ? modelPresets[defaults.modelRef.slice(7)] : undefined
      const model = agent.settings.model ?? (defaults.modelRef === "opencode:model" ? native.model
        : defaults.modelRef === "opencode:small_model" ? native.small_model : preset?.model ?? defaults.model)
      const variant = agent.settings.model ? agent.settings.variant : agent.settings.variant ?? defaults.variant ?? preset?.variant
      const expected = { group, model, variant, source: agent.settings.model ? "agent" : "group",
        ...(!agent.settings.model && defaults.modelRef ? { modelRef: defaults.modelRef } : {}) }
      const after = resolveChoice(agent.settings, snapshot.groups, context)
      assert.deepEqual(after, expected, `${agent.name}: resolve the stored model source`)
      assert.deepEqual(agents[agent.name], { ...agent.settings, model, variant },
        `${agent.name}: applying defaults must preserve other agent settings`)
      if (!agent.settings.model && defaults.modelRef === modelRef) {
        assert.equal(after.model, "fixture/replacement", `${agent.name}: follow the changed source`)
        inherited++
      }
    }
    if (modelRef === "opencode:small_model") assert.equal(inherited, 0, "the title pin and system preset remain independent")
    else assert.ok(inherited > 0, "the shared source must have inherited consumers")
    assert.equal(JSON.stringify({ config: snapshot.config, groups: snapshot.groups,
      modelPresets: snapshot.modelPresets, agents: snapshot.agents.map((agent) => agent.settings) }), original)
  })
}

function uiHarness(root: string, globalDirectory = root, serverDirectory = root) {
  let dialog: TuiDialogSelectProps<string> | TuiDialogConfirmProps | TuiDialogPromptProps | undefined
  let onClose: (() => void) | undefined
  const clear = () => { onClose?.(); onClose = undefined; dialog = undefined }
  let providerError = false
  let active = false
  let updates = 0
  let unregistered = false
  let dispose: (() => void) | undefined
  const commands: { name: string; run: () => void }[] = []
  const toasts: { message: string }[] = []
  const api = {
    state: { path: { config: serverDirectory } },
    route: { current: { name: "home" } },
    lifecycle: { signal: new AbortController().signal, onDispose: (callback: () => void) => { dispose = callback } },
    keymap: { registerLayer: (layer: { commands: typeof commands }) => {
      commands.push(...layer.commands)
      return () => { unregistered = true }
    } },
    ui: {
      DialogSelect: (props: TuiDialogSelectProps<string>) => { dialog = props },
      DialogConfirm: (props: TuiDialogConfirmProps) => { dialog = props },
      DialogPrompt: (props: TuiDialogPromptProps) => { dialog = props },
      dialog: {
        get open() { return dialog !== undefined },
        replace: (render: () => void, closed?: () => void) => { onClose?.(); onClose = closed; render() },
        clear,
      },
      toast: (toast: { message: string }) => { toasts.push(toast) },
    },
    client: {
      config: { providers: async () => providerError ? { error: {} } : { data: { providers: [
        { id: "example", models: { next: { name: "Next", variants: { low: {} } } } },
      ] } } },
      session: { status: async () => ({ data: active ? { session: { type: "busy" } } : {} }) },
      global: { config: { update: async (input: { config: { plugin: unknown[] } }) => {
        updates++
        const path = join(root, "opencode.jsonc")
        const before = await readFile(path, "utf8")
        await writeFile(path, applyEdits(before, modify(before, ["plugin"], input.config.plugin,
          { formattingOptions: { insertSpaces: true, tabSize: 2 } })))
        return { data: {} }
      } } },
    },
  } as unknown as TuiPluginApi
  registerSettings(api, root, globalDirectory)
  return {
    get dialog() { return dialog }, get toasts() { return toasts }, get updates() { return updates },
    setProviderError(value: boolean) { providerError = value }, setActive(value: boolean) { active = value },
    async command(name = "agent-groups.models") { await commands.find((c) => c.name === name)!.run() },
    async select(value: string) {
      assert.ok(dialog && "options" in dialog)
      const option = dialog.options.find((item) => item.value === value)
      assert.ok(option, `${dialog.title}: missing ${value}`)
      await dialog.onSelect!(option)
    },
    async confirm() { const pending = (dialog as TuiDialogConfirmProps).onConfirm?.(); clear(); await pending },
    async cancel() { const pending = (dialog as TuiDialogConfirmProps).onCancel?.(); clear(); await pending },
    async escape() { clear(); await Promise.resolve() },
    async enter(value: string) { await (dialog as TuiDialogPromptProps).onConfirm!(value) },
    dispose() { dispose!(); assert.ok(unregistered) },
  }
}

test("TUI model selection previews, saves, and blocks reload while an agent runs", async (t) => {
  const root = await fixture(t)
  const ui = uiHarness(root)
  await ui.command()
  await ui.select("developers")
  await ui.select("example/next")
  await ui.select("low")
  assert.equal(ui.dialog?.title, "Save agent settings?")
  assert.equal(await readFile(join(root, "opencode.jsonc"), "utf8"), config)
  await ui.confirm()
  assert.deepEqual((await loadSnapshot(root)).groups.developers, { model: "example/next", variant: "low" })
  ui.setActive(true)
  await ui.select("reload")
  await ui.confirm()
  assert.equal(ui.updates, 0)
  assert.match(ui.toasts.at(-1)!.message, /still running/)
  ui.setActive(false)
  await ui.select("reload")
  await ui.confirm()
  assert.equal(ui.updates, 1)
  assert.match(await readFile(join(root, "opencode.jsonc"), "utf8"), /Keep this comment and trailing comma/)
  ui.dispose()
})

test("TUI cancellation and provider failures leave files unchanged", async (t) => {
  const root = await fixture(t)
  const ui = uiHarness(root)
  await ui.command()
  ui.setProviderError(true)
  await ui.select("developers")
  assert.match(ui.toasts.at(-1)!.message, /Could not load provider models/)
  ui.setProviderError(false)
  await ui.select("developers")
  await ui.select("example/next")
  await ui.select("")
  await ui.cancel()
  assert.equal(await readFile(join(root, "opencode.jsonc"), "utf8"), config)
  await ui.command()
  await ui.select("+all")
  await ui.select("example/next")
  await ui.select("low")
  ui.setProviderError(true)
  await ui.confirm()
  assert.equal(await readFile(join(root, "opencode.jsonc"), "utf8"), config)
  assert.equal(ui.updates, 0)
})

test("a custom configuration installation cannot write to a different global configuration during reload", async (t) => {
  const root = await fixture(t)
  const ui = uiHarness(root, join(root, "different-global-directory"))
  await ui.command()
  await ui.select("+reload")
  await ui.select("reload")
  await ui.confirm()
  assert.equal(ui.updates, 0)
  assert.match(ui.toasts.at(-1)!.message, /custom configuration directory/)
  assert.equal(await readFile(join(root, "opencode.jsonc"), "utf8"), config)
})

test("TUI opens and saves the selected custom directory when the server reports its default config path", async (t) => {
  const root = await fixture(t)
  const globalDirectory = join(root, "global")
  await mkdir(globalDirectory)
  const previous = process.env.OPENCODE_CONFIG_DIR
  t.after(() => {
    if (previous === undefined) delete process.env.OPENCODE_CONFIG_DIR
    else process.env.OPENCODE_CONFIG_DIR = previous
  })
  process.env.OPENCODE_CONFIG_DIR = root
  const ui = uiHarness(root, globalDirectory, globalDirectory)
  await ui.command("agent-groups.membership")
  assert.equal(ui.dialog?.title, "Agent groups")
  await ui.select("+")
  await ui.enter("custom-install-group")
  await ui.confirm()
  assert.ok(groupNames(await loadSnapshot(root)).includes("custom-install-group"))
  assert.deepEqual(await readdir(globalDirectory), [])
  await ui.select("reload")
  await ui.confirm()
  assert.equal(ui.updates, 0)
  assert.match(ui.toasts.at(-1)!.message, /custom configuration directory/)
})

test("TUI rejects an installation that is neither the server config nor the selected custom directory", async (t) => {
  const root = await fixture(t)
  const globalDirectory = join(root, "global")
  await mkdir(globalDirectory)
  const ui = uiHarness(root, globalDirectory, globalDirectory)
  await ui.command()
  assert.equal(ui.dialog, undefined)
  assert.match(ui.toasts.at(-1)!.message, /configuration directory/)
  assert.equal(await readFile(join(root, "opencode.jsonc"), "utf8"), config)
})

test("TUI Back and Escape preserve parents and cancel changes without saving", async (t) => {
  const root = await fixture(t)
  const ui = uiHarness(root)
  await ui.command("agent-groups.membership")
  await ui.select("developers")
  await ui.select("+model")
  await ui.select("example/next")
  await ui.select("low")
  await ui.cancel()
  assert.equal(ui.dialog?.title, "Next: variant")
  await ui.select("\u0000back")
  assert.equal(ui.dialog?.title, "Group: developers · model source")
  await ui.escape()
  assert.equal(ui.dialog?.title, "Group: developers")
  await ui.escape()
  assert.equal(ui.dialog?.title, "Agent groups")
  assert.equal((ui.dialog as TuiDialogSelectProps<string>).current, "developers")
  await ui.select("+")
  await ui.enter("cancelled-group")
  await ui.escape()
  assert.equal(ui.dialog?.title, "New agent group")
  assert.equal((ui.dialog as TuiDialogPromptProps).value, "cancelled-group")
  await ui.escape()
  assert.equal(ui.dialog?.title, "Agent groups")
  await ui.escape()
  assert.equal(ui.dialog, undefined)
  assert.equal(await readFile(join(root, "opencode.jsonc"), "utf8"), config)
})

test("TUI can create a group by reassigning an agent and return it to inherited defaults", async (t) => {
  const root = await fixture(t)
  const ui = uiHarness(root)
  await ui.command("agent-groups.membership")
  await ui.select("+agents")
  await ui.select("nested/pinned")
  await ui.select("group")
  await ui.select("+")
  await ui.enter("new-team")
  await ui.confirm()
  await ui.select("later")
  await ui.command("agent-groups.membership")
  await ui.select("new-team")
  await ui.select("nested/pinned")
  await ui.select("inherit")
  await ui.confirm()
  const snapshot = await loadSnapshot(root)
  const agent = snapshot.agents.find((agent) => agent.name === "nested/pinned")!
  assert.equal(agent.settings.agent_group, "new-team")
  assert.equal(agent.settings.model, undefined)
  assert.equal(resolveChoice(agent.settings, snapshot.groups).source, "native")
})
