import type { TuiPluginModule } from '@opencode-ai/plugin/tui';
import { LOG_SERVICE, startPluginCacheRefresh } from './runner.ts';

// The first command-line word that is not an option, such as `attach` in `opencode attach <url>`.
export const commandName = (argv: readonly string[] = process.argv) =>
  argv.slice(2).find((arg) => !arg.startsWith('-'));

// The TUI's main thread ends with `process.exit()`, so its exit handler runs when the user quits. `opencode attach`
// uses a server in another process, possibly on another machine, which can still have the cached packages loaded.
export default {
  id: 'plugin-cache-refresh',
  // eslint-disable-next-line @typescript-eslint/require-await -- OpenCode requires a Promise-returning TUI registration hook.
  tui: async (api) => {
    if (commandName() === 'attach') {
      return;
    }
    startPluginCacheRefresh((level, message, extra) =>
      api.client.app.log({ service: LOG_SERVICE, level, message, extra }).then(
        () => undefined,
        () => undefined,
      ),
    );
  },
} satisfies TuiPluginModule;
