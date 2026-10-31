import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { parse } from 'jsonc-parser';
import { nativeBinary } from './native-host.ts';

test('native read-only roles inspect Git through auto-discovery while write tools remain denied', async (t) => {
  const binary = nativeBinary();
  const repository = fileURLToPath(new URL('../', import.meta.url));
  const root = await mkdtemp(join(tmpdir(), 'opencode-git-inspect-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const installation = join(root, 'config', 'opencode');
  const project = join(root, 'project');
  await mkdir(installation, { recursive: true });
  await mkdir(project);
  for (const path of ['agents', 'prompts', 'plugins', 'extensions', 'references']) {
    await cp(join(repository, path), join(installation, path), { recursive: true });
  }
  await cp(await realpath(join(repository, 'node_modules')), join(installation, 'node_modules'), { recursive: true });
  for (const path of ['config-composer.jsonc', 'package.json', 'package-lock.json']) {
    await cp(join(repository, path), join(installation, path));
  }
  const config = parse(await readFile(join(repository, 'opencode.jsonc'), 'utf8')) as Record<string, unknown>;
  config.plugin = [
    join(installation, 'node_modules/@lunchbox-labs/opencode-config-composer'),
    join(installation, 'node_modules/@lunchbox-labs/opencode-prompt-composer'),
  ];
  delete config.shell;
  config.enabled_providers = ['openai'];
  config.provider = {
    openai: { options: { apiKey: 'synthetic-test-key', baseURL: 'http://127.0.0.1:1/v1' } },
  };
  await writeFile(join(installation, 'opencode.jsonc'), JSON.stringify(config));
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
    OPENCODE_DISABLE_PROJECT_CONFIG: '1',
    OPENCODE_DISABLE_DEFAULT_PLUGINS: 'true',
    OPENCODE_EXPERIMENTAL_DISABLE_FILEWATCHER: 'true',
    // This fixture tests Git tools, not the separately tested optimizer runtime.
    TE_DISABLE: '1',
  };
  const git = (...args: string[]) => {
    const result = spawnSync('git', args, { cwd: project, env, encoding: 'utf8', timeout: 30_000 });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
  };
  git('init', '--quiet');
  await writeFile(join(project, 'app.txt'), 'public-native-fixture\n');
  await writeFile(join(project, '.env'), 'PRIVATE=synthetic-native-secret\n');
  git('add', '.');
  git('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '--quiet', '-m', 'fixture');
  const run = (agent: string, tool?: string, params: Record<string, unknown> = {}) => {
    const args = [
      'debug',
      'agent',
      agent,
      ...(tool === undefined ? [] : ['--tool', tool, '--params', JSON.stringify(params)]),
    ];
    const result = spawnSync(binary, args, {
      cwd: project,
      env,
      encoding: 'utf8',
      timeout: 30_000,
    });
    assert.ifError(result.error);
    return result;
  };
  const permissions: unknown[] = [];
  let editTool = '';
  for (const agent of ['code-reviewer', 'security-reviewer', 'planner']) {
    const inspected = run(agent);
    assert.equal(inspected.status, 0, inspected.stderr);
    const resolved = JSON.parse(inspected.stdout) as {
      permission: unknown;
      tools: Record<string, boolean>;
    };
    permissions.push({ agent, permission: resolved.permission });
    const editing = ['edit', 'write', 'apply_patch'].filter((name) => name in resolved.tools);
    assert.ok(editing.length > 0, 'The native model must expose an editing tool to test its denial');
    for (const tool of ['bash', 'task', ...editing]) {
      assert.equal(resolved.tools[tool], false, `${agent}: ${tool} must remain disabled`);
    }
    if (agent === 'code-reviewer') {
      editTool = editing[0] ?? '';
    }
    const read = run(agent, 'git_inspect', { operation: 'show', revision: 'HEAD:app.txt' });
    assert.equal(read.status, 0, read.stderr);
    assert.match(read.stdout, /public-native-fixture/);
  }
  if (process.env.CONFIG_CONSUMER_EVIDENCE !== undefined) {
    await writeFile(
      `${process.env.CONFIG_CONSUMER_EVIDENCE}-git-inspect-${process.env.OPENCODE_NATIVE_VERSION}.json`,
      JSON.stringify(permissions, null, 2),
    );
  }
  const secret = run('code-reviewer', 'git_inspect', { operation: 'show', revision: 'HEAD:.env' });
  assert.notEqual(secret.status, 0);
  assert.match(secret.stderr, /sensitive/);
  assert.doesNotMatch(secret.stdout + secret.stderr, /synthetic-native-secret/);
  for (const [tool, params] of [
    ['bash', { command: 'echo forbidden', description: 'denied shell' }],
    [editTool, { filePath: join(project, 'app.txt'), oldString: 'public', newString: 'changed', patchText: '' }],
    ['task', { description: 'denied delegation', prompt: 'do not run', subagent_type: 'general' }],
  ] as const) {
    const denied = run('code-reviewer', tool, params);
    assert.notEqual(denied.status, 0);
    assert.match(denied.stderr, /disabled for agent/);
  }
  assert.equal(await readFile(join(project, 'app.txt'), 'utf8'), 'public-native-fixture\n');
  await writeFile(
    join(installation, 'agents', 'inspection-denied.md'),
    '---\ndescription: Native denial fixture\nmode: subagent\npermission:\n  git_inspect: deny\n---\nRead-only fixture.',
  );
  const denied = run('inspection-denied', 'git_inspect', { operation: 'show', revision: 'HEAD:app.txt' });
  assert.notEqual(denied.status, 0);
  assert.match(denied.stderr, /disabled for agent/);
  assert.doesNotMatch(denied.stdout, /public-native-fixture/);
});
