import type { Plugin } from '@opencode-ai/plugin';
import {
  type OutdatedPackage,
  defaultPackagesDirectory,
  discardPackagesSync,
  findOutdatedPackages,
  npmSettings,
  registryDistTags,
} from '../extensions/plugin-cache/refresh.ts';

const SERVICE = 'plugin-cache-refresh';

// OpenCode starts this plugin once per project instance, and all instances in a process share these values.
// One registry check per process is enough.
let check: Promise<void> | undefined;
let liveInstances = 0;
let pending: { readonly packagesDirectory: string; readonly packages: readonly OutdatedPackage[] } | undefined;

// The process has already loaded the outdated versions, and a plugin can read more of its files later. The entries
// are removed when the last instance is disposed, which OpenCode does at shutdown, or when the process exits. The
// next start installs the current versions.
const discardPending = () => {
  if (pending === undefined) {
    return;
  }
  discardPackagesSync(pending.packagesDirectory, pending.packages);
  pending = undefined;
};

// eslint-disable-next-line @typescript-eslint/require-await -- OpenCode's plugin factory requires a Promise result.
export const PluginCacheRefreshPlugin: Plugin = async ({ client }) => {
  liveInstances++;
  const log = (level: 'info' | 'warn', message: string, extra: Record<string, unknown>) =>
    client.app.log({ body: { service: SERVICE, level, message, extra } }).then(
      () => undefined,
      () => undefined,
    );
  check ??= (async () => {
    const settings = npmSettings();
    // With `before` set, npm installs the newest version published before that date, not the current tag version.
    if (settings.pinnedDate) {
      return;
    }
    const packagesDirectory = defaultPackagesDirectory();
    // The check runs in the background so registry requests do not delay startup.
    const packages = await findOutdatedPackages({
      packagesDirectory,
      fetchDistTags: registryDistTags(settings),
      warn: (message, extra) => log('warn', message, extra),
    });
    if (packages.length === 0) {
      return;
    }
    pending = { packagesDirectory, packages };
    process.once('exit', discardPending);
    await log('info', 'Cached plugin packages have newer versions; they update after OpenCode restarts', {
      packages: packages.map(
        (entry) => `${entry.name}@${entry.tag}: ${entry.installedVersion} -> ${entry.availableVersion}`,
      ),
    });
  })().catch((error: unknown) =>
    log('warn', 'Plugin cache refresh failed', { error: error instanceof Error ? error.message : String(error) }),
  );
  return {
    // eslint-disable-next-line @typescript-eslint/require-await -- The hook contract returns a Promise.
    dispose: async () => {
      liveInstances--;
      if (liveInstances === 0) {
        discardPending();
      }
    },
  };
};
