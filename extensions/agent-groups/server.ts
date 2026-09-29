import type { Plugin, PluginModule } from "@opencode-ai/plugin"
import { applyDefaults, readGroups, record, type AgentSettings } from "./settings.ts"

export const AgentGroupsPlugin: Plugin = async (_input, options) => {
  const groups = readGroups(options)
  let agents: Record<string, AgentSettings> = {}
  return {
    config: async (config) => {
      agents = (config.agent ?? {}) as Record<string, AgentSettings>
      applyDefaults(agents, groups)
    },
    "chat.params": async (input, output) => {
      delete output.options.agent_group
      // Small title requests skip native variant selection. Align the built-in fallbacks
      // with the configured model's variant without forwarding stale provider-specific values.
      if (!["title", "compaction"].includes(input.agent)) return
      const agent = agents[input.agent]
      if (!agent || !Object.hasOwn(agent.options ?? {}, "reasoningEffort")) return
      const model = input.model as unknown as Record<string, unknown>
      const selected = `${model.providerID}/${model.id}`
      if (agent.model && agent.model !== selected) return
      const variants = record(model.variants) ? model.variants : {}
      const message = input.message as unknown
      const requested = record(message) && typeof message.variant === "string" ? message.variant : undefined
      const key = input.agent === "compaction" && requested && record(variants[requested]) ? requested : agent.variant
      const variant = key ? variants[key] : undefined
      delete output.options.reasoningEffort
      if (record(variant)) Object.assign(output.options, variant)
      delete output.options.agent_group
    },
  }
}

export default { id: "agent-groups", server: AgentGroupsPlugin } satisfies PluginModule
