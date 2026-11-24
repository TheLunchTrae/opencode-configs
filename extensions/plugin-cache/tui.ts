import type { TuiPluginModule } from '@opencode-ai/plugin/tui';
import { LOG_SERVICE, startPluginCacheRefresh } from './runner.ts';

// Whether the command line names `attach`, as in `opencode attach <url>`. Options with values, such as `--log-level`,
// can come first, so any argument counts. A false match, such as a project directory named `attach`, only skips the
// check.
export const isAttachCommand = (argv: readonly string[] = process.argv) => argv.slice(2).includes('attach');

// The TUI's main thread ends with `process.exit()`, so its exit handler runs when the user quits. `opencode attach`
// uses a server in another process, possibly on another machine, which can still have the cached packages loaded.
export default {
  id: 'plugin-cache-refresh',
  // eslint-disable-next-line @typescript-eslint/require-await -- OpenCode requires a Promise-returning TUI registration hook.
  tui: async (api) => {
    if (isAttachCommand()) {
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
