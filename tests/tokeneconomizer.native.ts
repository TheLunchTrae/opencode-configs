import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { nativeBinary } from './native-host.ts';

test('native discovery loads the pinned upstream adapter from a copied installation', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'tokeneconomizer-native-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const installation = join(root, 'config', 'opencode');
  await mkdir(join(installation, 'plugins'), { recursive: true });
  await cp(new URL('../plugins/tokeneconomizer.ts', import.meta.url), join(installation, 'plugins/tokeneconomizer.ts'));
  await cp(new URL('../vendor/TokenEconomizer', import.meta.url), join(installation, 'vendor/TokenEconomizer'), {
    recursive: true,
    filter: (path) => !path.endsWith('/.git'),
  });
  for (const path of ['node_modules', 'package.json', 'package-lock.json']) {
    await cp(new URL(`../${path}`, import.meta.url), join(installation, path), { recursive: true });
  }
  await writeFile(
    join(installation, 'opencode.json'),
    JSON.stringify({
      plugin: [],
      enabled_providers: ['openai'],
      model: 'openai/gpt-4o',
      provider: { openai: { options: { apiKey: 'synthetic-test-key', baseURL: 'http://127.0.0.1:1/v1' } } },
    }),
  );
  // No credentials, inference, sessions, or hook events: only native plugin initialization.
  const binary = nativeBinary();
  const run = (args: string[]) =>
    spawnSync(binary, args, {
      cwd: root,
      encoding: 'utf8',
      timeout: 30_000,
      env: {
        PATH: process.env.PATH,
        HOME: root,
        XDG_CONFIG_HOME: join(root, 'config'),
        XDG_DATA_HOME: join(root, 'data'),
        XDG_STATE_HOME: join(root, 'state'),
        XDG_CACHE_HOME: join(root, 'cache'),
        OPENCODE_TEST_HOME: root,
        OPENCODE_DB: join(root, 'db.sqlite'),
        OPENCODE_DISABLE_AUTOUPDATE: '1',
        OPENCODE_DISABLE_MODELS_FETCH: '1',
        OPENCODE_DISABLE_PROJECT_CONFIG: '1',
        OPENCODE_DISABLE_DEFAULT_PLUGINS: 'true',
      },
    });
  const discovered = run(['debug', 'config']);
  assert.equal(discovered.error, undefined, discovered.stderr);
  assert.equal(discovered.status, 0, discovered.stderr);
  assert.match(discovered.stdout, /plugins\/tokeneconomizer\.ts/);
  const result = run(['debug', 'agent', 'build', '--print-logs']);
  assert.equal(result.error, undefined, result.stderr);
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(
    result.stderr,
    /PluginInitError|failed to load plugin|Cannot find module|Plugin export is not a function|does not expose an OpenCode V1 server plugin/i,
  );
  assert.match(result.stdout, /"name": "build"/);
});
