import type { Plugin } from '@opencode-ai/plugin';
import {
  defaultPackagesDirectory,
  defaultRegistry,
  refreshTaggedPackages,
  registryDistTags,
} from '../extensions/plugin-cache/refresh.ts';

const SERVICE = 'plugin-cache-refresh';

// OpenCode starts this plugin once per project instance. One check per process is enough.
let refresh: Promise<void> | undefined;

// eslint-disable-next-line @typescript-eslint/require-await -- OpenCode's plugin factory requires a Promise result.
export const PluginCacheRefreshPlugin: Plugin = async ({ client }) => {
  const log = (level: 'info' | 'warn', message: string, extra: Record<string, unknown>) =>
    client.app.log({ body: { service: SERVICE, level, message, extra } }).then(
      () => undefined,
      () => undefined,
    );
  // The check runs in the background so registry requests do not delay startup. Removed packages install again,
  // at their tag's current version, the next time OpenCode starts.
  refresh ??= refreshTaggedPackages({
    packagesDirectory: defaultPackagesDirectory(),
    fetchDistTags: registryDistTags(defaultRegistry()),
    warn: (message, extra) => log('warn', message, extra),
  }).then(
    async (refreshed) => {
      if (refreshed.length === 0) {
        return;
      }
      await log('info', 'Cleared cached plugin packages with newer versions; restart OpenCode to load them', {
        packages: refreshed.map(
          (entry) => `${entry.name}@${entry.tag}: ${entry.installedVersion} -> ${entry.availableVersion}`,
        ),
      });
    },
    (error: unknown) =>
      log('warn', 'Plugin cache refresh failed', { error: error instanceof Error ? error.message : String(error) }),
  );
  return {};
};
