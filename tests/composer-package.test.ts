import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import type { TuiDialogSelectProps, TuiPluginApi } from '@opencode-ai/plugin/tui';
import { registerSettings } from 'opencode-config-composer-name-tbd/tui';
import { parse } from 'jsonc-parser';

test('packaged Composer opens both commands against the consumer settings without changing them', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'consumer-composer-tui-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const path of ['opencode.jsonc', 'config-composer.jsonc', 'agents']) {
    await cp(new URL(`../${path}`, import.meta.url), join(root, path), { recursive: true });
  }
  const before = await readFile(join(root, 'config-composer.jsonc'), 'utf8');
  const native: unknown = parse(await readFile(join(root, 'opencode.jsonc'), 'utf8'));
  let dialog: TuiDialogSelectProps<string> | undefined;
  let dispose: (() => void) | undefined;
  let unregistered = false;
  const commands: { slashName: string; run: () => void | Promise<void> }[] = [];
  const controller = new AbortController();
  t.after(() => controller.abort());
  const api = {
    state: { path: { config: root } },
    route: { current: { name: 'home' } },
    client: { config: { get: async () => ({ data: native }) } },
    lifecycle: {
      signal: controller.signal,
      onDispose: (callback: () => void) => {
        dispose = callback;
      },
    },
    keymap: {
      registerLayer: (layer: { commands: typeof commands }) => {
        commands.push(...layer.commands);
        return () => {
          unregistered = true;
        };
      },
    },
    ui: {
      DialogSelect: (props: TuiDialogSelectProps<string>) => {
        dialog = props;
      },
      dialog: {
        replace: (render: () => void) => render(),
        clear: () => {
          dialog = undefined;
        },
      },
      toast: (toast: { message: string }) => assert.fail(toast.message),
    },
  } as unknown as TuiPluginApi;
  registerSettings(api, root, root);
  assert.deepEqual(
    commands.map((command) => command.slashName),
    ['agent-models', 'agent-groups'],
  );
  await commands[0].run();
  assert.equal(dialog?.title, 'Agent models: scope');
  assert.ok(dialog.options.some((option) => option.title === 'Individual agent overrides'));
  await commands[1].run();
  assert.equal(dialog.title, 'Agent groups');
  assert.ok(dialog.options.length > 1);
  assert.equal(await readFile(join(root, 'config-composer.jsonc'), 'utf8'), before);
  dispose?.();
  assert.equal(unregistered, true);
});
