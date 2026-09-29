export type ModelChoice = { model?: string; variant?: string }
export type Groups = Record<string, ModelChoice>
export type AgentSettings = ModelChoice & {
  agent_group?: string
  disable?: boolean
  options?: Record<string, unknown>
  [key: string]: unknown
}
export type EffectiveChoice = ModelChoice & {
  group?: string
  source: "agent" | "group" | "native"
}

export class SettingsError extends Error {}

export function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function groupName(value: unknown): string {
  if (typeof value !== "string" || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value) || value.length > 64
    || ["constructor", "prototype"].includes(value)) {
    throw new SettingsError("Use a group name of up to 64 lowercase letters, digits, and hyphens.")
  }
  return value
}

export function modelChoice(value: unknown): ModelChoice {
  if (!record(value) || Object.keys(value).some((key) => !["model", "variant"].includes(key))) {
    throw new SettingsError("Group defaults support only model and variant.")
  }
  if (value.model !== undefined && (typeof value.model !== "string" || !/^[^\s/]+\/\S+$/.test(value.model))) {
    throw new SettingsError("Select a model in provider/model format.")
  }
  if (value.variant !== undefined && (typeof value.variant !== "string" || !/^[\w.-]{1,64}$/.test(value.variant))) {
    throw new SettingsError("Select a valid reasoning variant.")
  }
  if (value.variant && !value.model) throw new SettingsError("A group variant requires a group model.")
  return { ...(value.model ? { model: value.model as string } : {}),
    ...(value.variant ? { variant: value.variant as string } : {}) }
}

export function readGroups(options: unknown): Groups {
  if (options === undefined) return {}
  if (!record(options) || Object.keys(options).some((key) => !["groups", "reloadToken"].includes(key))
    || (options.reloadToken !== undefined && typeof options.reloadToken !== "string")
    || (options.groups !== undefined && !record(options.groups))) {
    throw new SettingsError("Agent group plugin options must contain a groups object.")
  }
  return Object.fromEntries(Object.entries(options.groups ?? {}).map(([name, choice]) =>
    [groupName(name), modelChoice(choice)]))
}

export function resolveChoice(agent: AgentSettings, groups: Groups): EffectiveChoice {
  const rawGroup = agent.agent_group ?? agent.options?.agent_group
  const group = rawGroup === undefined ? undefined : groupName(rawGroup)
  if (agent.model) return { group, model: agent.model, variant: agent.variant, source: "agent" }
  const defaults = group ? groups[group] : undefined
  if (defaults?.model) return {
    group, model: defaults.model, variant: agent.variant ?? defaults.variant, source: "group",
  }
  return { group, variant: agent.variant, source: "native" }
}

export function applyDefaults(agents: Record<string, AgentSettings>, groups: Groups): void {
  // Validate every membership before changing the loaded configuration.
  const choices = Object.entries(agents).filter(([, agent]) => !agent.disable)
    .map(([name, agent]) => ({ name, choice: resolveChoice(agent, groups) }))
  for (const { name, choice } of choices) {
    if (choice.source !== "group") continue
    agents[name].model = choice.model
    if (choice.variant !== undefined) agents[name].variant = choice.variant
  }
}

export type CatalogModel = {
  id: string
  name: string
  provider: string
  variants: Record<string, Record<string, unknown>>
}

export function catalogModels(providers: unknown): CatalogModel[] {
  if (!Array.isArray(providers)) throw new SettingsError("The provider model list is unavailable. Try again.")
  return providers.flatMap((provider) => {
    if (!record(provider) || typeof provider.id !== "string" || !record(provider.models)) return []
    const providerID = provider.id
    const providerName = typeof provider.name === "string" ? provider.name : providerID
    return Object.entries(provider.models).flatMap(([id, model]) => {
      if (!record(model) || model.status === "deprecated") return []
      const variants = record(model.variants) ? Object.fromEntries(Object.entries(model.variants)
        .filter(([, value]) => record(value) && value.disabled !== true)) : {}
      return [{ id: `${providerID}/${id}`, name: typeof model.name === "string" ? model.name : id,
        provider: providerName,
        variants: variants as CatalogModel["variants"] }]
    })
  }).sort((a, b) => a.provider.localeCompare(b.provider) || a.name.localeCompare(b.name))
}

export function validateChoice(choice: ModelChoice, models: CatalogModel[]): CatalogModel | undefined {
  if (!choice.model) return undefined
  const model = models.find((item) => item.id === choice.model)
  if (!model) throw new SettingsError("That model is no longer available from the configured providers. Refresh the list.")
  if (choice.variant && !Object.hasOwn(model.variants, choice.variant)) {
    throw new SettingsError("That variant is not available for the selected model.")
  }
  return model
}
