import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { parse } from 'jsonc-parser';
import { nativeBinary } from './native-host.ts';

test('native agents enforce configured edit permissions from JSON and frontmatter', async (t) => {
  const binary = nativeBinary();
  const repository = fileURLToPath(new URL('../', import.meta.url));
  const root = await mkdtemp(join(tmpdir(), 'opencode-agent-permissions-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const installation = join(root, 'config', 'opencode');
  const project = join(root, 'project');
  await mkdir(installation, { recursive: true });
  await mkdir(project);
  await cp(join(repository, 'agents'), join(installation, 'agents'), { recursive: true });
  const config = parse(await readFile(join(repository, 'opencode.jsonc'), 'utf8')) as {
    permission: Record<string, unknown>;
    agent: Record<string, unknown>;
  };
  await writeFile(
    join(installation, 'opencode.json'),
    JSON.stringify({
      plugin: [],
      permission: config.permission,
      agent: config.agent,
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
    OPENCODE_DISABLE_PROJECT_CONFIG: 'true',
    OPENCODE_DISABLE_DEFAULT_PLUGINS: 'true',
    OPENCODE_DISABLE_EXTERNAL_SKILLS: 'true',
    OPENCODE_DISABLE_CLAUDE_CODE: 'true',
    OPENCODE_EXPERIMENTAL_DISABLE_FILEWATCHER: 'true',
  };
  const init = spawnSync('git', ['init', '--quiet'], { cwd: project, env, encoding: 'utf8', timeout: 30_000 });
  assert.ifError(init.error);
  assert.equal(init.status, 0, init.stderr);
  const write = (agent: string, file: string) =>
    spawnSync(
      binary,
      [
        'debug',
        'agent',
        agent,
        '--tool',
        'write',
        '--params',
        JSON.stringify({ filePath: join(project, file), content: 'synthetic-native-fixture\n' }),
      ],
      { cwd: project, env, encoding: 'utf8', timeout: 60_000 },
    );
  const written = async (file: string) => {
    try {
      return (await readFile(join(project, file), 'utf8')) === 'synthetic-native-fixture\n';
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return false;
      }
      throw error;
    }
  };

  for (const agent of ['explore', 'planner', 'code-reviewer', 'security-reviewer']) {
    await t.test(`${agent} cannot edit source`, async () => {
      const result = write(agent, `${agent}-source.txt`);
      assert.ifError(result.error);
      assert.notEqual(result.status, 0, `${agent} edited a source file`);
      assert.match(result.stderr, /permission|ruleset|disabled for agent/i);
      assert.equal(await written(`${agent}-source.txt`), false);
    });
  }
  for (const agent of ['builder', 'general']) {
    await t.test(`${agent} edits source`, async () => {
      const result = write(agent, `${agent}-source.txt`);
      assert.ifError(result.error);
      assert.equal(result.status, 0, result.stderr);
      assert.ok(await written(`${agent}-source.txt`));
    });
  }
});
