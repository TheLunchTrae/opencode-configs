import type { PluginInput } from '@opencode-ai/plugin';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { PluginCacheRefreshPlugin } from '../plugins/plugin-cache-refresh.ts';

// Runs the plugin as OpenCode would for two project instances. In `dispose` mode it disposes both instances before
// it exits; in `exit` mode it exits without disposing them, so only the exit handler can remove packages.
const POLL_INTERVAL_MS = 20;
const TIMEOUT_MS = 10_000;
const mode = process.argv[2];
const cacheHome = process.env.XDG_CACHE_HOME;
if (cacheHome === undefined) {
  throw new Error('XDG_CACHE_HOME is required');
}
const stale = join(cacheHome, 'opencode', 'packages', 'stale@latest');
const logs: unknown[] = [];
const client = {
  app: {
    log: (options: { body: unknown }) => {
      logs.push(options.body);
      return Promise.resolve({});
    },
  },
};
const input = { client } as unknown as PluginInput;
const instances = [await PluginCacheRefreshPlugin(input), await PluginCacheRefreshPlugin(input)];
const deadline = Date.now() + TIMEOUT_MS;
while (logs.length === 0 && Date.now() < deadline) {
  await delay(POLL_INTERVAL_MS);
}
const existsAfterDispose: boolean[] = [];
if (mode === 'dispose') {
  for (const hooks of instances) {
    await hooks.dispose?.();
    existsAfterDispose.push(existsSync(stale));
  }
}
process.stdout.write(JSON.stringify({ logs, existsAfterDispose }));
process.exit(0);
