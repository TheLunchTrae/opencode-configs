import type { Plugin, PluginModule } from "@opencode-ai/plugin"
import {
  applyDefaults, readOptions, record, resolveChoice, SettingsError,
  type AgentSettings, type EffectiveChoice,
} from "./settings.ts"

export const AgentGroupsPlugin: Plugin = async (_input, options) => {
  const { groups, modelPresets } = readOptions(options)
  let agents: Record<string, AgentSettings> = {}
  let choices: Record<string, EffectiveChoice> = {}
  return {
    config: async (config) => {
      agents = (config.agent ?? {}) as Record<string, AgentSettings>
      const context = { modelPresets, native: config }
      choices = Object.fromEntries(Object.entries(agents).filter(([, agent]) => !agent.disable)
        .map(([name, agent]) => [name, resolveChoice(agent, groups, context)]))
      applyDefaults(agents, groups, context)
    },
    "chat.params": async (input, output) => {
      delete output.options.agent_group
      const model = input.model as unknown as Record<string, unknown>
      const selected = `${model.providerID}/${model.id}`
      const variants = record(model.variants) ? model.variants : {}
      const message = input.message as unknown
      const requested = record(message) && typeof message.variant === "string" ? message.variant : undefined
      const choice = choices[input.agent]
      // Do not apply a referenced default to a different session-selected model.
      if (choice?.modelRef && choice.model === selected) {
        const key = requested ?? choice.variant
        if (key && (!record(variants[key]) || variants[key].disabled === true)) {
          throw new SettingsError("The referenced model does not support this reasoning variant. Update the agent or group settings.")
        }
      }
      // Small title requests skip native variant selection. Align the built-in fallbacks
      // with the configured model's variant without forwarding stale provider-specific values.
      if (!["title", "compaction"].includes(input.agent)) return
      const agent = agents[input.agent]
      if (!agent || !Object.hasOwn(agent.options ?? {}, "reasoningEffort")) return
      if (agent.model && agent.model !== selected) return
      const key = input.agent === "compaction" && requested && record(variants[requested]) ? requested : agent.variant
      const variant = key ? variants[key] : undefined
      delete output.options.reasoningEffort
      if (record(variant)) Object.assign(output.options, variant)
      delete output.options.agent_group
    },
  }
}

export default { id: "agent-groups", server: AgentGroupsPlugin } satisfies PluginModule
