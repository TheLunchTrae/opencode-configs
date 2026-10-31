import type { Plugin } from '@opencode-ai/plugin';

function disabled(value: string | undefined): boolean {
  return ['1', 'true', 'yes', 'on'].includes((value ?? '').trim().toLowerCase());
}

function isPluginModule(value: unknown): value is { default: { server: Plugin } } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'default' in value &&
    typeof value.default === 'object' &&
    value.default !== null &&
    'server' in value.default &&
    typeof value.default.server === 'function'
  );
}

const tokenEconomizer: Plugin = async (input) => {
  // Skip initialization too: upstream's disable flag does not prevent transcript exports.
  if (disabled(process.env.TE_DISABLE) || disabled(process.env.TE_SIDECALL)) {
    return {};
  }

  // Keep upstream's module URL intact so its relative Python launcher paths still resolve.
  const source = new URL('../vendor/TokenEconomizer/plugin/opencode/tokeneconomizer.ts', import.meta.url);
  const upstream: unknown = await import(source.href);
  if (!isPluginModule(upstream)) {
    throw new Error('TokenEconomizer does not expose an OpenCode V1 server plugin.');
  }
  return upstream.default.server(input);
};

export default tokenEconomizer;
