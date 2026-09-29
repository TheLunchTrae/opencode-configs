import { realpath } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { homedir } from "node:os"
import { isAbsolute, join } from "node:path"
import type { TuiPlugin, TuiPluginApi, TuiPluginModule, TuiDialogSelectOption } from "@opencode-ai/plugin/tui"
import {
  catalogModels, groupName, resolveChoice, validateChoice, SettingsError,
  type CatalogModel, type ModelChoice,
} from "./settings.ts"
import {
  groupNames, loadSnapshot, planChange, savePlan, reloadConfiguration,
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
    return loadSnapshot(directory)
  }
  const models = async () => {
    const response = await api.client.config.providers()
    if (response.error) throw new SettingsError("Could not load provider models. Check your connection and try again.")
    const result = catalogModels(response.data?.providers)
    if (!result.length) throw new SettingsError("No provider models are available. Connect a provider with /connect first.")
    return result
  }
  const selectModel = async (title: string, current: ModelChoice, selected: (choice: ModelChoice) => void,
    variants = true) => {
    const available = await models()
    menu(title, available.map((model: CatalogModel) => ({
      title: model.name, value: model.id, description: model.id, category: model.provider,
      run: () => {
        const names = Object.keys(model.variants)
        if (!variants || !names.length) { selected({ model: model.id }); return }
        menu(`${model.name}: variant`, [
          { title: "Model default", value: "", run: () => selected({ model: model.id }) },
          ...names.map((variant) => ({ title: variant, value: variant,
            run: () => selected({ model: model.id, variant }) })),
        ], current.model === model.id ? current.variant ?? "" : "")
      },
    })), current.model)
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
    let impact = ""
    if (change.kind === "group" || change.kind === "all") {
      const members = snapshot.agents.filter((agent) => change.kind === "all"
        || resolveChoice(agent.settings, snapshot.groups).group === change.name)
      const pinned = members.filter((agent) => agent.settings.model).length
      impact = `\n${members.length - pinned} agents use inherited settings; ${pinned} explicit model overrides are retained.`
    }
    const choice = change.kind === "membership" ? undefined
      : change.kind === "global" ? { model: change.model } : change.choice
    confirm("Save agent settings?", `${plan.description}\n${choice ? label(choice) : ""}${impact}\n\n`
      + `${plan.edits.length} file(s) will change. Reload settings after saving to apply them.`, async () => {
      if (choice?.model) validateChoice(choice, await models())
      if (api.lifecycle.signal.aborted) return
      await savePlan(plan)
      offerReload()
    })
  }
  const newGroup = (snapshot: Snapshot, agent?: StoredAgent) => {
    api.ui.dialog.replace(() => api.ui.DialogPrompt({ title: "New agent group", placeholder: "e.g. data-engineering",
      onCancel: () => api.ui.dialog.clear(), onConfirm: (value) => run(() => {
        const name = groupName(value.trim())
        if (groupNames(snapshot).includes(name)) throw new SettingsError("That group already exists. Choose it from the group list.")
        propose(snapshot, agent ? { kind: "membership", agent: agent.name, group: name }
          : { kind: "group", name, choice: {} })
      }) }))
  }
  const agentMenu = (snapshot: Snapshot, agent: StoredAgent) => {
    const effective = resolveChoice(agent.settings, snapshot.groups)
    menu(`${agent.name} · ${effective.group ?? "Ungrouped"}`, [
      { title: "Change group", value: "group", description: "Keep any explicit model override", run: () => {
        menu(`Move ${agent.name}`, [
          ...groupNames(snapshot).map((group) => ({ title: group, value: group,
            run: () => propose(snapshot, { kind: "membership", agent: agent.name, group }) })),
          { title: "Ungrouped", value: "", run: () => propose(snapshot, { kind: "membership", agent: agent.name }) },
          { title: "Create a new group…", value: "+", run: () => newGroup(snapshot, agent) },
        ], effective.group ?? "")
      } },
      { title: "Set model override", value: "override", description: label(effective),
        run: () => selectModel(agent.name, effective,
          (choice) => propose(snapshot, { kind: "override", agent: agent.name, choice })) },
      { title: "Use group defaults", value: "inherit", description: "Clear this agent's model and variant overrides",
        run: () => propose(snapshot, { kind: "override", agent: agent.name, choice: {} }) },
    ])
  }
  const members = (snapshot: Snapshot, group?: string) => snapshot.agents
    .filter((agent) => resolveChoice(agent.settings, snapshot.groups).group === group)
  const agentOptions = (snapshot: Snapshot, agents: StoredAgent[]): Action[] => agents.map((agent) => {
    const effective = resolveChoice(agent.settings, snapshot.groups)
    return { title: agent.name, value: agent.name, description: `${label(effective)} · ${effective.source}`,
      run: () => agentMenu(snapshot, agent) }
  })
  const groupMenu = (snapshot: Snapshot, name: string) => menu(`Group: ${name}`, [
    { title: "Set default model", value: "+model", description: label(snapshot.groups[name] ?? {}),
      run: () => selectModel(name, snapshot.groups[name] ?? {},
        (choice) => propose(snapshot, { kind: "group", name, choice })) },
    { title: "Use OpenCode fallback", value: "+inherit", description: "Clear this group's model and variant defaults",
      run: () => propose(snapshot, { kind: "group", name, choice: {} }) },
    { title: "Add or move an agent", value: "+move", run: () => menu("Choose an agent",
      snapshot.agents.map((agent) => ({ title: agent.name, value: agent.name,
        description: resolveChoice(agent.settings, snapshot.groups).group ?? "Ungrouped",
        run: () => propose(snapshot, { kind: "membership", agent: agent.name, group: name }) }))) },
    ...agentOptions(snapshot, members(snapshot, name)).map((option) => ({ ...option, category: "Members" })),
  ])
  const groupsMenu = async () => {
    const snapshot = await load()
    menu("Agent groups", [
      ...groupNames(snapshot).map((name) => ({ title: name, value: name,
        description: `${members(snapshot, name).length} agents · ${label(snapshot.groups[name] ?? {})}`,
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
      { title: "All defaults", value: "+all", description: "Global main, small, and every group; keep agent overrides",
        run: () => selectModel("All defaults", {}, (choice) => propose(snapshot, { kind: "all", choice })) },
      ...groupNames(snapshot).map((name) => ({ title: name, value: name, category: "Groups",
        description: label(snapshot.groups[name] ?? {}), run: () => selectModel(name, snapshot.groups[name] ?? {},
          (choice) => propose(snapshot, { kind: "group", name, choice })) })),
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
