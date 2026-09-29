import type { Plugin, PluginModule } from '@opencode-ai/plugin';
import {
  type AgentSettings,
  type EffectiveChoice,
  SettingsError,
  applyDefaults,
  readOptions,
  record,
  resolveChoice,
} from './settings.ts';

function agentConfigurations(value: unknown): value is Record<string, AgentSettings> {
  return record(value) && Object.values(value).every(record);
}

// eslint-disable-next-line @typescript-eslint/require-await -- OpenCode requires a Promise-returning plugin initializer.
export const AgentGroupsPlugin: Plugin = async (_input, options) => {
  const { groups, modelPresets } = readOptions(options);
  let agents: Partial<Record<string, AgentSettings>> = {};
  let choices: Partial<Record<string, EffectiveChoice>> = {};
  return {
    // eslint-disable-next-line @typescript-eslint/require-await -- OpenCode requires a Promise-returning configuration hook.
    config: async (config) => {
      const configured: unknown = config.agent ?? {};
      if (!agentConfigurations(configured)) {
        throw new SettingsError('An agent configuration must be an object.');
      }
      agents = configured;
      const context = { modelPresets, native: config };
      choices = Object.fromEntries(
        Object.entries(configured)
          .filter(([, agent]) => agent.disable !== true)
          .map(([name, agent]) => [name, resolveChoice(agent, groups, context)]),
      );
      applyDefaults(configured, groups, context);
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- OpenCode requires a Promise-returning parameter hook.
    'chat.params': async (input, output) => {
      delete output.options.agent_group;
      const model = input.model;
      const selected = `${model.providerID}/${model.id}`;
      const modelVariants: unknown = 'variants' in model ? model.variants : undefined;
      const variants = record(modelVariants) ? modelVariants : {};
      const message: unknown = input.message;
      const requested = record(message) && typeof message.variant === 'string' ? message.variant : undefined;
      const choice = choices[input.agent];
      // Do not apply a referenced default to a different session-selected model.
      if (choice?.modelRef !== undefined && choice.modelRef !== '' && choice.model === selected) {
        const key = requested ?? choice.variant;
        if (key !== undefined && key !== '' && (!record(variants[key]) || variants[key].disabled === true)) {
          throw new SettingsError(
            'The referenced model does not support this reasoning variant. Update the agent or group settings.',
          );
        }
      }
      // Small title requests skip native variant selection. Align the built-in fallbacks
      // with the configured model's variant without forwarding stale provider-specific values.
      if (!['title', 'compaction'].includes(input.agent)) {
        return;
      }
      const agent = agents[input.agent];
      if (agent === undefined || !Object.hasOwn(agent.options ?? {}, 'reasoningEffort')) {
        return;
      }
      if (typeof agent.model === 'string' && agent.model !== '' && agent.model !== selected) {
        return;
      }
      const key =
        input.agent === 'compaction' && requested !== undefined && requested !== '' && record(variants[requested])
          ? requested
          : agent.variant;
      const variant = key !== undefined && key !== '' ? variants[key] : undefined;
      delete output.options.reasoningEffort;
      if (record(variant)) {
        Object.assign(output.options, variant);
      }
      delete output.options.agent_group;
    },
  };
};

export default { id: 'agent-groups', server: AgentGroupsPlugin } satisfies PluginModule;
