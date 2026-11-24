import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access, cp, mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { nativeBinary } from './native-host.ts';

const POLL_INTERVAL_MS = 200;
const STARTUP_TIMEOUT_MS = 60_000;

const exists = (path: string) =>
  access(path).then(
    () => true,
    () => false,
  );

test('native OpenCode reports an outdated tagged package and removes it after its instance is disposed', async (t) => {
  const binary = nativeBinary();
  const repository = fileURLToPath(new URL('../', import.meta.url));
  const root = await mkdtemp(join(tmpdir(), 'opencode-plugin-cache-native-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const installation = join(root, 'config', 'opencode');
  const project = join(root, 'project');
  const packages = join(root, 'cache', 'opencode', 'packages');
  const outdated = join(packages, 'fixture-plugin@latest');
  const current = join(packages, 'current-plugin@latest');
  await mkdir(join(installation, 'plugins'), { recursive: true });
  await mkdir(join(installation, 'extensions'), { recursive: true });
  await mkdir(project);
  await cp(
    join(repository, 'plugins', 'plugin-cache-refresh.ts'),
    join(installation, 'plugins', 'plugin-cache-refresh.ts'),
  );
  await cp(join(repository, 'extensions', 'plugin-cache'), join(installation, 'extensions', 'plugin-cache'), {
    recursive: true,
  });
  await cp(await realpath(join(repository, 'node_modules')), join(installation, 'node_modules'), { recursive: true });
  for (const file of ['package.json', 'package-lock.json']) {
    await cp(join(repository, file), join(installation, file));
  }
  await writeFile(join(installation, 'opencode.json'), JSON.stringify({ plugin: [] }));
  for (const [directory, name] of [
    [outdated, 'fixture-plugin'],
    [current, 'current-plugin'],
  ] as const) {
    await mkdir(join(directory, 'node_modules', name), { recursive: true });
    await writeFile(join(directory, 'node_modules', name, 'package.json'), JSON.stringify({ name, version: '1.0.0' }));
  }

  const registry = createServer((request, response) => {
    const latest = { '/fixture-plugin': '2.0.0', '/current-plugin': '1.0.0' }[request.url ?? ''];
    response.setHeader('content-type', 'application/json');
    if (latest === undefined) {
      response.statusCode = 404;
      response.end('{}');
      return;
    }
    response.end(JSON.stringify({ 'dist-tags': { latest } }));
  });
  await new Promise<void>((resolve) => registry.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise<void>((resolve) => registry.close(() => resolve())));
  const address = registry.address();
  assert.ok(address !== null && typeof address === 'object');

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
    npm_config_registry: `http://127.0.0.1:${String(address.port)}`,
    npm_config_userconfig: join(root, 'npmrc'),
  };
  const server = spawn(
    binary,
    ['serve', '--hostname', '127.0.0.1', '--port', '0', '--print-logs', '--log-level', 'INFO'],
    { cwd: project, env },
  );
  t.after(() => {
    server.kill();
  });
  let output = '';
  server.stdout.setEncoding('utf8').on('data', (chunk: string) => (output += chunk));
  server.stderr.setEncoding('utf8').on('data', (chunk: string) => (output += chunk));

  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  let url: string | undefined;
  while (url === undefined) {
    assert.ok(Date.now() < deadline, `Server did not start: ${output}`);
    assert.equal(server.exitCode, null, `Server exited: ${output}`);
    url = /listening on (http:\/\/\S+)/.exec(output)?.[1];
    if (url === undefined) {
      await delay(POLL_INTERVAL_MS);
    }
  }
  // Server plugins load when the first request for a directory starts its instance.
  const response = await fetch(`${url}/config?directory=${encodeURIComponent(project)}`);
  assert.equal(response.status, 200, await response.text());
  while (!output.includes('fixture-plugin@latest: 1.0.0 -> 2.0.0')) {
    assert.ok(Date.now() < deadline, `Outdated package was not reported: ${output}`);
    await delay(POLL_INTERVAL_MS);
  }
  // The running instance keeps the outdated files; they are removed when its last instance is disposed.
  assert.equal(await exists(outdated), true);
  const disposed = await fetch(`${url}/instance/dispose?directory=${encodeURIComponent(project)}`, { method: 'POST' });
  assert.equal(disposed.status, 200, await disposed.text());
  while (await exists(outdated)) {
    assert.ok(Date.now() < deadline, `Outdated package was not removed after dispose: ${output}`);
    await delay(POLL_INTERVAL_MS);
  }
  assert.equal(await exists(current), true);
});
