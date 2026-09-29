import { realpath } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { homedir } from "node:os"
import { isAbsolute, join } from "node:path"
import type { TuiPlugin, TuiPluginApi, TuiPluginModule, TuiDialogSelectOption } from "@opencode-ai/plugin/tui"
import {
  agentGroup, catalogModels, groupName, presetName, resolveChoice, resolveGroup, validateChoice, SettingsError,
  type CatalogModel, type GroupChoice, type ModelChoice, type NativeModels, type ResolutionContext,
} from "./settings.ts"
import {
  affectedGroups, groupNames, loadSnapshot, planChange, plannedChoices, savePlan, reloadConfiguration,
  type Change, type Snapshot, type StoredAgent,
} from "./storage.ts"

type Action = TuiDialogSelectOption<string> & { run: () => void | Promise<void> }
const installation = fileURLToPath(new URL("../../", import.meta.url))
const label = (choice: ModelChoice) => choice.model
  ? `${choice.model}${choice.variant ? ` (${choice.variant})` : ""}` : "OpenCode fallback"

// The directory argument also lets tests exercise the real file editor in an isolated installation.
export function registerSettings(api: TuiPluginApi, directory = installation,
  globalDirectory = join(process.env.XDG_CONFIG_HOME && isAbsolute(process.env.XDG_CONFIG_HOME)
    ? process.env.XDG_CONFIG_HOME : join(homedir(), ".config"), "opencode")): void {
  let busy = false
  const native = new WeakMap<Snapshot, NativeModels>()
  const context = (snapshot: Snapshot): ResolutionContext => ({
    modelPresets: snapshot.modelPresets, native: native.get(snapshot) ?? snapshot.config,
  })
  const refreshNative = async (snapshot: Snapshot) => {
    const response = await api.client.config.get()
    if (response.error || !response.data) {
      throw new SettingsError("Could not read effective workspace defaults. Reopen the editor after checking the server.")
    }
    native.set(snapshot, { model: response.data.model, small_model: response.data.small_model })
  }
  const run = (action: () => void | Promise<void>) => {
    if (busy || api.lifecycle.signal.aborted) return
    busy = true
    return Promise.resolve().then(action).catch((error: unknown) => {
      if (!api.lifecycle.signal.aborted) api.ui.toast({ variant: "error", title: "Agent settings",
        message: error instanceof SettingsError ? error.message : "Could not update settings. Check the files and server connection.",
        duration: 8000 })
    }).finally(() => { busy = false })
  }
  const menu = (title: string, options: Action[], current?: string) => {
    if (api.lifecycle.signal.aborted) return
    api.ui.dialog.replace(() => api.ui.DialogSelect({ title, placeholder: "Search…", current,
      options, onSelect: (option) => run(() => options.find((item) => item.value === option.value)?.run()) }))
  }
  const confirm = (title: string, message: string, action: () => Promise<void>) => {
    api.ui.dialog.replace(() => api.ui.DialogConfirm({ title, message,
      onConfirm: () => run(action), onCancel: () => api.ui.dialog.clear() }))
  }
  const load = async () => {
    if (await realpath(directory) !== await realpath(api.state.path.config)) {
      throw new SettingsError("Install the editor in this server's global configuration directory. Remote files are not supported.")
    }
    const snapshot = await loadSnapshot(directory)
    if (Object.values(snapshot.groups).some((choice) => choice.modelRef?.startsWith("opencode:"))) {
      await refreshNative(snapshot)
    }
    return snapshot
  }
  const models = async () => {
    const response = await api.client.config.providers()
    if (response.error) throw new SettingsError("Could not load provider models. Check your connection and try again.")
    const result = catalogModels(response.data?.providers)
    if (!result.length) throw new SettingsError("No provider models are available. Connect a provider with /connect first.")
    return result
  }
  const resolvedLabel = (snapshot: Snapshot, choice: GroupChoice) => {
    let suffix = ""
    if (choice.modelRef?.startsWith("opencode:")) {
      const field = choice.modelRef === "opencode:model" ? "model" : "small_model"
      if (context(snapshot).native?.[field] !== snapshot.config[field]) {
        suffix = " · running workspace differs from saved global"
      }
    }
    return `${choice.modelRef ? `${choice.modelRef} → ` : ""}${label(choice)}${suffix}`
  }
  const describeGroup = (snapshot: Snapshot, choice: GroupChoice) => {
    try { return resolvedLabel(snapshot, resolveGroup(choice, context(snapshot))) }
    catch (error) {
      if (!(error instanceof SettingsError)) throw error
      return `${choice.modelRef ?? "Group"} → Invalid: ${error.message}`
    }
  }
  const describeAgent = (snapshot: Snapshot, agent: StoredAgent) => {
    try {
      const choice = resolveChoice(agent.settings, snapshot.groups, context(snapshot))
      return `${resolvedLabel(snapshot, choice)} · ${choice.source}`
    } catch (error) {
      if (!(error instanceof SettingsError)) throw error
      return `Invalid: ${error.message}`
    }
  }
  const selectModel = async (title: string, current: ModelChoice,
    selected: (choice: ModelChoice) => void | Promise<void>, variants = true, extra: Action[] = []) => {
    const available = await models()
    menu(title, [...extra, ...available.map((model: CatalogModel) => ({
      title: model.name, value: model.id, description: model.id, category: model.provider,
      run: () => {
        const names = Object.keys(model.variants)
        if (!variants || !names.length) return selected({ model: model.id })
        menu(`${model.name}: variant`, [
          { title: "Model default", value: "", run: () => selected({ model: model.id }) },
          ...names.map((variant) => ({ title: variant, value: variant,
            run: () => selected({ model: model.id, variant }) })),
        ], current.model === model.id ? current.variant ?? "" : "")
      },
    }))], current.model)
  }
  const reload = async () => {
    const status = await api.client.session.status()
    if (status.error || !status.data) throw new SettingsError("Could not check running agents. Settings are saved; restart when idle.")
    if (Object.values(status.data).some((item) => item.type !== "idle")) {
      throw new SettingsError("Agents are still running in this workspace. Settings are saved; reload when they finish.")
    }
    const snapshot = await load()
    if (await realpath(globalDirectory).catch(() => undefined) !== snapshot.root) {
      throw new SettingsError("Settings are saved. Restart OpenCode to apply edits in a custom configuration directory.")
    }
    if (api.lifecycle.signal.aborted) return
    await reloadConfiguration(snapshot, async (plugins) => {
      const plugin = plugins as (string | [string, Record<string, unknown>])[]
      const result = await api.client.global.config.update({ config: { plugin } })
      if (result.error) throw new SettingsError("Settings were saved, but reload failed. Restart OpenCode to apply them.")
    })
    api.ui.dialog.clear()
    api.ui.toast({ variant: "success", title: "Settings reloaded",
      message: "New agent calls use the saved defaults. A session model selection can still override them.", duration: 8000 })
  }
  const offerReload = () => menu("Settings saved", [
    { title: "Reload now…", value: "reload", description: "Apply saved settings to this OpenCode server",
      run: () => confirm("Reload OpenCode settings?",
        "This reloads ALL workspaces on this server. Wait for agents in every workspace to finish first.\n\n"
        + "Existing session model selections remain; use /models to change the current session.", reload) },
    { title: "Apply on next restart", value: "later", run: () => api.ui.dialog.clear() },
  ])
  const propose = (snapshot: Snapshot, change: Change) => {
    const plan = planChange(snapshot, change)
    const preview = plannedChoices(plan, context(snapshot).native)
    const affected = affectedGroups(snapshot, change)
    const members = snapshot.agents.filter((agent) => affected.includes(agentGroup(agent.settings) ?? ""))
    const pinned = members.filter((agent) => agent.settings.model).length
    const impact = affected.length ? `\n${affected.length} linked or selected groups; `
      + `${members.length - pinned} agents use inherited settings; ${pinned} explicit model overrides are retained.` : ""
    const choiceLabel = change.kind === "group" ? describeGroup(snapshot, change.choice)
      : change.kind === "global" ? label({ model: change.model })
        : change.kind === "all" || change.kind === "preset" || change.kind === "override" ? label(change.choice) : ""
    const scope = change.kind === "global" || change.kind === "all"
      ? "\nOther native fallback consumers can also change. Workspace overrides and session selections still apply." : ""
    confirm("Save agent settings?", `${plan.description}\n${choiceLabel}${impact}${scope}\n\n`
      + `${plan.edits.length} file(s) will change. Reload settings after saving to apply them.`, async () => {
      if (native.has(snapshot)) await refreshNative(snapshot)
      const choices = plannedChoices(plan, context(snapshot).native)
      if (JSON.stringify(choices) !== JSON.stringify(preview)) {
        throw new SettingsError("Effective model defaults changed while the dialog was open. Reopen it and review the new models.")
      }
      if (choices.some((choice) => choice.model)) {
        const available = await models()
        for (const choice of choices) validateChoice(choice, available)
      }
      if (api.lifecycle.signal.aborted) return
      await savePlan(plan)
      offerReload()
    })
  }
  const selectReference = async (snapshot: Snapshot, name: string, modelRef: string) => {
    if (modelRef.startsWith("opencode:")) await refreshNative(snapshot)
    const resolved = resolveGroup({ modelRef }, context(snapshot))
    const model = validateChoice({ model: resolved.model }, await models())!
    const selected = (variant?: string) => propose(snapshot, {
      kind: "group", name, choice: { modelRef, ...(variant ? { variant } : {}) },
    })
    const variants = Object.keys(model.variants)
    if (!variants.length) { selected(); return }
    menu(`${modelRef} → ${model.id}: variant`, [
      { title: modelRef.startsWith("preset:") ? `Inherit preset variant (${resolved.variant ?? "model default"})`
        : "Model default", value: "", run: () => selected() },
      ...variants.map((variant) => ({ title: variant, value: variant, run: () => selected(variant) })),
    ], snapshot.groups[name]?.modelRef === modelRef ? snapshot.groups[name].variant ?? "" : "")
  }
  const selectGroup = (snapshot: Snapshot, name: string) => selectModel(`Group: ${name} · model source`,
    snapshot.groups[name] ?? {}, (choice) => propose(snapshot, { kind: "group", name, choice }), true, [
      { title: "OpenCode fallback", value: "+fallback", category: "Model source",
        description: "Leave model selection to OpenCode; this is not a main or small reference",
        run: () => propose(snapshot, { kind: "group", name, choice: {} }) },
      { title: "Main default", value: "opencode:model", category: "Model source",
        description: "Follow the effective workspace model setting",
        run: () => selectReference(snapshot, name, "opencode:model") },
      { title: "Small default", value: "opencode:small_model", category: "Model source",
        description: "Follow the effective workspace small_model setting",
        run: () => selectReference(snapshot, name, "opencode:small_model") },
      ...Object.keys(snapshot.modelPresets).sort().map((preset) => ({ title: preset, value: `preset:${preset}`,
        category: "Model presets", description: label(snapshot.modelPresets[preset]),
        run: () => selectReference(snapshot, name, `preset:${preset}`) })),
    ])
  const newGroup = (snapshot: Snapshot, agent?: StoredAgent) => {
    api.ui.dialog.replace(() => api.ui.DialogPrompt({ title: "New agent group", placeholder: "e.g. data-engineering",
      onCancel: () => api.ui.dialog.clear(), onConfirm: (value) => run(() => {
        const name = groupName(value.trim())
        if (groupNames(snapshot).includes(name)) throw new SettingsError("That group already exists. Choose it from the group list.")
        propose(snapshot, agent ? { kind: "membership", agent: agent.name, group: name }
          : { kind: "group", name, choice: {} })
      }) }))
  }
  const presetMenu = (snapshot: Snapshot, name: string) => menu(`Model preset: ${name}`, [
    { title: "Set model and variant", value: "model", description: label(snapshot.modelPresets[name]),
      run: () => selectModel(name, snapshot.modelPresets[name],
        (choice) => propose(snapshot, { kind: "preset", name, choice })) },
    { title: "Delete unused preset…", value: "delete", description: "Reassign dependent groups before deleting",
      run: () => propose(snapshot, { kind: "deletePreset", name }) },
  ])
  const presetsMenu = (snapshot: Snapshot) => menu("Model presets", [
    ...Object.keys(snapshot.modelPresets).sort().map((name) => ({ title: name, value: name,
      description: `${label(snapshot.modelPresets[name])} · `
        + `${Object.values(snapshot.groups).filter((choice) => choice.modelRef === `preset:${name}`).length} linked groups`,
      run: () => presetMenu(snapshot, name) })),
    { title: "Create a model preset…", value: "+", run: () => {
      api.ui.dialog.replace(() => api.ui.DialogPrompt({ title: "New model preset", placeholder: "e.g. balanced",
        onCancel: () => api.ui.dialog.clear(), onConfirm: (value) => run(async () => {
          const name = presetName(value.trim())
          if (Object.hasOwn(snapshot.modelPresets, name)) throw new SettingsError("That model preset already exists.")
          await selectModel(name, {}, (choice) => propose(snapshot, { kind: "preset", name, choice }))
        }) }))
    } },
  ])
  const agentMenu = (snapshot: Snapshot, agent: StoredAgent) => {
    const group = agentGroup(agent.settings)
    menu(`${agent.name} · ${group ?? "Ungrouped"}`, [
      { title: "Change group", value: "group", description: "Keep any explicit model override", run: () => {
        menu(`Move ${agent.name}`, [
          ...groupNames(snapshot).map((group) => ({ title: group, value: group,
            run: () => propose(snapshot, { kind: "membership", agent: agent.name, group }) })),
          { title: "Ungrouped", value: "", run: () => propose(snapshot, { kind: "membership", agent: agent.name }) },
          { title: "Create a new group…", value: "+", run: () => newGroup(snapshot, agent) },
        ], group ?? "")
      } },
      { title: "Set model override", value: "override", description: describeAgent(snapshot, agent),
        run: () => selectModel(agent.name, agent.settings,
          (choice) => propose(snapshot, { kind: "override", agent: agent.name, choice })) },
      { title: "Use group defaults", value: "inherit", description: "Clear this agent's model and variant overrides",
        run: () => propose(snapshot, { kind: "override", agent: agent.name, choice: {} }) },
    ])
  }
  const members = (snapshot: Snapshot, group?: string) => snapshot.agents
    .filter((agent) => agentGroup(agent.settings) === group)
  const agentOptions = (snapshot: Snapshot, agents: StoredAgent[]): Action[] => agents.map((agent) => ({
    title: agent.name, value: agent.name, description: describeAgent(snapshot, agent),
    run: () => agentMenu(snapshot, agent),
  }))
  const groupMenu = (snapshot: Snapshot, name: string) => menu(`Group: ${name}`, [
    { title: "Set default model or source", value: "+model", description: describeGroup(snapshot, snapshot.groups[name] ?? {}),
      run: () => selectGroup(snapshot, name) },
    { title: "Use OpenCode fallback", value: "+inherit", description: "Clear this group's model, reference, and variant defaults",
      run: () => propose(snapshot, { kind: "group", name, choice: {} }) },
    { title: "Add or move an agent", value: "+move", run: () => menu("Choose an agent",
      snapshot.agents.map((agent) => ({ title: agent.name, value: agent.name,
        description: agentGroup(agent.settings) ?? "Ungrouped",
        run: () => propose(snapshot, { kind: "membership", agent: agent.name, group: name }) }))) },
    ...agentOptions(snapshot, members(snapshot, name)).map((option) => ({ ...option, category: "Members" })),
  ])
  const groupsMenu = async () => {
    const snapshot = await load()
    menu("Agent groups", [
      ...groupNames(snapshot).map((name) => ({ title: name, value: name,
        description: `${members(snapshot, name).length} agents · ${describeGroup(snapshot, snapshot.groups[name] ?? {})}`,
        run: () => groupMenu(snapshot, name) })),
      { title: "Ungrouped", value: "", run: () => menu("Ungrouped agents", agentOptions(snapshot, members(snapshot))) },
      { title: "Create a new group…", value: "+", run: () => newGroup(snapshot) },
      { title: "All agents", value: "+agents", run: () => menu("Agents", agentOptions(snapshot, snapshot.agents)) },
    ])
  }
  const modelsMenu = async () => {
    const snapshot = await load()
    menu("Agent models: scope", [
      { title: "Global defaults", value: "+global", run: () => menu("Global defaults",
        (["model", "small_model"] as const).map((field) => ({
          title: field === "model" ? "Main model" : "Small model", value: field,
          description: String(snapshot.config[field] ?? "OpenCode fallback"),
          run: () => selectModel(field, { model: snapshot.config[field] as string | undefined },
            (choice) => propose(snapshot, { kind: "global", field, model: choice.model! }), false),
        }))) },
      { title: "Model presets", value: "+presets", description: "Create and edit reusable model choices",
        run: () => presetsMenu(snapshot) },
      { title: "All defaults", value: "+all", description: "Main, small, presets, and every group; keep references and agent pins",
        run: () => selectModel("All defaults", {}, (choice) => propose(snapshot, { kind: "all", choice })) },
      ...groupNames(snapshot).map((name) => ({ title: name, value: name, category: "Groups",
        description: describeGroup(snapshot, snapshot.groups[name] ?? {}), run: () => selectGroup(snapshot, name) })),
      { title: "Individual agent overrides", value: "+agents",
        run: () => menu("Agents", agentOptions(snapshot, snapshot.agents)) },
      { title: "Reload saved settings…", value: "+reload", run: offerReload },
    ])
  }
  const unregister = api.keymap.registerLayer({ commands: [
    { name: "agent-groups.models", title: "Agent models", category: "Config", namespace: "palette",
      slashName: "agent-models", run: () => run(modelsMenu) },
    { name: "agent-groups.membership", title: "Agent groups", category: "Config", namespace: "palette",
      slashName: "agent-groups", run: () => run(groupsMenu) },
  ] })
  api.lifecycle.onDispose(unregister)
}

export const AgentGroupsTui: TuiPlugin = async (api) => { registerSettings(api) }
export default { id: "agent-groups", tui: AgentGroupsTui } satisfies TuiPluginModule
