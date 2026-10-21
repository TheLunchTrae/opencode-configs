import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { isAbsolute, win32 } from 'node:path';
import { test } from 'node:test';
import { parse } from 'jsonc-parser';

const root = new URL('../', import.meta.url);
const config = (name) => parse(readFileSync(new URL(name, root), 'utf8'));

test('only server entrypoints occupy native discovery roots, without explicit duplicates', () => {
  const entries = ['plugin', 'plugins'].flatMap((directory) => {
    const path = new URL(`${directory}/`, root);
    return existsSync(path)
      ? readdirSync(path, { withFileTypes: true })
          .filter((entry) => entry.isFile() && /\.(?:ts|js)$/.test(entry.name))
          .map((entry) => `${directory}/${entry.name}`)
      : [];
  });
  assert.deepEqual(entries.sort(), ['plugins/block-secrets.ts', 'plugins/workflow-status.ts']);
  assert.ok(!existsSync(new URL('extensions/session-tools/server.ts', root)), 'remove the old entrypoint');
  for (const spec of config('opencode.jsonc').plugin) {
    const name = Array.isArray(spec) ? spec[0] : spec;
    assert.ok(
      !name.startsWith('.') && !name.startsWith('file:') && !isAbsolute(name) && !win32.isAbsolute(name),
      `local server plugins must be discovered once: ${name}`,
    );
  }
});

test('each local TUI panel remains explicitly registered once outside server discovery', () => {
  const panels = config('tui.jsonc').plugin.filter((spec) => spec.startsWith('./'));
  assert.deepEqual(panels, [
    './extensions/session-tools/workflow.tsx',
    './extensions/session-tools/config.ts',
    './extensions/session-tools/context.ts',
    './extensions/session-tools/bookmarks.tsx',
  ]);
  for (const panel of panels) {
    assert.ok(existsSync(new URL(panel, root)));
  }
});
