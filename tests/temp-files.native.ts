import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { nativeBinary } from './native-host.ts';

test('native OpenCode discovers the temp-file plugin and executes its write tool', async (t) => {
  const binary = nativeBinary();
  const repository = fileURLToPath(new URL('../', import.meta.url));
  const root = await mkdtemp(join(tmpdir(), 'opencode-temp-files-native-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const installation = join(root, 'config', 'opencode');
  const project = join(root, 'project');
  const scratch = join(root, 'scratch');
  await mkdir(join(installation, 'plugins'), { recursive: true });
  await mkdir(project);
  await mkdir(scratch);
  await cp(join(repository, 'plugins', 'temp-files.ts'), join(installation, 'plugins', 'temp-files.ts'));
  await cp(await realpath(join(repository, 'node_modules')), join(installation, 'node_modules'), { recursive: true });
  for (const file of ['package.json', 'package-lock.json']) {
    await cp(join(repository, file), join(installation, file));
  }
  await writeFile(
    join(installation, 'opencode.json'),
    JSON.stringify({
      plugin: [],
      permission: { '*': 'allow' },
      model: 'openai/native-fixture',
      enabled_providers: ['openai'],
      provider: {
        openai: {
          options: { apiKey: 'synthetic-test-key', baseURL: 'http://127.0.0.1:1/v1' },
          models: { 'native-fixture': { name: 'Native fixture', limit: { context: 4096, output: 1024 } } },
        },
      },
    }),
  );
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    XDG_CONFIG_HOME: join(root, 'config'),
    XDG_DATA_HOME: join(root, 'data'),
    XDG_STATE_HOME: join(root, 'state'),
    XDG_CACHE_HOME: join(root, 'cache'),
    OPENCODE_TEST_HOME: root,
    OPENCODE_DB: join(root, 'db.sqlite'),
    OPENCODE_DISABLE_PROJECT_CONFIG: 'true',
    OPENCODE_DISABLE_DEFAULT_PLUGINS: 'true',
    OPENCODE_DISABLE_MODELS_FETCH: '1',
    TMPDIR: scratch,
    TMP: scratch,
    TEMP: scratch,
  };
  const result = spawnSync(
    binary,
    [
      'debug',
      'agent',
      'build',
      '--tool',
      'temp_write',
      '--params',
      JSON.stringify({ filename: 'native.txt', content: 'temporary fixture' }),
    ],
    { cwd: project, env, encoding: 'utf8', timeout: 60_000 },
  );
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Wrote native\.txt\./);
  const files = (await readdir(scratch, { recursive: true })).filter((path) => path.endsWith('native.txt'));
  assert.equal(files.length, 1);
  assert.equal(await readFile(join(scratch, files[0]), 'utf8'), 'temporary fixture');
});
