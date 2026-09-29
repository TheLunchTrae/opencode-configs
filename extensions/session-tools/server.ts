import { tool, type Plugin, type PluginModule } from "@opencode-ai/plugin"
import { stages, clean } from "./model.ts"

export const WorkflowStatusPlugin: Plugin = async () => {
  let primary = new Set<string>()
  return {
    config: async (config) => {
      primary = new Set(Object.entries(config.agent ?? {})
        .filter(([, agent]) => agent && !agent.disable && agent.mode === "primary").map(([name]) => name))
    },
    tool: {
      workflow_status: tool({
        description: "Record the current primary lead's workflow stage in this session. This records status, not approval.",
        args: {
          stage: tool.schema.enum(stages),
          summary: tool.schema.string().trim().min(1).max(400),
        },
        async execute(input, context) {
          if (!primary.has(context.agent)) throw new Error("Only a configured primary lead can report workflow status.")
          if (context.abort.aborted) throw new Error("Workflow reporting was cancelled.")
          const summary = clean(input.summary)
          if (!summary.trim()) throw new Error("A visible workflow summary is required.")
          return { title: `Workflow: ${input.stage}`, output: `${input.stage}: ${summary}`,
            metadata: { workflowPanel: { version: 1, stage: input.stage, summary, agent: context.agent } } }
        },
      }),
    },
  }
}

export default { id: "workflow-status", server: WorkflowStatusPlugin } satisfies PluginModule
