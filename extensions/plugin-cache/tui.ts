import type { TuiPluginModule } from '@opencode-ai/plugin/tui';
import { LOG_SERVICE, startPluginCacheRefresh } from './runner.ts';

// The TUI's main thread ends with `process.exit()`, so its exit handler runs when the user quits.
export default {
  id: 'plugin-cache-refresh',
  // eslint-disable-next-line @typescript-eslint/require-await -- OpenCode requires a Promise-returning TUI registration hook.
  tui: async (api) => {
    startPluginCacheRefresh((level, message, extra) =>
      api.client.app.log({ service: LOG_SERVICE, level, message, extra }).then(
        () => undefined,
        () => undefined,
      ),
    );
  },
} satisfies TuiPluginModule;
