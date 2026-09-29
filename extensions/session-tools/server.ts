import { type Plugin, type PluginModule, tool } from '@opencode-ai/plugin';
import { clean, stages } from './model.ts';

// eslint-disable-next-line @typescript-eslint/require-await -- OpenCode requires Promise-returning server plugin factories.
export const WorkflowStatusPlugin: Plugin = async () => {
  let primary = new Set<string>();
  return {
    // eslint-disable-next-line @typescript-eslint/require-await -- OpenCode requires a Promise-returning configuration hook.
    config: async (config) => {
      primary = new Set(
        Object.entries(config.agent ?? {})
          .filter(
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- External configuration can contain null agent entries.
            ([, agent]) => agent !== undefined && agent !== null && agent.disable !== true && agent.mode === 'primary',
          )
          .map(([name]) => name),
      );
    },
    tool: {
      workflow_status: tool({
        description:
          "Record the current primary lead's workflow stage in this session. This records status, not approval.",
        args: {
          stage: tool.schema.enum(stages),
          summary: tool.schema.string().trim().min(1).max(400),
        },
        // eslint-disable-next-line @typescript-eslint/require-await -- OpenCode requires Promise-returning tool handlers.
        async execute(input, context) {
          if (!primary.has(context.agent)) {
            throw new Error('Only a configured primary lead can report workflow status.');
          }
          if (context.abort.aborted) {
            throw new Error('Workflow reporting was cancelled.');
          }
          const summary = clean(input.summary);
          if (summary.trim().length === 0) {
            throw new Error('A visible workflow summary is required.');
          }
          return {
            title: `Workflow: ${input.stage}`,
            output: `${input.stage}: ${summary}`,
            metadata: { workflowPanel: { version: 1, stage: input.stage, summary, agent: context.agent } },
          };
        },
      }),
    },
  };
};

export default { id: 'workflow-status', server: WorkflowStatusPlugin } satisfies PluginModule;
