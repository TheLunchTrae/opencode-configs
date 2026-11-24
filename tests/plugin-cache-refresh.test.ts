import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  type OutdatedPackage,
  defaultPackagesDirectory,
  discardPackagesSync,
  findOutdatedPackages,
  nerfDart,
  npmSettings,
  parseCacheEntry,
  parseNpmrc,
  registryAuthorization,
  registryDistTags,
} from '../extensions/plugin-cache/refresh.ts';
import { commandName } from '../extensions/plugin-cache/tui.ts';

async function packagesFixture(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), 'plugin-cache-refresh-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const install = async (entry: string, name: string, version: string) => {
    const directory = join(root, ...entry.split('/'), 'node_modules', ...name.split('/'));
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, 'package.json'), JSON.stringify({ name, version }));
  };
  return { root, install };
}

async function registryFixture(t: TestContext, packuments: Partial<Record<string, Record<string, string>>>) {
  const requests: { url: string | undefined; accept: string | undefined; authorization: string | undefined }[] = [];
  const server = createServer((request, response) => {
    requests.push({ url: request.url, accept: request.headers.accept, authorization: request.headers.authorization });
    if (request.url === '/redirected') {
      response.statusCode = 302;
      response.setHeader('location', '/plugin');
      response.end();
      return;
    }
    const tags = packuments[request.url ?? ''];
    response.setHeader('content-type', 'application/json');
    if (tags === undefined) {
      response.statusCode = 404;
      response.end('{}');
      return;
    }
    response.end(JSON.stringify({ 'dist-tags': { ...tags, broken: 4 } }));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const address = server.address();
  assert.ok(address !== null && typeof address === 'object');
  return { url: `http://127.0.0.1:${String(address.port)}`, requests };
}

const exists = async (directory: string, entry: string) => (await readdir(directory)).includes(entry);
const noWarning = () => assert.fail('No warning expected');

test('cache entries are parsed only for dist-tag specs', () => {
  assert.deepEqual(parseCacheEntry('plugin@latest'), { name: 'plugin', tag: 'latest' });
  assert.deepEqual(parseCacheEntry('@scope/plugin@next'), { name: '@scope/plugin', tag: 'next' });
  assert.deepEqual(parseCacheEntry('plugin@beta.2'), { name: 'plugin', tag: 'beta.2' });
  for (const entry of [
    'plugin',
    '@scope/plugin',
    'plugin@1.2.3',
    'plugin@^1.2.0',
    'plugin@~1',
    'plugin@v1.2',
    'plugin@x',
    'plugin@X.1',
    'plugin@*',
    'plugin@>=1',
    'plugin@_=1',
    'alias@npm:plugin@1.0.0',
    'alias@npm_plugin@1.0.0',
    'plugin@github:owner/repo',
    '.stale',
  ]) {
    assert.equal(parseCacheEntry(entry), undefined, entry);
  }
});

test('the cache directory follows XDG_CACHE_HOME and treats an empty value as unset', () => {
  assert.equal(defaultPackagesDirectory({ XDG_CACHE_HOME: '/cache' }), join('/cache', 'opencode', 'packages'));
  const fallback = join(homedir(), '.cache', 'opencode', 'packages');
  assert.equal(defaultPackagesDirectory({}), fallback);
  assert.equal(defaultPackagesDirectory({ XDG_CACHE_HOME: '' }), fallback);
});

test('npmrc registry settings are read and other keys are ignored', () => {
  const text = [
    '; comment',
    '# comment',
    'registry = "https://mirror.example.test/npm/"',
    '@scope:registry=${SCOPE_REGISTRY}/',
    '//mirror.example.test/npm/:_authToken=${NPM_TOKEN}',
    '//basic.example.test/:_auth=c3ludGhldGljOnBhc3N3b3Jk',
    '//split.example.test/:username=synthetic',
    `//split.example.test/:_password=${Buffer.from('password').toString('base64')}`,
    '//partial.example.test/:username=synthetic',
    'email=synthetic@example.test',
    'before=2026-01-01',
  ].join('\r\n');
  assert.deepEqual(parseNpmrc(text, { SCOPE_REGISTRY: 'https://scope.example.test', NPM_TOKEN: 'synthetic-token' }), {
    registry: 'https://mirror.example.test/npm',
    scopes: { '@scope': 'https://scope.example.test' },
    credentials: {
      '//mirror.example.test/npm/': { _authToken: 'synthetic-token' },
      '//basic.example.test/': { _auth: 'c3ludGhldGljOnBhc3N3b3Jk' },
      '//split.example.test/': { username: 'synthetic', _password: Buffer.from('password').toString('base64') },
      '//partial.example.test/': { username: 'synthetic' },
    },
    pinnedDate: true,
  });
  assert.deepEqual(parseNpmrc('', {}), { scopes: {}, credentials: {}, pinnedDate: false });
});

test('npm settings merge the global npmrc, the user npmrc, and environment variables in npm order', async (t) => {
  const { root } = await packagesFixture(t);
  const globalConfig = join(root, 'global-npmrc');
  const userConfig = join(root, 'npmrc');
  await writeFile(
    globalConfig,
    'registry=https://global.example.test\n@other:registry=https://other.example.test\n' +
      '//global.example.test/:_authToken=synthetic-global\n//split.example.test/:username=synthetic\n',
  );
  await writeFile(
    userConfig,
    'registry=https://file.example.test\n@scope:registry=https://scope-file.example.test\n' +
      '//file.example.test/:_authToken=synthetic-user\n//split.example.test/:_password=cGFzc3dvcmQ=\n',
  );
  assert.deepEqual(npmSettings({ npm_config_userconfig: userConfig, npm_config_globalconfig: globalConfig }), {
    registry: 'https://file.example.test',
    scopes: { '@other': 'https://other.example.test', '@scope': 'https://scope-file.example.test' },
    credentials: {
      '//global.example.test/': { _authToken: 'synthetic-global' },
      '//split.example.test/': { username: 'synthetic', _password: 'cGFzc3dvcmQ=' },
      '//file.example.test/': { _authToken: 'synthetic-user' },
    },
    pinnedDate: false,
  });
  assert.deepEqual(
    npmSettings({
      npm_config_userconfig: userConfig,
      npm_config_registry: 'https://env.example.test/',
      'npm_config_@scope:registry': 'https://scope-env.example.test',
      npm_config_before: '2026-01-01',
    }),
    {
      registry: 'https://env.example.test',
      scopes: { '@scope': 'https://scope-env.example.test' },
      credentials: {
        '//file.example.test/': { _authToken: 'synthetic-user' },
        '//split.example.test/': { _password: 'cGFzc3dvcmQ=' },
      },
      pinnedDate: true,
    },
  );
  assert.deepEqual(npmSettings({ npm_config_userconfig: join(root, 'missing') }), {
    registry: 'https://registry.npmjs.org',
    scopes: {},
    credentials: {},
    pinnedDate: false,
  });
});

test('registry credentials match the registry path and then its parent paths on the same host', () => {
  const settings = {
    registry: 'https://registry.example.test',
    scopes: {},
    credentials: {
      '//npm.example.test/api/npm/': { _authToken: 'synthetic-path' },
      '//host.example.test/': { _authToken: 'synthetic-host' },
      '//port.example.test:8443/': { _auth: 'c3ludGhldGljOnBvcnQ=' },
      '//nested.example.test/': { _authToken: 'synthetic-parent' },
      '//nested.example.test/incomplete/': { username: 'synthetic' },
      '//split.example.test/': { username: 'synthetic', _password: Buffer.from('password').toString('base64') },
    },
    pinnedDate: false,
  };
  assert.equal(registryAuthorization(settings, 'https://npm.example.test/api/npm'), 'Bearer synthetic-path');
  assert.equal(registryAuthorization(settings, 'https://npm.example.test/api/npm/virtual/'), 'Bearer synthetic-path');
  assert.equal(registryAuthorization(settings, 'https://npm.example.test/api'), undefined);
  assert.equal(registryAuthorization(settings, 'https://host.example.test/a/b'), 'Bearer synthetic-host');
  assert.equal(registryAuthorization(settings, 'https://port.example.test:8443'), 'Basic c3ludGhldGljOnBvcnQ=');
  assert.equal(registryAuthorization(settings, 'https://nested.example.test/incomplete/x'), undefined);
  assert.equal(registryAuthorization(settings, 'https://nested.example.test/other'), 'Bearer synthetic-parent');
  assert.equal(
    registryAuthorization(settings, 'https://split.example.test'),
    `Basic ${Buffer.from('synthetic:password').toString('base64')}`,
  );
  assert.equal(registryAuthorization(settings, 'https://port.example.test'), undefined);
  assert.equal(registryAuthorization(settings, 'https://other.example.test'), undefined);
  assert.equal(registryAuthorization(settings, 'not a url'), undefined);
});

test('only tagged packages whose tag names another version are reported', async (t) => {
  const { root, install } = await packagesFixture(t);
  await install('stale@latest', 'stale', '1.0.0');
  await install('current@latest', 'current', '2.0.0');
  await install('@scope/scoped@next', '@scope/scoped', '3.0.0-next.1');
  await install('pinned@1.0.0', 'pinned', '1.0.0');
  await install('ranged@^1.0.0', 'ranged', '1.0.0');
  await install('missing-tag@canary', 'missing-tag', '0.1.0');
  await install('@ai-sdk/openai-compatible', '@ai-sdk/openai-compatible', '1.0.0');
  await install('pyright', 'pyright', '1.0.0');
  await mkdir(join(root, 'incomplete@latest'));
  const requested: string[] = [];
  const tags: Record<string, Record<string, string>> = {
    stale: { latest: '1.1.0' },
    current: { latest: '2.0.0' },
    '@scope/scoped': { latest: '2.0.0', next: '3.0.0-next.2' },
    'missing-tag': { latest: '1.0.0' },
  };
  const outdated = await findOutdatedPackages({
    packagesDirectory: root,
    fetchDistTags: (name) => {
      requested.push(name);
      return Promise.resolve(tags[name]);
    },
    warn: noWarning,
  });
  assert.deepEqual(outdated.map((entry) => [entry.entry, entry.installedVersion, entry.availableVersion]).sort(), [
    ['@scope/scoped@next', '3.0.0-next.1', '3.0.0-next.2'],
    ['stale@latest', '1.0.0', '1.1.0'],
  ]);
  assert.deepEqual(requested.sort(), ['@scope/scoped', 'current', 'missing-tag', 'stale']);
  assert.equal(await exists(root, 'stale@latest'), true, 'Finding outdated packages must not remove them');
});

test('registry failures keep the cached package and report a warning', async (t) => {
  const { root, install } = await packagesFixture(t);
  await install('offline@latest', 'offline', '1.0.0');
  await install('unknown@latest', 'unknown', '1.0.0');
  const warnings: unknown[] = [];
  const outdated = await findOutdatedPackages({
    packagesDirectory: root,
    fetchDistTags: (name) => (name === 'offline' ? Promise.reject(new Error('offline')) : Promise.resolve(undefined)),
    warn: (_message, extra) => {
      warnings.push(extra);
    },
  });
  assert.deepEqual(outdated, []);
  assert.deepEqual(warnings, [{ package: 'offline@latest', error: 'offline' }]);
});

test('a missing cache directory reports nothing', async () => {
  const outdated = await findOutdatedPackages({
    packagesDirectory: join(tmpdir(), `plugin-cache-refresh-missing-${String(process.pid)}-${String(Date.now())}`),
    fetchDistTags: () => assert.fail('No registry request expected'),
    warn: noWarning,
  });
  assert.deepEqual(outdated, []);
});

test('discarded packages are removed whole and are not removed again for the same version', async (t) => {
  const { root, install } = await packagesFixture(t);
  await install('stale@latest', 'stale', '1.0.0');
  const lookup = () => Promise.resolve({ latest: '1.1.0' });
  const first = await findOutdatedPackages({ packagesDirectory: root, fetchDistTags: lookup, warn: noWarning });
  assert.deepEqual(discardPackagesSync(root, first), ['stale@latest']);
  assert.equal(await exists(root, 'stale@latest'), false);
  assert.deepEqual(await readdir(join(root, '.stale')), []);
  assert.deepEqual(JSON.parse(await readFile(join(root, '.plugin-cache-refresh.json'), 'utf8')), {
    'stale@latest': '1.1.0',
  });

  // A registry mismatch reinstalls the same old version.
  await install('stale@latest', 'stale', '1.0.0');
  const warnings: unknown[] = [];
  const again = await findOutdatedPackages({
    packagesDirectory: root,
    fetchDistTags: lookup,
    warn: (_message, extra) => {
      warnings.push(extra);
    },
  });
  assert.deepEqual(again, []);
  assert.deepEqual(warnings, [{ package: 'stale@latest', installed: '1.0.0', registry: '1.1.0' }]);
  assert.equal(await exists(root, '.stale'), false);

  const newer = await findOutdatedPackages({
    packagesDirectory: root,
    fetchDistTags: () => Promise.resolve({ latest: '1.2.0' }),
    warn: noWarning,
  });
  assert.deepEqual(
    newer.map((entry) => entry.availableVersion),
    ['1.2.0'],
  );
});

test('a package that cannot be moved stays in place', async (t) => {
  const { root } = await packagesFixture(t);
  const missing: OutdatedPackage = {
    name: 'gone',
    tag: 'latest',
    entry: 'gone@latest',
    directory: join(root, 'gone@latest'),
    installedVersion: '1.0.0',
    availableVersion: '1.1.0',
  };
  assert.deepEqual(discardPackagesSync(root, [missing]), []);
  assert.equal(await exists(root, '.plugin-cache-refresh.json'), false);
});

test('registry dist-tags use the scope registry, its credential, and the abbreviated packument', async (t) => {
  const main = await registryFixture(t, { '/plugin': { latest: '1.0.0' } });
  const scoped = await registryFixture(t, { '/@scope%2fplugin': { latest: '1.2.3' } });
  const fetchDistTags = registryDistTags({
    registry: main.url,
    scopes: { '@scope': scoped.url },
    credentials: { [String(nerfDart(scoped.url))]: { _authToken: 'synthetic-scope' } },
    pinnedDate: false,
  });
  assert.deepEqual(await fetchDistTags('@scope/plugin'), { latest: '1.2.3' });
  assert.deepEqual(await fetchDistTags('plugin'), { latest: '1.0.0' });
  assert.equal(await fetchDistTags('missing'), undefined);
  assert.equal(await fetchDistTags('redirected'), undefined);
  assert.deepEqual(scoped.requests, [
    {
      url: '/@scope%2fplugin',
      accept: 'application/vnd.npm.install-v1+json',
      authorization: 'Bearer synthetic-scope',
    },
  ]);
  assert.deepEqual(
    main.requests.map((request) => [request.url, request.authorization]),
    [
      ['/plugin', undefined],
      ['/missing', undefined],
      ['/redirected', undefined],
    ],
  );
});

test('registry credentials in the URL are sent as a header and removed from the request URL', async (t) => {
  const main = await registryFixture(t, { '/plugin': { latest: '1.0.0' } });
  const withUser = main.url.replace('http://', 'http://synthetic%40user:pass%3Aword@');
  const fetchDistTags = registryDistTags({ registry: withUser, scopes: {}, credentials: {}, pinnedDate: false });
  assert.deepEqual(await fetchDistTags('plugin'), { latest: '1.0.0' });
  assert.deepEqual(
    main.requests.map((request) => [request.url, request.authorization]),
    [['/plugin', `Basic ${Buffer.from('synthetic@user:pass:word').toString('base64')}`]],
  );
});

test('a package reinstalled after the check is not removed', async (t) => {
  const { root, install } = await packagesFixture(t);
  await install('stale@latest', 'stale', '1.0.0');
  const outdated = await findOutdatedPackages({
    packagesDirectory: root,
    fetchDistTags: () => Promise.resolve({ latest: '2.0.0' }),
    warn: noWarning,
  });
  await install('stale@latest', 'stale', '2.0.0');
  assert.deepEqual(discardPackagesSync(root, outdated), []);
  assert.equal(await exists(root, 'stale@latest'), true);
});

async function runPlugin(t: TestContext, mode: 'process' | 'worker') {
  const { root, install } = await packagesFixture(t);
  const packages = join(root, 'cache', 'opencode', 'packages');
  await install('cache/opencode/packages/stale@latest', 'stale', '1.0.0');
  await install('cache/opencode/packages/current@latest', 'current', '1.0.0');
  const registry = await registryFixture(t, { '/stale': { latest: '2.0.0' }, '/current': { latest: '1.0.0' } });
  const child = spawn(
    process.execPath,
    ['--experimental-strip-types', fileURLToPath(new URL('./plugin-cache-refresh-child.ts', import.meta.url)), mode],
    {
      env: {
        ...process.env,
        XDG_CACHE_HOME: join(root, 'cache'),
        npm_config_registry: registry.url,
        npm_config_userconfig: join(root, 'missing-npmrc'),
      },
    },
  );
  let output = '';
  child.stdout.setEncoding('utf8').on('data', (chunk: string) => (output += chunk));
  const [code, signal] = (await once(child, 'exit')) as [number | null, NodeJS.Signals | null];
  assert.deepEqual([code, signal], [0, null]);
  return {
    logs: (JSON.parse(output) as { logs: unknown[] }).logs,
    requests: registry.requests.map((request) => request.url).sort(),
    staleExists: await exists(packages, 'stale@latest'),
    currentExists: await exists(packages, 'current@latest'),
  };
}

test('the server plugin checks once per process and removes outdated packages when the process exits', async (t) => {
  assert.deepEqual(await runPlugin(t, 'process'), {
    logs: [
      {
        service: 'plugin-cache-refresh',
        level: 'info',
        message:
          'Cached plugin packages have newer versions; they are removed when OpenCode exits normally and reinstalled at the next start',
        extra: { packages: ['stale@latest: 1.0.0 -> 2.0.0'] },
      },
    ],
    requests: ['/current', '/stale'],
    staleExists: false,
    currentExists: true,
  });
});

test('the server plugin does nothing in a worker thread, where the TUI entrypoint does the work', async (t) => {
  assert.deepEqual(await runPlugin(t, 'worker'), {
    logs: [],
    requests: [],
    staleExists: true,
    currentExists: true,
  });
});

test('the TUI entrypoint recognizes the attach command', () => {
  assert.equal(commandName(['bun', 'opencode', 'attach', 'http://localhost:4096']), 'attach');
  assert.equal(commandName(['bun', 'opencode', '--print-logs', 'attach']), 'attach');
  assert.equal(commandName(['bun', 'opencode']), undefined);
  assert.equal(commandName(['bun', 'opencode', '--print-logs', 'project']), 'project');
});

test('an invalid registry URL is reported without its text', async () => {
  const fetchDistTags = registryDistTags({
    registry: 'https://synthetic:secret@exa mple.test',
    scopes: {},
    credentials: {},
    pinnedDate: false,
  });
  await assert.rejects(fetchDistTags('plugin'), { message: 'The configured registry URL is not valid' });
});
